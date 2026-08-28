<template>
	<Dialog
		:open="review.panels.youtube.value"
		title="Upload to YouTube"
		size="md"
		:dismissible="!isActive"
		@update:open="handleOpenChange"
	>
		<div v-if="channels.loading && !channels.data" class="grid place-items-center py-10">
			<LoadingIndicator class="text-ink-gray-5" />
		</div>
		<div v-else-if="!connected && !hasUpload" class="py-8 text-center">
			<span class="lucide-youtube size-10 text-ink-gray-4" aria-hidden="true" />
			<p class="mt-3 text-base-medium text-ink-gray-8">YouTube is not connected</p>
			<p class="mt-2 text-p-sm text-ink-gray-5">
				Connect a channel in Settings before publishing this video.
			</p>
			<Button class="mt-4" variant="solid" label="Open settings" @click="openSettings" />
		</div>
		<div v-else-if="isActive" class="space-y-5 py-3">
			<div class="flex items-start gap-3 rounded bg-surface-blue-1 p-3">
				<span class="lucide-loader-circle mt-0.5 size-4 animate-spin text-ink-blue-6" />
				<div>
					<p class="text-base-medium text-ink-gray-8">{{ stageLabel }}</p>
					<p class="mt-1 text-p-sm text-ink-gray-5">Publishing to {{ channelName }}</p>
				</div>
			</div>
			<div>
				<div class="mb-2 flex justify-between text-sm text-ink-gray-5">
					<span>{{ uploadStatus }}</span>
					<span>{{ progress }}%</span>
				</div>
				<Progress :value="progress" size="lg" />
			</div>
			<p class="text-center text-p-xs text-ink-gray-5">
				You can close this dialog. The upload continues in the background.
			</p>
		</div>
		<div v-else-if="uploadStatus === 'Complete'" class="space-y-4 py-2">
			<div class="flex items-center gap-3 rounded bg-surface-green-1 p-3">
				<span class="lucide-circle-check size-5 text-ink-green-6" />
				<div>
					<p class="text-base-medium text-ink-gray-8">Upload complete</p>
					<p class="mt-1 text-p-sm text-ink-gray-5">Published to {{ channelName }}</p>
				</div>
			</div>
			<dl class="space-y-2 rounded border border-outline-gray-2 p-3 text-p-sm">
				<div
					v-for="row in metadataRows(
						publishedTitle,
						publishedDescription,
						publishedPrivacy,
					)"
					:key="row.label"
					class="flex gap-3"
				>
					<dt class="w-20 shrink-0 text-ink-gray-5">{{ row.label }}</dt>
					<dd class="min-w-0 whitespace-pre-wrap break-words text-ink-gray-8">
						{{ row.value }}
					</dd>
				</div>
			</dl>
		</div>
		<div v-else-if="uploadStatus === 'Error'" class="space-y-4 py-2">
			<div class="flex items-start gap-3 rounded bg-surface-red-1 p-3">
				<span class="lucide-circle-alert mt-0.5 size-5 text-ink-red-6" />
				<div class="min-w-0">
					<p class="text-base-medium text-ink-gray-8">Upload failed</p>
					<p class="mt-1 break-words text-p-sm text-ink-gray-5">
						{{ uploadError || 'YouTube could not complete the upload.' }}
					</p>
				</div>
			</div>
			<dl class="space-y-2 rounded border border-outline-gray-2 p-3 text-p-sm">
				<div
					v-for="row in metadataRows(targetTitle, targetDescription, targetPrivacy)"
					:key="row.label"
					class="flex gap-3"
				>
					<dt class="w-20 shrink-0 text-ink-gray-5">{{ row.label }}</dt>
					<dd class="min-w-0 whitespace-pre-wrap break-words text-ink-gray-8">
						{{ row.value }}
					</dd>
				</div>
			</dl>
		</div>
		<div v-else class="space-y-4">
			<Select
				v-model="selectedChannel"
				label="Channel"
				:options="channelOptions"
				placeholder="Choose a channel"
				empty-text="No channels connected"
			/>
			<FormControl v-model="title" label="Title" required :maxlength="100" />
			<FormControl
				v-model="description"
				type="textarea"
				label="Description"
				placeholder="Optional description"
				:rows="4"
			/>
			<Select v-model="privacy" label="Privacy" :options="privacyOptions" />
		</div>

		<template #actions>
			<div class="flex w-full justify-end gap-2">
				<template v-if="isActive">
					<Button label="Close" @click="close" />
				</template>
				<template v-else-if="uploadStatus === 'Complete'">
					<Button
						v-if="videoUrl"
						variant="outline"
						icon-left="lucide-external-link"
						label="View on YouTube"
						:link="videoUrl"
					/>
					<Button label="Upload another" :loading="reset.loading" @click="resetUpload" />
					<Button variant="solid" label="Done" @click="close" />
				</template>
				<template v-else-if="uploadStatus === 'Error'">
					<Button label="Start over" :loading="reset.loading" @click="resetUpload" />
					<Button label="Close" @click="close" />
					<Button
						variant="solid"
						label="Retry"
						:loading="upload.loading"
						@click="startUpload"
					/>
				</template>
				<template v-else-if="connected">
					<Button label="Cancel" :disabled="upload.loading" @click="close" />
					<Button
						variant="solid"
						label="Upload"
						:loading="upload.loading"
						@click="startUpload"
					/>
				</template>
				<Button v-else label="Close" @click="close" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import {
	Button,
	Dialog,
	FormControl,
	LoadingIndicator,
	Progress,
	Select,
	toast,
	useCall,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import { getSocket, onRealtime } from '@/composables/useRealtime'
import { useReview } from '@/composables/useReview'

interface YouTubeChannel {
	name: string
	channel_name: string
	is_default: number
}

interface YouTubeStatus {
	youtube_upload_status: string
	youtube_video_id: string
	youtube_video_url: string
	youtube_channel: string
	youtube_channel_name: string
	youtube_title: string
	youtube_description: string
	youtube_privacy: string
}

interface ProgressEvent {
	asset_name: string
	stage: string
	percent: number
	video_url?: string
	error?: string
}

const privacyOptions = [
	{ label: 'Unlisted', value: 'unlisted' },
	{ label: 'Public', value: 'public' },
	{ label: 'Private', value: 'private' },
]

const review = useReview()
const router = useRouter()
const asset = review.asset.value!
const assetName = asset.name
const title = ref(fileTitle(asset.file_name))
const description = ref('')
const privacy = ref('unlisted')
const selectedChannel = ref('')
const uploadStatus = ref(asset.youtube_upload_status ?? '')
const stage = ref(uploadStatus.value === 'Queued' ? 'queued' : '')
const progress = ref(0)
const uploadError = ref('')
const videoUrl = ref(asset.youtube_video_url ?? '')
const publishedChannel = ref(asset.youtube_channel ?? '')
const publishedChannelName = ref(asset.youtube_channel_name ?? '')
const publishedTitle = ref(asset.youtube_title ?? '')
const publishedDescription = ref(asset.youtube_description ?? '')
const publishedPrivacy = ref(asset.youtube_privacy ?? '')

const channels = useCall<YouTubeChannel[]>({
	url: '/api/v2/method/vms.youtube.get_youtube_channels',
	method: 'GET',
	cacheKey: ['youtube-channels'],
})
const status = useCall<YouTubeStatus, { asset_name: string }>({
	url: '/api/v2/method/vms.youtube.get_youtube_upload_status',
	method: 'GET',
	params: { asset_name: assetName },
	cacheKey: ['youtube-upload-status', assetName],
	onSuccess: applyStatus,
})
const upload = useCall<
	unknown,
	{
		asset_name: string
		title: string
		description: string
		privacy_status: string
		channel: string
	}
>({ url: '/api/v2/method/vms.youtube.upload_to_youtube', method: 'POST', immediate: false })
const reset = useCall<unknown, { asset_name: string }>({
	url: '/api/v2/method/vms.youtube.reset_youtube_upload',
	method: 'POST',
	immediate: false,
})

const connected = computed(() => Boolean(channels.data?.length))
const isActive = computed(
	() => uploadStatus.value === 'Queued' || uploadStatus.value === 'Uploading',
)
const hasUpload = computed(() => Boolean(uploadStatus.value))
const channelOptions = computed(() =>
	(channels.data ?? []).map((channel) => ({ label: channel.channel_name, value: channel.name })),
)
const channelName = computed(
	() =>
		publishedChannelName.value ||
		channels.data?.find((channel) => channel.name === targetChannel.value)?.channel_name ||
		'YouTube',
)
const targetChannel = computed(() => {
	if (
		hasUpload.value &&
		channels.data?.some((channel) => channel.name === publishedChannel.value)
	) {
		return publishedChannel.value
	}
	return selectedChannel.value || channels.data?.[0]?.name || ''
})
const targetTitle = computed(() => (hasUpload.value && publishedTitle.value) || title.value.trim())
const targetDescription = computed(() =>
	hasUpload.value ? publishedDescription.value : description.value.trim(),
)
const targetPrivacy = computed(() => (hasUpload.value && publishedPrivacy.value) || privacy.value)
const stageLabel = computed(() => {
	if (stage.value === 'downloading') return 'Downloading from storage'
	if (stage.value === 'uploading') return 'Uploading to YouTube'
	if (stage.value === 'queued') return 'Waiting to start'
	return 'Preparing upload'
})

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(isActive, (active) => (active ? startPolling() : stopPolling()), { immediate: true })
watch(
	() => review.panels.youtube.value,
	(open) => {
		if (!open) return
		void channels.reload()
		void status.reload()
		if (!hasUpload.value) resetForm()
	},
)

onRealtime<ProgressEvent>('youtube_upload_progress', (event) => {
	if (event.asset_name !== assetName) return
	stage.value = event.stage
	progress.value = event.percent
	if (event.stage === 'complete') {
		uploadStatus.value = 'Complete'
		videoUrl.value = event.video_url ?? ''
		stopPolling()
		review.reload()
		void status.reload()
	} else if (event.stage === 'error') {
		uploadStatus.value = 'Error'
		uploadError.value = event.error ?? 'Upload failed'
		stopPolling()
		review.reload()
	} else {
		uploadStatus.value = 'Uploading'
	}
})

onMounted(() => getSocket().emit('doc_subscribe', 'VMS Asset', assetName))
onScopeDispose(() => {
	stopPolling()
	getSocket().emit('doc_unsubscribe', 'VMS Asset', assetName)
})

async function startUpload() {
	if (!targetTitle.value) return toast.error('Title is required')
	if (!targetChannel.value) return toast.error('Choose a YouTube channel')
	try {
		await upload.submit({
			asset_name: assetName,
			title: targetTitle.value,
			description: targetDescription.value,
			privacy_status: targetPrivacy.value,
			channel: targetChannel.value,
		})
		publishedChannel.value = targetChannel.value
		publishedChannelName.value = channelName.value
		publishedTitle.value = targetTitle.value
		publishedDescription.value = targetDescription.value
		publishedPrivacy.value = targetPrivacy.value
		uploadStatus.value = 'Queued'
		stage.value = 'queued'
		progress.value = 0
		uploadError.value = ''
		videoUrl.value = ''
		startPolling()
		review.reload()
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not start the YouTube upload')
	}
}

async function resetUpload() {
	try {
		await reset.submit({ asset_name: assetName })
		uploadStatus.value = ''
		stage.value = ''
		progress.value = 0
		uploadError.value = ''
		videoUrl.value = ''
		publishedChannel.value = ''
		publishedChannelName.value = ''
		publishedTitle.value = ''
		publishedDescription.value = ''
		publishedPrivacy.value = ''
		resetForm()
		review.reload()
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not reset the YouTube upload')
	}
}

function applyStatus(data: YouTubeStatus) {
	uploadStatus.value = data.youtube_upload_status
	videoUrl.value = data.youtube_video_url
	publishedChannel.value = data.youtube_channel
	publishedChannelName.value = data.youtube_channel_name
	publishedTitle.value = data.youtube_title
	publishedDescription.value = data.youtube_description
	publishedPrivacy.value = data.youtube_privacy
	if (data.youtube_upload_status === 'Uploading' && !stage.value) stage.value = 'uploading'
	if (!isActive.value) stopPolling()
}

function resetForm() {
	title.value = fileTitle(asset.file_name)
	description.value = ''
	privacy.value = 'unlisted'
	selectedChannel.value = channels.data?.[0]?.name ?? ''
}

function startPolling() {
	if (pollTimer) return
	void status.reload()
	pollTimer = setInterval(() => void status.reload(), 5000)
}

function stopPolling() {
	if (!pollTimer) return
	clearInterval(pollTimer)
	pollTimer = null
}

function handleOpenChange(open: boolean) {
	if (!open && isActive.value) return
	review.panels.youtube.value = open
}

function close() {
	review.panels.youtube.value = false
}

function openSettings() {
	close()
	void router.push({ path: '/', query: { settings: 'youtube' } })
}

function fileTitle(fileName: string): string {
	return fileName.replace(/\.[^/.]+$/, '')
}

function metadataRows(title: string, description: string, privacy: string) {
	const privacyLabel = privacyOptions.find((option) => option.value === privacy)?.label ?? privacy
	return [
		{ label: 'Title', value: title },
		{ label: 'Description', value: description },
		{ label: 'Privacy', value: privacyLabel },
	].filter((row) => Boolean(row.value))
}
</script>
