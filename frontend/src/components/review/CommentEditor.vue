<template>
	<Editor
		ref="editorRef"
		v-model="draft"
		:extensions="extensions"
		:placeholder="placeholder"
		:upload-function="uploadImage"
		@transaction="syncR2Keys"
	>
		<template #default="{ editor, isEmpty: editorEmpty }">
			<div
				class="overflow-hidden rounded border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3"
				@keydown.capture="handleKeydown"
			>
				<EditorContent
					class="comment-editor max-h-48 min-h-16 overflow-y-auto px-3 py-2 text-sm text-ink-gray-8"
				/>
				<div
					class="flex items-center justify-between gap-2 border-t border-outline-gray-1 px-2 py-1.5"
				>
					<Button
						variant="ghost"
						size="sm"
						icon="lucide-image-plus"
						aria-label="Attach image"
						title="Attach image"
						@click="editor?.commands.selectAndUploadImage()"
					/>
					<div class="flex items-center gap-2">
						<span class="hidden text-xs text-ink-gray-5 sm:inline">{{
							shortcutLabel
						}}</span>
						<Button
							variant="solid"
							size="sm"
							icon-left="lucide-send"
							:label="submitLabel"
							:loading="submitting"
							:disabled="editorEmpty || submitting"
							@click="submit"
						/>
					</div>
				</div>
			</div>
		</template>
	</Editor>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button, dialog, useCall } from 'frappe-ui'
import type { Extension } from '@tiptap/core'
import {
	CommentKit,
	Editor,
	EditorContent,
	Image,
	MediaDrop,
	type TiptapEditor,
	type UploadedFile,
} from 'frappe-ui/editor'
import { useReview } from '@/composables/useReview'

interface MentionUser {
	name: string
	full_name: string
	user_image?: string | null
}

interface ImageUploadResponse {
	upload_url: string
	view_url: string
	r2_key: string
}

const props = withDefaults(
	defineProps<{
		placeholder?: string
		submitLabel?: string
		submitting?: boolean
		promptForGuest?: boolean
	}>(),
	{
		placeholder: 'Add a comment…',
		submitLabel: 'Comment',
		submitting: false,
		promptForGuest: true,
	},
)

const emit = defineEmits<{ submit: [html: string] }>()
const draft = defineModel<string>({ default: '' })
const review = useReview()
const editorRef = ref<{ editor: TiptapEditor | null; isEmpty: boolean } | null>(null)
const r2KeyByUrl = new Map<string, string>()
let applyingR2Keys = false

const mentionRequest = useCall<MentionUser[]>({
	url: '/api/v2/method/vms.review_api.get_mentionable_users',
	method: 'GET',
	immediate: false,
	cacheKey: 'review-mentionable-users',
})
const imageRequest = useCall<
	ImageUploadResponse,
	{ asset_name: string; file_name: string; content_type: string; token?: string }
>({
	url: '/api/v2/method/vms.review_api.upload_comment_image',
	method: 'POST',
	immediate: false,
})

const ReviewImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			r2Key: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('data-r2-key'),
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes.r2Key ? { 'data-r2-key': attributes.r2Key } : {},
			},
		}
	},
})

const extensions: Extension[] = [
	CommentKit.configure({
		heading: false,
		image: false,
		imageGroup: false,
		imageViewer: false,
		video: false,
		attachment: false,
		tag: false,
		mention: review.isGuest.value
			? false
			: {
					items: () =>
						(mentionRequest.data ?? []).map((user) => ({
							id: user.name,
							label: user.full_name,
							image: user.user_image,
						})),
				},
	}),
	ReviewImage as unknown as Extension,
	MediaDrop as unknown as Extension,
]

const shortcutLabel = computed(() =>
	/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ Enter' : 'Ctrl Enter',
)

onMounted(() => {
	if (!review.isGuest.value) void mentionRequest.execute()
})

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return
	event.preventDefault()
	submit()
}

function submit() {
	if (isEmpty()) return
	if (review.isGuest.value && props.promptForGuest && !review.guestName.value.trim()) {
		promptForGuestName()
		return
	}
	emit('submit', draft.value)
}

function promptForGuestName() {
	dialog.prompt({
		title: 'Add your name',
		message: 'Your name will appear with this comment.',
		fields: [
			{
				name: 'guestName',
				label: 'Name',
				required: true,
				defaultValue: review.guestName.value,
			},
		],
		confirmLabel: 'Continue',
		onConfirm: ({ values }) => {
			const name = String(values.guestName ?? '').trim()
			if (!name) return
			review.guestName.value = name
			emit('submit', draft.value)
		},
	})
}

async function uploadImage(file: File): Promise<UploadedFile> {
	if (!file.type.startsWith('image/')) throw new Error('Only image files can be attached')
	const response = await imageRequest.submit({
		asset_name: review.asset.value?.name ?? '',
		file_name: file.name,
		content_type: file.type,
		...(review.token ? { token: review.token } : {}),
	})
	if (!response) throw new Error('Could not prepare the image upload')
	await putFile(response.upload_url, file)
	r2KeyByUrl.set(response.view_url, response.r2_key)
	return { file_url: response.view_url, file_name: file.name }
}

function putFile(url: string, file: File) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest()
		request.open('PUT', url)
		request.setRequestHeader('Content-Type', file.type)
		request.addEventListener('load', () => {
			if (request.status >= 200 && request.status < 300) resolve()
			else reject(new Error(`Image upload failed (${request.status})`))
		})
		request.addEventListener('error', () => reject(new Error('Image upload failed')))
		request.send(file)
	})
}

function syncR2Keys(editor: TiptapEditor) {
	if (applyingR2Keys || r2KeyByUrl.size === 0) return
	const updates: { position: number; attributes: Record<string, unknown> }[] = []
	editor.state.doc.descendants((node, position) => {
		if (node.type.name !== 'image' || node.attrs.r2Key) return
		const key = r2KeyByUrl.get(String(node.attrs.src ?? ''))
		if (key) updates.push({ position, attributes: { ...node.attrs, r2Key: key } })
	})
	if (!updates.length) return
	applyingR2Keys = true
	const transaction = updates.reduce(
		(current, update) => current.setNodeMarkup(update.position, undefined, update.attributes),
		editor.state.tr,
	)
	editor.view.dispatch(transaction)
	applyingR2Keys = false
}

function isEmpty() {
	return Boolean(editorRef.value?.isEmpty) && !draft.value.includes('<img')
}

function focus() {
	editorRef.value?.editor?.commands.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.comment-editor :deep(.ProseMirror) {
	min-height: 3rem;
	outline: none;
}

.comment-editor :deep(.mention) {
	border-radius: 0.25rem;
	background: var(--surface-gray-2);
	padding: 0.125rem 0.25rem;
	font-weight: 500;
}

.comment-editor :deep(img) {
	max-height: 10rem;
	max-width: 100%;
	border-radius: 0.5rem;
	object-fit: contain;
}
</style>
