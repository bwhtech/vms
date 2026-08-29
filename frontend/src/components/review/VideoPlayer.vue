<template>
	<div
		ref="container"
		class="relative flex w-full flex-col overflow-hidden rounded-6 bg-black md:h-full"
		:class="{ 'cursor-none': isFullscreen && !barVisible }"
		data-testid="review-video-player"
		@mousemove="revealBar"
		@mouseleave="hideBarNow"
	>
		<div
			ref="videoWrapper"
			class="relative flex min-h-0 flex-1 items-center justify-center bg-black"
		>
			<video
				ref="video"
				:src="view.data?.url"
				class="h-full w-full object-contain"
				playsinline
				@click="canvasActive ? undefined : player.togglePlay()"
			/>

			<div v-if="view.error" class="absolute inset-0 grid place-items-center p-6 text-center">
				<ErrorMessage message="This video could not be loaded." />
			</div>
			<Skeleton
				v-else-if="!view.data?.url"
				class="pointer-events-none absolute inset-0 rounded-none bg-surface-gray-7"
			/>

			<AnnotationCanvas
				:target="videoWrapper"
				:active="canvasActive"
				:read-only="review.annotation.mode.value === 'view'"
				:annotation-data="review.annotation.data.value"
			/>
		</div>

		<div
			class="shrink-0 border-t border-outline-gray-2 bg-surface-base transition-opacity duration-200"
			:class="
				isFullscreen
					? [
							'absolute inset-x-0 bottom-0 z-10',
							barVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
						]
					: ''
			"
			@mouseenter="holdBar"
			@mouseleave="revealBar"
		>
			<VideoTimeline
				class="hidden md:block"
				:current-time="player.currentTime.value"
				:duration="player.duration.value"
				:comments="review.comments.list.value"
				@seek="player.seek"
				@comment="openComment"
			/>
			<VideoControls
				:is-playing="player.isPlaying.value"
				:current-time="player.currentTime.value"
				:duration="player.duration.value"
				:volume="player.volume.value"
				:is-muted="player.isMuted.value"
				:playback-rate="player.playbackRate.value"
				:is-looping="player.isLooping.value"
				:is-fullscreen="isFullscreen"
				@toggle-play="player.togglePlay"
				@toggle-mute="player.toggleMute"
				@volume-change="player.setVolume"
				@playback-rate-change="player.setPlaybackRate"
				@toggle-loop="player.toggleLoop"
				@toggle-fullscreen="toggle"
				@skip-backward="player.seek(player.currentTime.value - 10)"
				@skip-forward="player.seek(player.currentTime.value + 10)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { ErrorMessage, Skeleton, providePortalTarget, useCall } from 'frappe-ui'
import type { AnnotationJson, ReviewComment, ViewUrlResponse } from '@/types'
import AnnotationCanvas from '@/components/review/AnnotationCanvas.vue'
import VideoControls from '@/components/review/VideoControls.vue'
import VideoTimeline from '@/components/review/VideoTimeline.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import { useReview } from '@/composables/useReview'
import { useVideoPlayer } from '@/composables/useVideoPlayer'

const props = withDefaults(defineProps<{ assetName: string; preferProxy?: boolean }>(), {
	preferProxy: false,
})

const review = useReview()
const container = ref<HTMLElement | null>(null)
const videoWrapper = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const player = useVideoPlayer(video)
const { isFullscreen, toggle } = useFullscreen(container, video)
const canvasActive = computed(() => review.annotation.mode.value !== 'off')

// Only the fullscreen element's subtree is painted while fullscreen is active,
// so every overlay below us (the speed menu, tooltips) has to teleport into the
// player instead of `body` — otherwise it opens invisibly.
providePortalTarget(() => (isFullscreen.value ? (container.value ?? undefined) : undefined))

const BAR_IDLE_MS = 2500
const barVisible = ref(true)
let idleTimer: ReturnType<typeof setTimeout> | undefined

/** The bar stays put while the video is paused, annotated, or windowed. */
function barMayHide() {
	return isFullscreen.value && player.isPlaying.value && !canvasActive.value
}

function revealBar() {
	barVisible.value = true
	clearTimeout(idleTimer)
	if (barMayHide()) idleTimer = setTimeout(() => (barVisible.value = false), BAR_IDLE_MS)
}

/** Pointer resting on the bar itself: keep it up indefinitely. */
function holdBar() {
	barVisible.value = true
	clearTimeout(idleTimer)
}

function hideBarNow() {
	clearTimeout(idleTimer)
	if (barMayHide()) barVisible.value = false
}

watch([isFullscreen, player.isPlaying, canvasActive], revealBar)
onScopeDispose(() => clearTimeout(idleTimer))

const view = useCall<ViewUrlResponse, { asset_name: string; token?: string }>({
	url: '/api/v2/method/vms.review_api.get_review_view_url',
	method: 'GET',
	params: {
		asset_name: props.assetName,
		...(review.token ? { token: review.token } : {}),
	},
	cacheKey: ['review-video-url', props.assetName, review.token ?? 'session'],
})

watch(
	video,
	(element) => {
		review.player.value = element
	},
	{ immediate: true },
)
watch(player.currentTime, (time) => {
	review.currentTime.value = time
})
watch(player.duration, (duration) => {
	review.duration.value = duration
})
watch(
	() => props.preferProxy,
	() => {
		void view.reload()
	},
)
watch(canvasActive, (active) => {
	if (active) video.value?.pause()
})

async function openComment(comment: ReviewComment) {
	const time = comment.video_timestamp ?? 0
	let raw = comment.annotation_data
	if (!raw && comment.has_annotation) {
		raw = (await review.comments.getAnnotation(comment.name))?.annotation_data ?? null
	}
	if (!raw) {
		player.seek(time)
		return
	}
	try {
		review.annotation.view(JSON.parse(raw) as AnnotationJson, time)
	} catch {
		player.seek(time)
	}
}

function handleShortcut(event: KeyboardEvent) {
	const target = event.target as HTMLElement | null
	if (target?.matches('input, textarea, [contenteditable="true"]')) return
	const element = video.value
	if (!element) return

	const handled = [
		'Space',
		'KeyJ',
		'KeyK',
		'KeyL',
		'ArrowLeft',
		'ArrowRight',
		'KeyF',
		'KeyM',
	].includes(event.code)
	if (handled) {
		event.preventDefault()
		revealBar()
	}

	if (event.code === 'Space' || event.code === 'KeyK') player.togglePlay()
	else if (event.code === 'KeyL') {
		player.setPlaybackRate(Math.min(8, element.playbackRate * 2))
		if (element.paused) void element.play()
	} else if (event.code === 'KeyJ') {
		element.pause()
		player.seek(player.currentTime.value - 1)
	} else if (event.code === 'ArrowLeft') {
		player.seek(player.currentTime.value - (event.shiftKey ? 10 / 30 : 1 / 30))
	} else if (event.code === 'ArrowRight') {
		player.seek(player.currentTime.value + (event.shiftKey ? 10 / 30 : 1 / 30))
	} else if (event.code === 'KeyF') toggle()
	else if (event.code === 'KeyM') player.toggleMute()
}

onMounted(() => document.addEventListener('keydown', handleShortcut))
onScopeDispose(() => document.removeEventListener('keydown', handleShortcut))
</script>
