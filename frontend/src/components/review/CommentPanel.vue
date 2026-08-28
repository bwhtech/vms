<template>
	<div
		class="flex h-full flex-col border-t border-outline-gray-1 bg-surface-base md:border-l md:border-t-0"
		data-testid="comment-panel"
	>
		<div
			class="flex items-center justify-between gap-2 border-b border-outline-gray-1 px-4 py-2.5"
		>
			<h3 class="text-base-semibold text-ink-gray-8">
				Comments<template v-if="threads.length"> ({{ threads.length }})</template>
			</h3>
			<div class="flex items-center gap-1">
				<Select
					v-if="assetVersion > 1"
					v-model="versionValue"
					variant="ghost"
					size="sm"
					:options="versionOptions"
				/>
				<Select
					v-model="comments.sortBy.value"
					variant="ghost"
					size="sm"
					class="w-24"
					aria-label="Sort comments"
					:options="sortOptions"
				/>
			</div>
		</div>

		<ScrollArea class="min-h-0 flex-1">
			<div class="py-2">
				<div
					v-if="comments.loading.value && !comments.list.value.length"
					class="space-y-4 px-4 py-3"
					aria-busy="true"
				>
					<div v-for="n in 3" :key="n" class="flex gap-3">
						<Skeleton class="size-7 shrink-0 rounded-full" />
						<div class="flex-1 space-y-2 py-1">
							<Skeleton class="h-3 w-1/3 rounded" />
							<Skeleton class="h-3 w-5/6 rounded" />
							<Skeleton class="h-3 w-1/2 rounded" />
						</div>
					</div>
				</div>
				<p
					v-else-if="!threads.length"
					class="px-4 py-8 text-center text-p-sm text-ink-gray-5"
				>
					{{ emptyMessage }}
				</p>
				<CommentItem
					v-for="thread in threads"
					v-else
					:key="thread.comment.name"
					:comment="thread.comment"
					:replies="thread.replies"
					@seek="review.seekTo"
					@reply="startReply"
					@resolve="resolveComment"
					@remove="removeComment"
					@edit="editComment"
					@view-annotation="viewAnnotation"
					@edit-annotation="editAnnotation"
				/>
			</div>
		</ScrollArea>

		<div class="border-t border-outline-gray-1 p-3">
			<div v-if="replyTo" class="mb-2 flex items-center gap-1 text-xs text-ink-gray-6">
				<span>
					Replying to
					<strong class="text-ink-gray-8">{{ replyTo.commenter_name }}</strong>
				</span>
				<Button
					variant="ghost"
					size="sm"
					icon="lucide-x"
					aria-label="Cancel reply"
					@click="replyTo = null"
				/>
			</div>

			<FormControl
				v-if="review.isGuest.value"
				v-model="review.guestName.value"
				class="mb-2"
				type="text"
				size="sm"
				placeholder="Your name"
				aria-label="Your name"
			/>

			<div class="mb-1.5 flex items-center gap-1.5">
				<Button
					:variant="attachTimestamp ? 'subtle' : 'ghost'"
					size="sm"
					icon-left="lucide-clock-3"
					:label="formatTimestamp(review.currentTime.value)"
					:aria-pressed="attachTimestamp"
					:title="attachTimestamp ? 'Timestamp attached' : 'Attach timestamp'"
					@click="attachTimestamp = !attachTimestamp"
				/>
				<Button
					v-if="!isImage"
					:variant="drawingActive || pendingAnnotation ? 'subtle' : 'ghost'"
					size="sm"
					icon="lucide-pen-tool"
					:aria-pressed="drawingActive"
					:aria-label="drawingActive ? 'Cancel drawing' : 'Draw annotation'"
					:title="drawingActive ? 'Cancel drawing' : 'Draw annotation'"
					@click="toggleDrawing"
				/>
			</div>

			<CommentEditor
				ref="editor"
				v-model="draft"
				:placeholder="editorPlaceholder"
				:submit-label="replyTo ? 'Reply' : 'Comment'"
				:submitting="comments.adding.value"
				@submit="submitComment"
			/>
		</div>

		<AnnotationToolbar
			v-if="drawingActive"
			:editing="Boolean(editingAnnotation)"
			:saving="comments.updatingAnnotation.value"
			@done="finishDrawing"
			@save="saveAnnotation"
			@cancel="cancelDrawing"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Button, FormControl, ScrollArea, Select, Skeleton, toast } from 'frappe-ui'
import type { AnnotationJson, ReviewComment } from '@/types'
import AnnotationToolbar from '@/components/review/AnnotationToolbar.vue'
import CommentEditor from '@/components/review/CommentEditor.vue'
import CommentItem from '@/components/review/CommentItem.vue'
import { useReview } from '@/composables/useReview'
import { formatTimestamp } from '@/composables/useVideoPlayer'

const review = useReview()
const { comments } = review
const editor = ref<InstanceType<typeof CommentEditor> | null>(null)
const draft = ref('')
const replyTo = ref<ReviewComment | null>(null)
const attachTimestamp = ref(true)
const pendingAnnotation = ref<AnnotationJson | null>(null)
const editingAnnotation = ref<ReviewComment | null>(null)

const assetVersion = computed(() => review.asset.value?.version ?? 1)
const isImage = computed(() => Boolean(review.asset.value?.file_type?.startsWith('image/')))
const drawingActive = computed(() => review.annotation.mode.value === 'edit')

const versionOptions = computed(() => [
	{ label: 'All versions', value: 'all' },
	...Array.from({ length: assetVersion.value }, (_, index) => {
		const version = assetVersion.value - index
		return {
			label: version === assetVersion.value ? `v${version} (latest)` : `v${version}`,
			value: String(version),
		}
	}),
])
const versionValue = computed({
	get: () => String(comments.versionFilter.value),
	set: (value: string | number | null) => {
		comments.versionFilter.value = value === 'all' || value == null ? 'all' : Number(value)
	},
})

const threads = computed(() => {
	const list = comments.list.value
	const replies = new Map<string, ReviewComment[]>()
	for (const comment of list) {
		if (!comment.parent_comment) continue
		replies.set(comment.parent_comment, [
			...(replies.get(comment.parent_comment) ?? []),
			comment,
		])
	}
	return list
		.filter((comment) => !comment.parent_comment)
		.map((comment) => ({ comment, replies: replies.get(comment.name) ?? [] }))
})

const emptyMessage = computed(() =>
	comments.versionFilter.value !== 'all' && assetVersion.value > 1
		? `No comments on v${comments.versionFilter.value}.`
		: 'No comments yet. Be the first to add feedback.',
)
const sortOptions = [
	{ label: 'Recent', value: 'recent' },
	{ label: 'By time', value: 'timestamp' },
]
const editorPlaceholder = computed(() =>
	review.isGuest.value ? 'Add a comment…' : 'Add a comment… Type @ to mention',
)

watch(
	() => review.annotation.mode.value,
	(mode) => {
		if (mode === 'off' && !pendingAnnotation.value) editingAnnotation.value = null
	},
)

async function startReply(comment: ReviewComment) {
	replyTo.value = comment
	await nextTick()
	editor.value?.focus()
}

function toggleDrawing() {
	if (drawingActive.value) cancelDrawing()
	else {
		pendingAnnotation.value = null
		review.player.value?.pause()
		review.annotation.start()
	}
}

function finishDrawing() {
	pendingAnnotation.value = review.annotation.capture()
	review.annotation.mode.value = 'off'
	editor.value?.focus()
}

function cancelDrawing() {
	pendingAnnotation.value = null
	editingAnnotation.value = null
	review.annotation.clear()
}

function captureAnnotation(): AnnotationJson | null {
	if (drawingActive.value) return review.annotation.capture()
	return pendingAnnotation.value
}

async function submitComment(html: string) {
	const annotation = editingAnnotation.value ? null : captureAnnotation()
	try {
		await comments.add({
			text: html,
			...(attachTimestamp.value || annotation ? { timestamp: review.currentTime.value } : {}),
			...(replyTo.value ? { parent: replyTo.value.name } : {}),
			...(annotation ? { annotation } : {}),
			...(review.isGuest.value ? { guestName: review.guestName.value.trim() } : {}),
		})
	} catch (error) {
		toast.error(errorMessage(error, 'Could not add the comment'))
		return
	}
	draft.value = ''
	replyTo.value = null
	pendingAnnotation.value = null
	if (review.annotation.mode.value !== 'off') review.annotation.clear()
}

async function editComment(comment: ReviewComment, html: string) {
	await run(() => comments.edit(comment.name, html), 'Could not update the comment')
}

async function removeComment(comment: ReviewComment) {
	await run(() => comments.remove(comment.name), 'Could not delete the comment')
}

async function resolveComment(comment: ReviewComment, resolved: boolean) {
	await run(() => comments.resolve(comment.name, resolved), 'Could not update the comment')
}

async function loadAnnotation(comment: ReviewComment): Promise<AnnotationJson | null> {
	const response = await comments.getAnnotation(comment.name)
	if (!response?.annotation_data) return null
	return JSON.parse(response.annotation_data) as AnnotationJson
}

async function viewAnnotation(comment: ReviewComment) {
	const time = comment.video_timestamp ?? 0
	try {
		const annotation = await loadAnnotation(comment)
		if (annotation) review.annotation.view(annotation, time)
		else review.seekTo(time)
	} catch (error) {
		toast.error(errorMessage(error, 'Could not load the drawing'))
		review.seekTo(time)
	}
}

async function editAnnotation(comment: ReviewComment) {
	try {
		const annotation = await loadAnnotation(comment)
		if (!annotation) return
		review.player.value?.pause()
		review.annotation.view(annotation, comment.video_timestamp ?? 0)
		editingAnnotation.value = comment
		pendingAnnotation.value = null
		review.annotation.mode.value = 'edit'
	} catch (error) {
		toast.error(errorMessage(error, 'Could not load the drawing'))
	}
}

async function saveAnnotation() {
	const comment = editingAnnotation.value
	const annotation = review.annotation.capture()
	if (!comment || !annotation) return
	const saved = await run(
		() => comments.updateAnnotation(comment.name, annotation),
		'Could not save the drawing',
	)
	if (saved) cancelDrawing()
}

async function run(action: () => Promise<void>, fallback: string) {
	try {
		await action()
		return true
	} catch (error) {
		toast.error(errorMessage(error, fallback))
		return false
	}
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback
}
</script>
