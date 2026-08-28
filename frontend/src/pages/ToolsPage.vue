<template>
	<PageHeader>
		<PageHeaderTitle>
			<div class="min-w-0">
				<h1 class="truncate">Tools</h1>
				<p class="text-sm text-ink-gray-5">Compress a video to a smaller H.264 MP4.</p>
			</div>
		</PageHeaderTitle>
		<template #actions>
			<Button
				label="Compress video"
				icon-left="lucide-file-archive"
				variant="solid"
				data-testid="tools-compress"
				@click="openCompress"
			/>
		</template>
	</PageHeader>

	<div class="px-3 py-5 pb-10 sm:px-5" data-testid="tools-page">
		<LoadingText v-if="jobsCall.loading && !jobs.length" :lines="4" />
		<ErrorMessage v-else-if="jobsCall.error && !jobs.length" :message="jobsCall.error" />
		<EmptyState
			v-else-if="!jobs.length"
			icon="lucide-file-archive"
			title="No compression jobs"
			description="Compressed copies are kept here for download. The original file is not changed."
		>
			<template #actions>
				<Button
					label="Compress video"
					icon-left="lucide-file-archive"
					@click="openCompress"
				/>
			</template>
		</EmptyState>

		<template v-else>
			<List
				:columns="COLUMNS"
				class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5 max-sm:[--list-columns:minmax(0,1fr)_auto]"
				data-testid="tools-jobs"
			>
				<ListHeader class="max-sm:!hidden">
					<ListHeaderCell>File</ListHeaderCell>
					<ListHeaderCell>Status</ListHeaderCell>
					<ListHeaderCell>Created</ListHeaderCell>
					<ListHeaderCell class="justify-end">Original</ListHeaderCell>
					<ListHeaderCell class="justify-end">Compressed</ListHeaderCell>
					<ListHeaderCell />
				</ListHeader>
				<ListRows v-slot="{ item: job }" :items="jobs">
					<ListRow :value="job.name" class="min-h-12" data-testid="tools-job-row">
						<ListCell>
							<div class="min-w-0">
								<p class="truncate text-base text-ink-gray-8">
									{{ job.original_file_name }}
								</p>
								<p class="mt-0.5 truncate text-sm text-ink-gray-5 sm:hidden">
									{{ mobileMeta(job) }}
								</p>
								<div v-if="isActive(job.status)" class="mt-1.5 w-40">
									<Progress :value="job.progress || 0" size="sm" />
								</div>
							</div>
						</ListCell>
						<ListCell class="max-sm:hidden">
							<Badge :label="statusLabel(job)" :theme="statusTheme(job.status)" />
						</ListCell>
						<ListCell class="text-sm max-sm:hidden">
							<RelativeTime :date="job.creation" />
						</ListCell>
						<ListCell
							class="justify-end text-sm text-ink-gray-7 tabular-nums max-sm:hidden"
						>
							{{ formatBytes(job.original_size) }}
						</ListCell>
						<ListCell
							class="justify-end text-sm text-ink-gray-7 tabular-nums max-sm:hidden"
						>
							<template v-if="job.compressed_size">
								{{ formatBytes(job.compressed_size) }}
								<span class="ml-1 text-ink-green-3">−{{ savings(job) }}%</span>
							</template>
							<span v-else>—</span>
						</ListCell>
						<ListCell class="justify-end" @click.stop>
							<Button
								v-if="job.status === 'Complete'"
								icon="lucide-download"
								label="Download"
								variant="ghost"
								:loading="downloading === job.name"
								@click="download(job.name)"
							/>
							<Tooltip
								v-else-if="job.status === 'Error'"
								:text="errors[job.name] || 'Compression failed'"
							>
								<span
									class="lucide-circle-alert size-4 text-ink-red-4"
									aria-hidden="true"
								/>
							</Tooltip>
						</ListCell>
					</ListRow>
				</ListRows>
			</List>

			<div
				v-if="jobs.length < total"
				class="mt-4 flex flex-wrap items-center justify-center gap-3"
				data-testid="tools-load-more"
			>
				<span class="text-sm text-ink-gray-5">{{ jobs.length }} of {{ total }}</span>
				<ErrorMessage v-if="jobsCall.error" :message="jobsCall.error" />
				<Button
					:label="jobsCall.error ? 'Try again' : 'Load more'"
					:loading="jobsCall.loading"
					@click="loadMore"
				/>
			</div>
		</template>
	</div>

	<Dialog
		v-model:open="dialogOpen"
		title="Compress video"
		size="md"
		:dismissable="!uploading"
		:actions="dialogActions"
	>
		<div class="space-y-4">
			<UploadDropArea v-if="!file" singular @files="chooseFile($event[0])" />
			<div v-else class="flex items-center gap-3 rounded-lg border border-outline-gray-1 p-3">
				<span
					class="lucide-file-video size-5 shrink-0 text-ink-gray-5"
					aria-hidden="true"
				/>
				<div class="min-w-0 flex-1">
					<p class="truncate text-base-medium text-ink-gray-8">{{ file.name }}</p>
					<p class="text-sm text-ink-gray-5">{{ formatBytes(file.size) }}</p>
					<Progress v-if="uploading" :value="uploadProgress" size="sm" class="mt-2" />
				</div>
				<Button
					v-if="!uploading"
					icon="lucide-x"
					label="Remove file"
					variant="ghost"
					@click="file = null"
				/>
			</div>
			<p class="text-sm text-ink-gray-5">
				The video is re-encoded to H.264 MP4 at a lower bitrate. Progress shows in the jobs
				list.
			</p>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	Progress,
	Tooltip,
	toast,
	useCall,
	usePageMeta,
} from 'frappe-ui'
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
import type { CompressJob, CompressJobStatus, CompressStatus } from '@/types'
import { formatBytes, serverMessage } from '@/lib/format'
import { isAbortError, uploadSinglePut } from '@/composables/useUpload'
import { onRealtime } from '@/composables/useRealtime'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import UploadDropArea from '@/components/upload/UploadDropArea.vue'

usePageMeta(() => ({ title: 'Tools · VMS' }))

const PAGE_SIZE = 20
const POLL_MS = 5000
const COLUMNS = ['minmax(10rem,1fr)', '7rem', '8rem', '6rem', '9rem', 'auto']
const ACTIVE_STATUSES: CompressJobStatus[] = ['Queued', 'Uploading', 'Processing']

interface ToolUploadUrl {
	upload_url: string
	r2_key: string
}
interface StartParams {
	r2_key: string
	file_name: string
	file_size: number
}
interface JobsResponse {
	jobs: CompressJob[]
	total: number
}
interface JobsParams {
	page: number
	page_size: number
}
type ProgressEvent = Pick<
	CompressStatus,
	'job_name' | 'status' | 'progress' | 'compressed_size' | 'error_message'
>

const jobs = ref<CompressJob[]>([])
const total = ref(0)
const page = ref(1)
const errors = reactive<Record<string, string>>({})
const downloading = ref('')

const dialogOpen = ref(false)
const file = ref<File | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
let controller: AbortController | null = null

const jobsCall = useCall<JobsResponse, JobsParams>({
	url: '/api/v2/method/vms.tools_api.get_compress_jobs',
	method: 'GET',
	params: () => ({ page: page.value, page_size: PAGE_SIZE }),
	cacheKey: 'compress-jobs',
	onSuccess: (data) => {
		total.value = data.total
		jobs.value = page.value === 1 ? data.jobs : [...jobs.value, ...data.jobs]
	},
})
const uploadUrlCall = useCall<ToolUploadUrl, { file_name: string; content_type: string }>({
	url: '/api/v2/method/vms.tools_api.get_tool_upload_url',
	method: 'POST',
	immediate: false,
})
const startCall = useCall<{ job_name: string; status: string }, StartParams>({
	url: '/api/v2/method/vms.tools_api.start_compression',
	method: 'POST',
	immediate: false,
})
const statusCall = useCall<CompressStatus, { job_name: string }>({
	url: '/api/v2/method/vms.tools_api.get_compress_status',
	method: 'GET',
	immediate: false,
})
const downloadCall = useCall<{ url: string; file_name: string }, { job_name: string }>({
	url: '/api/v2/method/vms.tools_api.get_compress_download_url',
	method: 'POST',
	immediate: false,
})

const activeJobs = computed(() => jobs.value.filter((job) => isActive(job.status)))
const dialogActions = computed(() => [
	{
		label: 'Compress',
		variant: 'solid' as const,
		disabled: !file.value || uploading.value,
		onClick: compress,
	},
	{ label: uploading.value ? 'Cancel upload' : 'Cancel', onClick: cancel },
])

function isActive(status: CompressJobStatus) {
	return ACTIVE_STATUSES.includes(status)
}

function reload() {
	page.value = 1
	return jobsCall.reload()
}

function loadMore() {
	page.value += 1
	void jobsCall.reload()
}

function openCompress() {
	file.value = null
	uploadProgress.value = 0
	dialogOpen.value = true
}

function chooseFile(candidate?: File) {
	if (!candidate) return
	if (!candidate.type.startsWith('video/') && !/\.(mkv|avi|m4v)$/i.test(candidate.name)) {
		toast.error('Choose a video file')
		return
	}
	file.value = candidate
}

async function compress({ close }: { close: () => void }) {
	const input = file.value
	if (!input || uploading.value) return
	uploading.value = true
	uploadProgress.value = 0
	controller = new AbortController()
	try {
		const signed = await uploadUrlCall.submit({
			file_name: input.name,
			content_type: input.type || 'video/mp4',
		})
		if (!signed) throw new Error('Could not prepare upload')
		await uploadSinglePut(
			input,
			signed.upload_url,
			(p) => (uploadProgress.value = p),
			controller.signal,
		)
		await startCall.submit({
			r2_key: signed.r2_key,
			file_name: input.name,
			file_size: input.size,
		})
		toast.success('Compression started')
		file.value = null
		close()
		await reload()
	} catch (error) {
		if (!isAbortError(error)) toast.error(serverMessage(error) || 'Could not start compression')
	} finally {
		uploading.value = false
		controller = null
	}
}

function cancel({ close }: { close: () => void }) {
	if (uploading.value) controller?.abort()
	else close()
}

function applyStatus(update: ProgressEvent) {
	const job = jobs.value.find((j) => j.name === update.job_name)
	if (!job) return
	const wasActive = isActive(job.status)
	job.status = update.status as CompressJobStatus
	job.progress = update.progress ?? job.progress
	if (update.compressed_size) job.compressed_size = update.compressed_size
	if (update.error_message) errors[job.name] = update.error_message
	if (wasActive && job.status === 'Complete')
		toast.success(`Compressed ${job.original_file_name}`)
	if (wasActive && job.status === 'Error')
		toast.error(`Could not compress ${job.original_file_name}`)
}

async function refreshActive() {
	for (const job of activeJobs.value) {
		try {
			const latest = await statusCall.submit({ job_name: job.name })
			if (latest) applyStatus(latest)
		} catch {
			// Transient; the next poll or realtime event catches up.
		}
	}
}

async function download(jobName: string) {
	downloading.value = jobName
	try {
		const result = await downloadCall.submit({ job_name: jobName })
		if (!result) return
		const link = document.createElement('a')
		link.href = result.url
		link.download = result.file_name
		document.body.appendChild(link)
		link.click()
		link.remove()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not download file')
	} finally {
		downloading.value = ''
	}
}

function mobileMeta(job: CompressJob) {
	const sizes = job.compressed_size
		? `${formatBytes(job.original_size)} → ${formatBytes(job.compressed_size)}`
		: formatBytes(job.original_size)
	return `${job.status} · ${sizes}`
}

function statusLabel(job: CompressJob) {
	return job.status === 'Processing' ? `Processing ${job.progress || 0}%` : job.status
}

function statusTheme(status: CompressJobStatus) {
	if (status === 'Complete') return 'green'
	if (status === 'Error') return 'red'
	if (status === 'Processing' || status === 'Uploading') return 'blue'
	return 'gray'
}

function savings(job: CompressJob) {
	if (!job.original_size) return 0
	return Math.max(0, Math.round((1 - job.compressed_size / job.original_size) * 100))
}

onRealtime<ProgressEvent>('compress_progress', applyStatus)

let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
	poll = setInterval(() => {
		if (activeJobs.value.length) void refreshActive()
	}, POLL_MS)
})
onBeforeUnmount(() => {
	if (poll) clearInterval(poll)
	controller?.abort()
})
</script>
