/**
 * Module-singleton upload queue. Replaces frontend-react/src/contexts/UploadContext.tsx.
 *
 * Runs at most MAX_CONCURRENT uploads at once; every item is uploaded via
 * uploadFile() from useUpload.ts. State survives dialog open/close because it
 * lives at module level, not in a component.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { call } from 'frappe-ui'
import {
	MAX_CONCURRENT,
	isAbortError,
	isTerminal,
	uploadFile,
	type UploadContext,
	type UploadItem,
} from '@/composables/useUpload'

const items: Ref<UploadItem[]> = ref([])
const queue: string[] = []
const contexts = new Map<string, UploadContext>()
const controllers = new Map<string, AbortController>()
let activeCount = 0
let reportSent = false

const active: ComputedRef<number> = computed(
	() => items.value.filter((item) => !isTerminal(item.status)).length,
)

const isUploading: ComputedRef<boolean> = computed(() => active.value > 0)

function findItem(id: string): UploadItem | undefined {
	return items.value.find((item) => item.id === id)
}

function newId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function add(files: File[], ctx: UploadContext): void {
	reportSent = false
	for (const file of files) {
		const item: UploadItem = { id: newId(), file, status: 'queued', progress: 0 }
		items.value.push(item)
		contexts.set(item.id, ctx)
		queue.push(item.id)
	}
	for (let i = 0; i < MAX_CONCURRENT; i++) processNext()
}

function retry(id: string): void {
	const item = findItem(id)
	if (!item || item.status !== 'error') return
	item.status = 'queued'
	item.progress = 0
	item.error = undefined
	item.assetName = undefined
	reportSent = false
	queue.push(id)
	for (let i = 0; i < MAX_CONCURRENT; i++) processNext()
}

function cancel(id: string): void {
	// Still queued: drop it without starting
	const queueIndex = queue.indexOf(id)
	if (queueIndex !== -1) {
		queue.splice(queueIndex, 1)
		const item = findItem(id)
		if (item) item.status = 'cancelled'
		maybeSendReport()
		return
	}
	// In flight: abort the XHR / stop the multipart loop between parts
	controllers.get(id)?.abort()
}

function clearDone(): void {
	for (const item of items.value) {
		if (isTerminal(item.status)) contexts.delete(item.id)
	}
	items.value = items.value.filter((item) => !isTerminal(item.status))
	if (items.value.length === 0) reportSent = false
}

function processNext(): void {
	if (activeCount >= MAX_CONCURRENT) return
	const id = queue.shift()
	if (!id) {
		if (activeCount === 0) maybeSendReport()
		return
	}
	activeCount++
	// Not awaited: the queue advances from runItem's finally block
	void runItem(id)
}

async function runItem(id: string): Promise<void> {
	const item = findItem(id)
	const ctx = contexts.get(id) ?? {}
	if (!item) {
		activeCount--
		processNext()
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
			(p) => {
				item.progress = p
				if (p >= 100 && item.status === 'uploading') item.status = 'confirming'
			},
			controller.signal,
		)
		item.assetName = assetName
		item.status = 'done'
		ctx.onDone?.()
	} catch (e) {
		if (isAbortError(e)) {
			item.status = 'cancelled'
		} else {
			item.status = 'error'
			item.error = e instanceof Error ? e.message : 'Upload failed'
		}
	} finally {
		controllers.delete(id)
		activeCount--
		processNext()
	}
}

/** Email an upload report once a batch of 2+ files has fully settled (React parity). */
function maybeSendReport(): void {
	if (reportSent || activeCount > 0 || queue.length > 0) return
	const settled = items.value
	if (settled.length < 2 || !settled.every((item) => isTerminal(item.status))) return
	reportSent = true
	const payload = settled.map((item) => ({
		name: item.file.name,
		size: item.file.size,
		status: item.status,
		error: item.error,
	}))
	call('vms.api.send_upload_report', { files: JSON.stringify(payload) }).catch(() => {})
}

export function useUploadQueue(): {
	items: Ref<UploadItem[]>
	add(files: File[], ctx: UploadContext): void
	cancel(id: string): void
	retry(id: string): void
	clearDone(): void
	active: ComputedRef<number>
	isUploading: ComputedRef<boolean>
} {
	return { items, add, cancel, retry, clearDone, active, isUploading }
}
