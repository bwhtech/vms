import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useCall } from 'frappe-ui'

import {
	MAX_CONCURRENT,
	isAbortError,
	isTerminal,
	uploadFile,
	type UploadContext,
	type UploadItem,
} from '@/composables/useUpload'

export interface UploadCounts {
	total: number
	done: number
	error: number
	cancelled: number
}

export type UploadReportStatus = 'idle' | 'sending' | 'sent' | 'error' | 'skipped'

interface UploadBatch {
	ids: Set<string>
	onDone?: (assetNames: string[]) => void
	notified: boolean
}

const items: Ref<UploadItem[]> = ref([])
const queue: string[] = []
const contexts = new Map<string, UploadContext>()
const controllers = new Map<string, AbortController>()
const batches: UploadBatch[] = []
const reportStatus = ref<UploadReportStatus>('idle')

let activeCount = 0
let reportSent = false
let reportGeneration = 0

const reportCall = useCall<{ status: string }, { files: string }>({
	url: '/api/v2/method/vms.api.send_upload_report',
	method: 'POST',
	immediate: false,
})

const active: ComputedRef<number> = computed(
	() => items.value.filter((item) => !isTerminal(item.status)).length,
)

const isUploading: ComputedRef<boolean> = computed(() => active.value > 0)

const allSettled: ComputedRef<boolean> = computed(
	() => items.value.length > 0 && items.value.every((item) => isTerminal(item.status)),
)

const counts: ComputedRef<UploadCounts> = computed(() => {
	const result: UploadCounts = { total: items.value.length, done: 0, error: 0, cancelled: 0 }
	for (const item of items.value) {
		if (item.status === 'done') result.done++
		else if (item.status === 'error') result.error++
		else if (item.status === 'cancelled') result.cancelled++
	}
	return result
})

const overallProgress: ComputedRef<number> = computed(() => {
	const included = items.value.filter((item) => item.status !== 'cancelled')
	if (included.length === 0) return 0
	const total = included.reduce(
		(sum, item) => sum + (item.status === 'done' ? 100 : item.progress),
		0,
	)
	return Math.round(total / included.length)
})

function add(files: File[], ctx: UploadContext): void {
	if (files.length === 0) return
	if (allSettled.value) clearDone()

	reportSent = false
	reportGeneration++
	reportStatus.value = 'idle'
	const context = { ...ctx }
	const ids = new Set<string>()

	for (const file of files) {
		const item: UploadItem = { id: newId(), file, status: 'queued', progress: 0 }
		items.value.push(item)
		contexts.set(item.id, context)
		queue.push(item.id)
		ids.add(item.id)
	}

	batches.push({ ids, onDone: context.onDone, notified: false })
	fillUploadSlots()
}

function retry(id: string): void {
	const item = findItem(id)
	if (!item || item.status !== 'error') return

	item.status = 'queued'
	item.progress = 0
	item.error = undefined
	item.assetName = undefined
	reportSent = false
	reportGeneration++
	reportStatus.value = 'idle'
	for (const batch of batches) {
		if (batch.ids.has(id)) batch.notified = false
	}
	queue.push(id)
	fillUploadSlots()
}

function cancel(id: string): void {
	const queueIndex = queue.indexOf(id)
	if (queueIndex !== -1) {
		queue.splice(queueIndex, 1)
		const item = findItem(id)
		if (item) item.status = 'cancelled'
		finishSettledWork()
		return
	}

	controllers.get(id)?.abort()
}

function clearDone(): void {
	const terminalIds = new Set(
		items.value.filter((item) => isTerminal(item.status)).map((item) => item.id),
	)
	for (const id of terminalIds) contexts.delete(id)
	items.value = items.value.filter((item) => !terminalIds.has(item.id))

	for (let index = batches.length - 1; index >= 0; index--) {
		if ([...batches[index].ids].every((id) => terminalIds.has(id))) batches.splice(index, 1)
	}

	if (items.value.length === 0) {
		reportSent = false
		reportGeneration++
		reportStatus.value = 'idle'
	}
}

function fillUploadSlots(): void {
	while (activeCount < MAX_CONCURRENT && queue.length > 0) {
		const id = queue.shift()
		if (!id) break
		activeCount++
		void runItem(id)
	}
	if (activeCount === 0 && queue.length === 0) finishSettledWork()
}

async function runItem(id: string): Promise<void> {
	const item = findItem(id)
	const ctx = contexts.get(id) ?? {}
	if (!item) {
		activeCount--
		fillUploadSlots()
		return
	}

	const controller = new AbortController()
	controllers.set(id, controller)
	item.status = 'uploading'
	item.progress = 0

	try {
		const { assetName } = await uploadFile(
			item.file,
			ctx,
			(progress) => {
				item.progress = progress
				if (progress >= 100 && item.status === 'uploading') item.status = 'confirming'
			},
			controller.signal,
		)
		item.assetName = assetName
		item.status = 'done'
	} catch (error) {
		if (isAbortError(error)) {
			item.status = 'cancelled'
		} else {
			item.status = 'error'
			item.error = error instanceof Error ? error.message : 'Upload failed'
		}
	} finally {
		controllers.delete(id)
		activeCount--
		fillUploadSlots()
	}
}

function finishSettledWork(): void {
	notifySettledBatches()
	void sendReportIfNeeded()
}

function notifySettledBatches(): void {
	for (const batch of batches) {
		if (batch.notified) continue
		const batchItems = [...batch.ids].map(findItem).filter(Boolean) as UploadItem[]
		if (
			batchItems.length !== batch.ids.size ||
			!batchItems.every((item) => isTerminal(item.status))
		) {
			continue
		}
		batch.notified = true
		const uploaded = batchItems
			.filter((item) => item.status === 'done' && item.assetName)
			.map((item) => item.assetName as string)
		if (uploaded.length > 0) {
			try {
				batch.onDone?.(uploaded)
			} catch {
				// A page refresh callback must not break queue cleanup or reporting.
			}
		}
	}
}

async function sendReportIfNeeded(): Promise<void> {
	if (reportSent || activeCount > 0 || queue.length > 0) return
	const settled = items.value
	if (settled.length === 0 || !settled.every((item) => isTerminal(item.status))) return

	if (settled.length < 2) {
		reportStatus.value = 'skipped'
		return
	}

	reportSent = true
	reportStatus.value = 'sending'
	const generation = reportGeneration
	const files = settled.map((item) => ({
		name: item.file.name,
		size: item.file.size,
		status: item.status,
		error: item.error,
	}))

	try {
		await reportCall.submit({ files: JSON.stringify(files) })
		if (generation === reportGeneration) reportStatus.value = 'sent'
	} catch {
		if (generation === reportGeneration) reportStatus.value = 'error'
	}
}

function findItem(id: string): UploadItem | undefined {
	return items.value.find((item) => item.id === id)
}

function newId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useUploadQueue(): {
	items: Ref<UploadItem[]>
	add(files: File[], ctx: UploadContext): void
	cancel(id: string): void
	retry(id: string): void
	clearDone(): void
	active: ComputedRef<number>
	isUploading: ComputedRef<boolean>
	allSettled: ComputedRef<boolean>
	counts: ComputedRef<UploadCounts>
	overallProgress: ComputedRef<number>
	reportStatus: Ref<UploadReportStatus>
} {
	return {
		items,
		add,
		cancel,
		retry,
		clearDone,
		active,
		isUploading,
		allSettled,
		counts,
		overallProgress,
		reportStatus,
	}
}
