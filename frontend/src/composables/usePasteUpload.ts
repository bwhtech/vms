/**
 * Paste-to-upload.
 *
 * `Mod+V` and `Mod+Shift+V` fire the same `paste` event, so one document-level
 * listener covers both. A screenshot arrives as an image file; a file copied in
 * Finder/Explorer arrives as that file. Pastes inside a text field are left
 * alone — normal paste keeps working.
 *
 * Images skip the dialog entirely: they upload straight away and their review
 * link lands back on the clipboard. Everything else opens the upload dialog
 * with the files queued, since a video is worth confirming before it starts.
 *
 * Pages register where a paste should land with `useUploadTarget()`, so pasting
 * on a project page uploads into that project and folder and refreshes it.
 */
import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'
import { call, toast } from 'frappe-ui'

import { useOverlays } from '@/composables/useOverlays'
import { useUploadQueue } from '@/composables/useUploadQueue'
import { copyText } from '@/lib/clipboard'
import { serverMessage } from '@/lib/format'
import { RAW_EXTENSIONS } from '@/lib/fileType'
import type { UploadContext } from '@/types'

// Mirrors UploadDropArea's accept list: types the browser labels, plus the
// video containers it has no MIME type for.
const EXTRA_EXTENSIONS = ['mkv', 'avi', 'm4v', ...RAW_EXTENSIONS]

interface ShareResponse {
	is_public_review: 0 | 1
	review_token: string | null
}

type ContextGetter = () => UploadContext

let currentTarget: ContextGetter | null = null

/**
 * Register the upload context a paste on this page should use. The page that
 * mounted last owns it; unmounting hands it back.
 */
export function useUploadTarget(context: MaybeRefOrGetter<UploadContext>): void {
	const getter: ContextGetter = () => toValue(context)
	onMounted(() => {
		currentTarget = getter
	})
	onUnmounted(() => {
		if (currentTarget === getter) currentTarget = null
	})
}

/** Mounted once by `AppShell`. */
export function usePasteUpload(): void {
	const { openUpload } = useOverlays()
	const { add } = useUploadQueue()

	function handlePaste(event: ClipboardEvent): void {
		if (isEditable(event.target)) return

		const pasted = Array.from(event.clipboardData?.files ?? [])
		if (pasted.length === 0) return

		event.preventDefault()
		const files = pasted.filter(isUploadable)
		if (files.length === 0) {
			toast.error('Only video, audio, or image files can be pasted')
			return
		}

		const target = currentTarget?.() ?? {}
		if (files.every(isImage)) {
			uploadAndShare(files.map(named), target)
			return
		}
		openUpload({ ...target, files })
	}

	/** The `UploadQueuePanel` reports progress, so no dialog has to open. */
	function uploadAndShare(files: File[], target: UploadContext): void {
		add(files, {
			...target,
			onSettled: (result) => {
				target.onSettled?.(result)
				if (result.failed.length > 0) {
					toast.error(result.failed[0].error || 'Could not upload the image')
				}
				if (result.uploaded.length > 0) void shareUploaded(result.uploaded)
			},
		})
	}

	onMounted(() => document.addEventListener('paste', handlePaste))
	onUnmounted(() => document.removeEventListener('paste', handlePaste))
}

async function shareUploaded(assetNames: string[]): Promise<void> {
	try {
		const links = await Promise.all(assetNames.map(reviewLink))
		const copied = await copyText(links.join('\n'))
		const label = assetNames.length === 1 ? 'Review link' : 'Review links'
		if (copied) toast.success(`${label} copied to clipboard`)
		else toast.warning(`Image uploaded, but the ${label.toLowerCase()} could not be copied`)
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not create a review link')
	}
}

/** Public review is what makes the link work for whoever it is pasted to. */
async function reviewLink(assetName: string): Promise<string> {
	const result = await call<ShareResponse>('vms.review_api.toggle_public_review', {
		asset_name: assetName,
		enable: 1,
	})
	return `${window.location.origin}/vms/review/${assetName}?token=${result.review_token}`
}

/**
 * A screenshot reaches the clipboard as "image.png", which makes every paste
 * look the same in the asset list. A file copied from Finder keeps its name.
 */
function named(file: File): File {
	if (!/^image\.\w+$/i.test(file.name)) return file
	const extension = file.name.split('.').pop()
	const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
	return new File([file], `pasted-${stamp}.${extension}`, { type: file.type })
}

function isImage(file: File): boolean {
	return file.type.startsWith('image/')
}

function isUploadable(file: File): boolean {
	if (/^(video|audio|image)\//.test(file.type)) return true
	const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
	return EXTRA_EXTENSIONS.includes(extension)
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true
	return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
