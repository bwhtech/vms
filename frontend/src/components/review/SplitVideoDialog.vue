<template>
	<Dialog
		:open="review.panels.split.value"
		title="Split video"
		size="md"
		:dismissible="!isProcessing"
		@update:open="handleOpenChange"
	>
		<div v-if="isProcessing" class="space-y-5 py-2">
			<div class="flex items-start gap-3 rounded bg-surface-blue-1 p-3">
				<span class="lucide-loader-circle mt-0.5 size-4 animate-spin text-ink-blue-6" />
				<div>
					<p class="text-base-medium text-ink-gray-8">{{ progressLabel }}</p>
					<p class="mt-1 text-p-sm text-ink-gray-5">
						New assets will appear in the same project and folder.
					</p>
				</div>
			</div>
			<Progress :value="progressPercent" size="lg" />
			<p class="text-center text-p-xs text-ink-gray-5">
				You can close this dialog. Splitting continues in the background.
			</p>
		</div>
		<div v-else class="space-y-5">
			<p class="text-p-sm text-ink-gray-6">
				Split <span class="font-medium text-ink-gray-8">{{ asset.file_name }}</span> into equal
				parts without re-encoding.
			</p>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<label class="text-sm-medium text-ink-gray-7">Number of parts</label>
					<span class="text-base-semibold tabular-nums text-ink-gray-8">{{ sliceCount }}</span>
				</div>
				<Slider v-model="slices" :min="2" :max="10" :step="1" />
				<div class="flex justify-between text-p-xs text-ink-gray-5">
					<span>2</span><span>10</span>
				</div>
			</div>
			<div v-if="asset.file_size" class="space-y-2 rounded bg-surface-gray-1 p-3 text-p-sm">
				<div class="flex justify-between gap-4">
					<span class="text-ink-gray-5">Original size</span>
					<span class="text-ink-gray-8">{{ formatBytes(asset.file_size) }}</span>
				</div>
				<div class="flex justify-between gap-4">
					<span class="text-ink-gray-5">Approx. per part</span>
					<span class="text-ink-gray-8">{{ formatBytes(asset.file_size / sliceCount) }}</span>
				</div>
			</div>
			<p class="text-p-xs text-ink-gray-5">
				This background job uses stream copy, so there is no quality loss. You will also receive
				an email when it finishes.
			</p>
		</div>

		<div v-if="parts.length" class="mt-5 border-t border-outline-gray-1 pt-4">
			<p class="mb-2 text-sm-medium text-ink-gray-7">
				Split parts ({{ parts.length }})
			</p>
			<List :columns="['minmax(0,1fr)', 'auto']" divider="full">
				<ListRow
					v-for="part in parts"
					:key="part.name"
					:value="part.name"
					:to="`/review/${part.name}`"
				>
					<ListCell class="py-3">
						<div class="min-w-0">
							<p class="truncate text-base text-ink-gray-8">{{ part.file_name }}</p>
							<p v-if="part.file_size" class="mt-1 text-p-xs text-ink-gray-5">
								{{ formatBytes(part.file_size) }}
							</p>
						</div>
					</ListCell>
					<ListCell class="justify-end">
						<Badge :label="part.status || 'Ready'" :theme="partTheme(part.status)" />
					</ListCell>
				</ListRow>
			</List>
		</div>

		<template #actions>
			<div class="flex w-full justify-end gap-2">
				<Button label="Close" @click="close" />
				<Button
					v-if="!isProcessing"
					variant="solid"
					:label="`Split into ${sliceCount} parts`"
					:loading="start.loading"
					@click="startSplit"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Badge, Button, Dialog, Progress, Slider, toast, useCall } from 'frappe-ui'
import { List, ListCell, ListRow } from 'frappe-ui/list'
import { useReview } from '@/composables/useReview'
import { formatBytes } from '@/lib/format'
import { assetStatusTheme } from '@/lib/status'
import type { AssetStatus } from '@/types'

interface SplitPart {
	name: string
	file_name: string
	file_size?: number
	status?: string
}

interface SplitProgress {
	stage: string
	current: number
	total: number
}

interface SplitStatus {
	status: string
	progress?: SplitProgress | null
}

const review = useReview()
const asset = review.asset.value!
const slices = ref([2])
const currentStatus = ref(asset.status)
const progress = ref<SplitProgress | null>(null)
const trackedJob = ref(asset.status === 'Processing')
const sliceCount = computed(() => slices.value[0] ?? 2)
const isProcessing = computed(() => currentStatus.value === 'Processing')

const partsRequest = useCall<SplitPart[], { asset_name: string }>({
	url: '/api/v2/method/vms.video_split.get_split_parts',
	method: 'GET',
	params: { asset_name: asset.name },
	cacheKey: ['split-parts', asset.name],
})
const statusRequest = useCall<SplitStatus, { asset_name: string }>({
	url: '/api/v2/method/vms.video_split.get_split_status',
	method: 'GET',
	params: { asset_name: asset.name },
	cacheKey: ['split-status', asset.name],
	onSuccess: applyStatus,
})
const start = useCall<unknown, { asset_name: string; num_slices: number }>({
	url: '/api/v2/method/vms.video_split.start_video_split',
	method: 'POST',
	immediate: false,
})

const fallbackParts = (asset.split_parts ?? []).map((part) => ({ ...part, status: 'Ready' }))
const parts = computed(() => partsRequest.data ?? fallbackParts)
const progressLabel = computed(() => {
	const value = progress.value
	if (!value || value.stage === 'queued') return 'Waiting to start'
	if (value.stage === 'downloading') return 'Downloading from storage'
	if (value.stage === 'splitting') return 'Splitting video'
	if (value.stage === 'uploading') {
		return value.total ? `Uploading part ${value.current} of ${value.total}` : 'Uploading parts'
	}
	return 'Processing video'
})
const progressPercent = computed(() => {
	const value = progress.value
	if (!value || value.stage === 'queued') return 5
	if (value.stage === 'downloading') return 15
	if (value.stage === 'splitting') return 45
	if (value.stage === 'uploading' && value.total) return 50 + (value.current / value.total) * 45
	return 50
})

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(isProcessing, (active) => (active ? startPolling() : stopPolling()), { immediate: true })
watch(
	() => review.panels.split.value,
	(open) => {
		if (!open) return
		slices.value = [2]
		void partsRequest.reload()
		void statusRequest.reload()
	},
)

async function startSplit() {
	try {
		await start.submit({ asset_name: asset.name, num_slices: sliceCount.value })
		currentStatus.value = 'Processing'
		progress.value = { stage: 'queued', current: 0, total: sliceCount.value }
		trackedJob.value = true
		startPolling()
		review.reload()
		toast.success(`Splitting into ${sliceCount.value} parts`)
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not start the video split')
	}
}

async function applyStatus(data: SplitStatus) {
	const wasProcessing = currentStatus.value === 'Processing'
	currentStatus.value = data.status
	progress.value = data.progress ?? null
	if (!wasProcessing || data.status === 'Processing' || !trackedJob.value) return
	stopPolling()
	await partsRequest.reload()
	review.reload()
	trackedJob.value = false
	if (parts.value.length) toast.success(`Video split complete · ${parts.value.length} parts created`)
	else toast.error('The split finished without creating any parts')
}

function startPolling() {
	if (pollTimer) return
	void statusRequest.reload()
	pollTimer = setInterval(() => void statusRequest.reload(), 5000)
}

function stopPolling() {
	if (!pollTimer) return
	clearInterval(pollTimer)
	pollTimer = null
}

function handleOpenChange(open: boolean) {
	if (!open && isProcessing.value) return
	review.panels.split.value = open
}

function close() {
	review.panels.split.value = false
}

function partTheme(status?: string) {
	return assetStatusTheme((status || 'Ready') as AssetStatus)
}

onScopeDispose(stopPolling)
</script>
