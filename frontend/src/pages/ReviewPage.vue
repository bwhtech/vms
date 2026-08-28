<template>
	<div
		class="flex h-screen flex-col bg-surface-base"
		tabindex="-1"
		@keydown.esc="closeAnnotation"
	>
		<template v-if="review.asset.value">
			<ReviewHeader
				:asset="review.asset.value"
				:proxy-status="proxyStatus"
				:generating-proxy="generateProxy.loading"
				:toggling-public="togglePublic.loading"
				@toggle-public="setPublicReview"
				@generate-proxy="startProxyGeneration"
			/>

			<div
				class="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden"
			>
				<div
					class="flex min-h-[14rem] shrink-0 p-2 md:min-h-0 md:flex-1 md:p-4"
					@click="dismissReplay"
				>
					<ImageViewer
						v-if="review.asset.value.file_type?.startsWith('image/')"
						:asset-name="review.asset.value.name"
					/>
					<VideoPlayer
						v-else
						:asset-name="review.asset.value.name"
						:prefer-proxy="proxyStatus === 'Ready'"
					/>
				</div>
				<div class="min-h-[50vh] flex-1 md:min-h-0 md:w-[22rem] md:flex-none">
					<CommentPanel />
				</div>
			</div>

			<VersionPanel />
			<TranscriptionPanel v-if="!review.isGuest.value" />
			<YouTubeUploadDialog v-if="!review.isGuest.value" />
			<SplitVideoDialog v-if="!review.isGuest.value" />
		</template>

		<div v-else-if="review.error.value" class="grid flex-1 place-items-center p-6 text-center">
			<EmptyState
				icon="lucide-link-2-off"
				title="This review link is invalid or has expired"
				description="Ask the owner to share a new review link."
			/>
		</div>
		<div v-else class="flex min-h-0 flex-1 flex-col" aria-busy="true">
			<div class="flex h-12 items-center gap-3 border-b border-outline-gray-1 px-4">
				<Skeleton class="size-6 rounded-4" />
				<Skeleton class="h-4 w-48 rounded-4" />
			</div>
			<div class="flex min-h-0 flex-1 flex-col md:flex-row">
				<div class="flex-1 p-4">
					<Skeleton class="h-full w-full rounded-6 bg-surface-gray-7" />
				</div>
				<div class="hidden md:block md:w-[22rem] md:border-l md:border-outline-gray-1" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Skeleton, toast, useCall, usePageMeta } from 'frappe-ui'
import ReviewHeader from '@/components/review/ReviewHeader.vue'
import VideoPlayer from '@/components/review/VideoPlayer.vue'
import ImageViewer from '@/components/review/ImageViewer.vue'
import CommentPanel from '@/components/review/CommentPanel.vue'
import VersionPanel from '@/components/review/VersionPanel.vue'
import TranscriptionPanel from '@/components/review/TranscriptionPanel.vue'
import YouTubeUploadDialog from '@/components/review/YouTubeUploadDialog.vue'
import SplitVideoDialog from '@/components/review/SplitVideoDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { onRealtime } from '@/composables/useRealtime'
import { provideReview } from '@/composables/useReview'

const props = defineProps<{ assetId: string }>()
const token = new URLSearchParams(window.location.search).get('token')
const review = provideReview({ assetId: props.assetId, token })

// A logged-out visitor without a share token cannot see anything here: send
// them to login instead of showing the "invalid link" state.
watch(
	() => Boolean(review.error.value) && review.isGuest.value && !token,
	(shouldLogin) => {
		if (!shouldLogin) return
		const redirect = encodeURIComponent(window.location.pathname)
		window.location.href = `/login?redirect-to=${redirect}`
	},
	{ immediate: true },
)
usePageMeta(() => ({ title: `${review.asset.value?.file_name ?? 'Review'} · VMS` }))

const realtimeProxyStatus = ref('')
const proxyStatus = computed(
	() => realtimeProxyStatus.value || review.asset.value?.proxy_status || '',
)

const togglePublic = useCall<unknown, { asset_name: string; enable: number }>({
	url: '/api/v2/method/vms.review_api.toggle_public_review',
	method: 'POST',
	immediate: false,
})
const generateProxy = useCall<unknown, { asset_name: string }>({
	url: '/api/v2/method/vms.proxy.generate_proxy',
	method: 'POST',
	immediate: false,
})
const proxyPoll = useCall<{ proxy_status: string }, { asset_name: string }>({
	url: '/api/v2/method/vms.proxy.get_proxy_status',
	method: 'GET',
	params: { asset_name: props.assetId },
	immediate: false,
	cacheKey: ['proxy-status', props.assetId],
	onSuccess: (data) => {
		realtimeProxyStatus.value = data.proxy_status
		if (data.proxy_status === 'Ready' || data.proxy_status === 'Error') stopPolling()
	},
})

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(
	() => review.asset.value?.proxy_status,
	(status) => {
		if (status === 'Processing') startPolling()
	},
	{ immediate: true },
)

onRealtime<{ asset_name: string; status: string; error_message?: string }>(
	'proxy_generation_progress',
	(payload) => {
		if (payload.asset_name !== props.assetId) return
		realtimeProxyStatus.value = payload.status
		if (payload.status === 'Ready') {
			stopPolling()
			toast.success('Streaming proxy ready')
			review.reload()
		} else if (payload.status === 'Error') {
			stopPolling()
			toast.error(payload.error_message || 'Streaming proxy generation failed')
		}
	},
)

async function setPublicReview(enabled: boolean) {
	try {
		await togglePublic.submit({ asset_name: props.assetId, enable: enabled ? 1 : 0 })
		review.reload()
		toast.success(enabled ? 'Public review enabled' : 'Public review disabled')
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not update review sharing')
	}
}

async function startProxyGeneration() {
	realtimeProxyStatus.value = ''
	try {
		await generateProxy.submit({ asset_name: props.assetId })
		startPolling()
		review.reload()
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not start proxy generation')
	}
}

function startPolling() {
	if (pollTimer || review.isGuest.value) return
	void proxyPoll.execute()
	pollTimer = setInterval(() => void proxyPoll.execute(), 5000)
}

function stopPolling() {
	if (!pollTimer) return
	clearInterval(pollTimer)
	pollTimer = null
}

function dismissReplay() {
	if (review.annotation.mode.value === 'view') review.annotation.clear()
}

function closeAnnotation() {
	if (review.annotation.mode.value !== 'off') review.annotation.clear()
}

onScopeDispose(stopPolling)
</script>
