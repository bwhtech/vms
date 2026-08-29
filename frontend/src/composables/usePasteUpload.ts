/**
 * Paste-to-upload.
 *
 * `Mod+V` and `Mod+Shift+V` fire the same `paste` event, so one document-level
 * listener covers both. A screenshot arrives as an image file; a file copied in
 * Finder/Explorer arrives as that file. Pastes inside a text field are left
 * alone — normal paste keeps working.
 *
 * Pages register where a paste should land with `useUploadTarget()`, so pasting
 * on a project page uploads into that project and folder and refreshes it.
 */
import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'frappe-ui'

import { useOverlays } from '@/composables/useOverlays'
import type { UploadContext } from '@/types'

// Mirrors UploadDropArea's accept list: types the browser labels, plus the
// video containers it has no MIME type for.
const EXTRA_EXTENSIONS = ['mkv', 'avi', 'm4v']

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

		openUpload({ ...(currentTarget?.() ?? {}), files })
	}

	onMounted(() => document.addEventListener('paste', handlePaste))
	onUnmounted(() => document.removeEventListener('paste', handlePaste))
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
