<template>
	<PageHeader>
		<PageHeaderTitle><h1 class="truncate">Tools</h1></PageHeaderTitle>
	</PageHeader>

	<div class="space-y-6 px-3 py-5 pb-10 sm:px-5" data-testid="tools-page">
		<Tabs model-value="compress" :tabs="[{ label: 'Compress', value: 'compress' }]" />

		<div class="rounded-lg border border-outline-gray-1 bg-surface-base p-4 sm:p-6">
			<div v-if="!activeStatus" class="space-y-4">
				<button
					type="button"
					class="flex min-h-52 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-gray-2 px-6 text-center transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
					:class="dragging && 'border-blue-400 bg-surface-blue-1'"
					@click="fileInput?.click()"
					@dragenter.prevent="dragging = true"
					@dragover.prevent
					@dragleave.prevent="dragging = false"
					@drop.prevent="onDrop"
				>
					<input ref="fileInput" class="hidden" type="file" accept="video/*,.mkv,.avi" @change="onFileInput" />
					<span :class="file ? 'lucide-file-video' : 'lucide-upload-cloud'" class="size-8 text-ink-gray-4" aria-hidden="true" />
					<template v-if="file">
						<span class="max-w-full truncate text-base-medium text-ink-gray-8">{{ file.name }}</span>
						<span class="text-sm text-ink-gray-5">{{ formatBytes(file.size) }}</span>
					</template>
					<template v-else>
						<span class="text-base-medium text-ink-gray-8">Drop a video here or browse</span>
						<span class="text-sm text-ink-gray-5">MP4, MOV, MKV, AVI, or WebM</span>
					</template>
				</button>

				<div v-if="uploading" class="space-y-1">
					<div class="flex justify-between text-sm text-ink-gray-6"><span>Uploading</span><span>{{ uploadProgress }}%</span></div>
					<Progress :value="uploadProgress" />
				</div>

				<div class="flex justify-end gap-2">
					<Button v-if="uploading" label="Cancel" variant="ghost" @click="cancelUpload" />
					<Button label="Compress" variant="solid" :disabled="!file || uploading" :loading="uploading" @click="compress" />
				</div>
			</div>

			<div v-else class="space-y-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="lucide-file-video size-5 text-ink-gray-5" aria-hidden="true" />
							<h2 class="truncate text-base-semibold text-ink-gray-8">{{ activeStatus.original_file_name }}</h2>
						</div>
						<p class="mt-1 text-sm text-ink-gray-5">{{ formatBytes(activeStatus.original_size) }}</p>
					</div>
					<Badge :label="activeStatus.status" :theme="statusTheme(activeStatus.status)" />
				</div>
				<div v-if="!terminal" class="space-y-1">
					<div class="flex justify-between text-sm text-ink-gray-6"><span>Compressing</span><span>{{ activeStatus.progress || 0 }}%</span></div>
					<Progress :value="activeStatus.progress || 0" />
				</div>
				<div v-else-if="activeStatus.status === 'Complete'" class="rounded bg-surface-green-1 p-3 text-sm text-ink-green-3">
					Compressed to {{ formatBytes(activeStatus.compressed_size) }}
				</div>
				<ErrorMessage v-else :message="activeStatus.error_message || 'Compression failed'" />
				<div class="flex justify-end gap-2">
					<Button label="Compress another" icon-left="lucide-rotate-ccw" variant="ghost" @click="reset" />
					<Button v-if="activeStatus.status === 'Complete'" label="Download" icon-left="lucide-download" variant="solid" :loading="downloading === activeStatus.job_name" @click="download(activeStatus.job_name)" />
				</div>
			</div>
		</div>

		<section class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="text-base-semibold text-ink-gray-8">Recent jobs</h2>
				<span class="text-sm text-ink-gray-5">{{ jobsTotal }} total</span>
			</div>
			<LoadingText v-if="jobsResource.loading && !jobs.length" :lines="4" />
			<ErrorMessage v-else-if="jobsResource.error" :message="jobsResource.error" />
			<EmptyState v-else-if="!jobs.length" icon="lucide-file-archive" title="No compression jobs" description="Choose a video above to create your first compressed copy." />
			<List v-else :columns="JOB_COLUMNS" class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5">
				<ListHeader>
					<ListHeaderCell>File</ListHeaderCell>
					<ListHeaderCell>Status</ListHeaderCell>
					<ListHeaderCell>Created</ListHeaderCell>
					<ListHeaderCell align="end">Original</ListHeaderCell>
					<ListHeaderCell align="end">Compressed</ListHeaderCell>
					<ListHeaderCell />
				</ListHeader>
				<ListRows :items="jobs" row-key="name">
					<template #default="{ item }">
						<ListRow :value="item.name">
							<ListCell><span class="truncate text-base-medium text-ink-gray-8">{{ item.original_file_name }}</span></ListCell>
							<ListCell><Badge :label="item.status" :theme="statusTheme(item.status)" /></ListCell>
							<ListCell><span class="text-sm text-ink-gray-5">{{ fromNow(item.creation) }}</span></ListCell>
							<ListCell class="justify-end"><span class="text-sm tabular-nums text-ink-gray-6">{{ formatBytes(item.original_size) }}</span></ListCell>
							<ListCell class="justify-end"><span class="text-sm tabular-nums text-ink-gray-6">{{ item.compressed_size ? formatBytes(item.compressed_size) : '—' }}</span></ListCell>
							<ListCell class="justify-end">
								<Button v-if="item.status === 'Complete'" icon="lucide-download" label="Download" variant="ghost" :loading="downloading === item.name" @click="download(item.name)" />
								<Button v-else icon="lucide-eye" label="View progress" variant="ghost" @click="showJob(item)" />
							</ListCell>
						</ListRow>
					</template>
				</ListRows>
			</List>
			<div v-if="jobs.length < jobsTotal" class="flex justify-center">
				<Button label="Load more" :loading="jobsResource.loading" @click="jobLimit += PAGE_SIZE" />
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Badge, Button, ErrorMessage, LoadingText, PageHeader, PageHeaderTitle, Progress, Tabs, toast, useCall, usePageMeta } from 'frappe-ui'
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
import type { CompressJob, CompressStatus } from '@/types'
import { formatBytes, serverMessage } from '@/lib/format'
import { fromNow } from '@/lib/dates'
import { uploadSinglePut } from '@/composables/useUpload'
import { onRealtime } from '@/composables/useRealtime'
import EmptyState from '@/components/common/EmptyState.vue'

usePageMeta(() => ({ title: 'Tools · VMS' }))

const PAGE_SIZE = 10
const JOB_COLUMNS = ['minmax(10rem,1fr)', '7rem', '8rem', '6rem', '7rem', '5rem']
const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const controller = ref<AbortController | null>(null)
const activeStatus = ref<CompressStatus | null>(null)
const downloading = ref('')
const jobLimit = ref(PAGE_SIZE)

interface UploadUrl { upload_url: string; r2_key: string }
interface StartResult { job_name: string; status: string }
interface JobsResponse { jobs: CompressJob[]; total: number }
interface JobsParams { page: number; page_size: number }

const uploadUrl = useCall<UploadUrl, { file_name: string; content_type: string }>({ url: '/api/v2/method/vms.tools_api.get_tool_upload_url', method: 'POST', immediate: false })
const startCompression = useCall<StartResult, { r2_key: string; file_name: string; file_size: number }>({ url: '/api/v2/method/vms.tools_api.start_compression', method: 'POST', immediate: false })
const statusResource = useCall<CompressStatus, { job_name: string }>({ url: '/api/v2/method/vms.tools_api.get_compress_status', method: 'GET', immediate: false })
const downloadResource = useCall<{ url: string; file_name: string }, { job_name: string }>({ url: '/api/v2/method/vms.tools_api.get_compress_download_url', method: 'POST', immediate: false })
const jobsResource = useCall<JobsResponse, JobsParams>({
	url: '/api/v2/method/vms.tools_api.get_compress_jobs', method: 'GET',
	params: () => ({ page: 1, page_size: jobLimit.value }), refetch: true,
	cacheKey: ['compress-jobs', jobLimit],
})

const jobs = computed(() => jobsResource.data?.jobs ?? [])
const jobsTotal = computed(() => jobsResource.data?.total ?? 0)
const terminal = computed(() => activeStatus.value ? ['Complete', 'Error'].includes(activeStatus.value.status) : false)

function chooseFile(candidate?: File) {
	if (!candidate) return
	if (!candidate.type.startsWith('video/') && !/\.(mkv|avi)$/i.test(candidate.name)) {
		toast.error('Choose a supported video file')
		return
	}
	file.value = candidate
}

function onFileInput(event: Event) { chooseFile((event.target as HTMLInputElement).files?.[0]) }
function onDrop(event: DragEvent) { dragging.value = false; chooseFile(event.dataTransfer?.files[0]) }

async function compress() {
	const input = file.value
	if (!input) return
	uploading.value = true; uploadProgress.value = 0
	controller.value = new AbortController()
	try {
		const signed = await uploadUrl.submit({ file_name: input.name, content_type: input.type || 'video/mp4' })
		if (!signed) throw new Error('Could not prepare upload')
		await uploadSinglePut(input, signed.upload_url, (value) => { uploadProgress.value = value }, controller.value.signal)
		const started = await startCompression.submit({ r2_key: signed.r2_key, file_name: input.name, file_size: input.size })
		if (!started) throw new Error('Could not start compression')
		activeStatus.value = { job_name: started.job_name, status: 'Queued', progress: 0, original_file_name: input.name, original_size: input.size, compressed_size: 0, compressed_file_name: '', error_message: '' }
		file.value = null; uploadProgress.value = 0
		await jobsResource.reload()
		toast.success('Compression started')
	} catch (error) {
		if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(serverMessage(error) || (error instanceof Error ? error.message : 'Compression could not start'))
	} finally { uploading.value = false; controller.value = null }
}

function cancelUpload() { controller.value?.abort() }
function reset() { activeStatus.value = null; file.value = null; uploadProgress.value = 0 }

async function refreshStatus() {
	const name = activeStatus.value?.job_name
	if (!name || terminal.value) return
	const latest = await statusResource.submit({ job_name: name })
	if (latest) activeStatus.value = latest
	if (latest && ['Complete', 'Error'].includes(latest.status)) await jobsResource.reload()
}

function showJob(job: CompressJob) {
	activeStatus.value = { job_name: job.name, status: job.status, progress: job.progress, original_file_name: job.original_file_name, original_size: job.original_size, compressed_size: job.compressed_size, compressed_file_name: '', error_message: '' }
	void refreshStatus()
}

async function download(jobName: string) {
	downloading.value = jobName
	try {
		const result = await downloadResource.submit({ job_name: jobName })
		if (!result) return
		const link = document.createElement('a'); link.href = result.url; link.download = result.file_name
		document.body.appendChild(link); link.click(); link.remove()
	} catch (error) { toast.error(serverMessage(error) || 'Could not download file') }
	finally { downloading.value = '' }
}

function statusTheme(status: string) {
	if (status === 'Complete') return 'green'
	if (status === 'Error') return 'red'
	if (status === 'Processing' || status === 'Uploading') return 'blue'
	return 'gray'
}

onRealtime<Partial<CompressStatus> & { job_name: string }>('compress_progress', (payload) => {
	if (payload.job_name !== activeStatus.value?.job_name) return
	activeStatus.value = { ...activeStatus.value, ...payload }
	if (payload.status === 'Complete' || payload.status === 'Error') {
		void jobsResource.reload()
		toast[payload.status === 'Complete' ? 'success' : 'error'](payload.status === 'Complete' ? 'Compression complete' : 'Compression failed')
	}
})

let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => { poll = setInterval(() => { void refreshStatus() }, 5000) })
onBeforeUnmount(() => { if (poll) clearInterval(poll); controller.value?.abort() })
</script>
