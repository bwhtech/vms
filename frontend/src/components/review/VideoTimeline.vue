<template>
	<div class="px-3 py-2">
		<div
			ref="track"
			class="relative h-2 cursor-pointer rounded-full bg-surface-gray-3"
			role="slider"
			tabindex="0"
			aria-label="Video position"
			:aria-valuemin="0"
			:aria-valuemax="Math.round(duration)"
			:aria-valuenow="Math.round(currentTime)"
			@click="seekFromPointer"
			@keydown.left.prevent="$emit('seek', Math.max(0, currentTime - 1))"
			@keydown.right.prevent="$emit('seek', Math.min(duration, currentTime + 1))"
		>
			<div
				class="absolute inset-y-0 left-0 rounded-full bg-surface-gray-7"
				:style="progressStyle"
			/>
			<span
				class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-gray-9 shadow-sm"
				:style="progressLeft"
			/>

			<Tooltip v-for="comment in markers" :key="comment.name" :text="markerLabel(comment)">
				<button
					type="button"
					class="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-outline-amber-5 bg-surface-amber-6 transition-transform hover:scale-150"
					:style="{ left: `${markerPosition(comment.video_timestamp ?? 0)}%` }"
					:aria-label="markerLabel(comment)"
					@click.stop="$emit('comment', comment)"
				/>
			</Tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Tooltip } from 'frappe-ui'
import type { ReviewComment } from '@/types'
import { formatTimestamp } from '@/composables/useVideoPlayer'

const props = defineProps<{
	currentTime: number
	duration: number
	comments: ReviewComment[]
}>()

const emit = defineEmits<{
	seek: [time: number]
	comment: [comment: ReviewComment]
}>()

const track = ref<HTMLElement | null>(null)
const progress = computed(() =>
	props.duration > 0 ? (props.currentTime / props.duration) * 100 : 0,
)
const progressStyle = computed(() => ({ width: `${progress.value}%` }))
const progressLeft = computed(() => ({ left: `${progress.value}%` }))
const markers = computed(() =>
	props.comments.filter((comment) => comment.video_timestamp != null && !comment.parent_comment),
)

function seekFromPointer(event: MouseEvent) {
	if (!track.value || !props.duration) return
	const bounds = track.value.getBoundingClientRect()
	const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
	emit('seek', ratio * props.duration)
}

function markerPosition(time: number) {
	return props.duration > 0 ? Math.min(100, Math.max(0, (time / props.duration) * 100)) : 0
}

function markerLabel(comment: ReviewComment) {
	const text = comment.comment_text.replace(/<[^>]*>/g, '').trim()
	const summary = text.length > 40 ? `${text.slice(0, 40)}…` : text
	return `${formatTimestamp(comment.video_timestamp ?? 0)} — ${summary}`
}
</script>
