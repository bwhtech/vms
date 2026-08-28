import { onMounted, onScopeDispose, ref, type Ref } from 'vue'

/**
 * Safari (desktop) only exposes the prefixed Fullscreen API, and Safari on
 * iPhone has no element fullscreen at all — the only way in is the video
 * element's own `webkitEnterFullscreen()`, which hands over to the native
 * player. This composable tries, in order: the standard API, the
 * webkit-prefixed one, then the video fallback.
 */

// Intersections, not `extends` — the DOM lib already declares some of these
// with incompatible (non-optional) types.
type WebkitDocument = Document & {
	webkitFullscreenElement?: Element | null
	webkitExitFullscreen?: () => void
}

type WebkitElement = HTMLElement & {
	webkitRequestFullscreen?: () => void
}

type WebkitVideoElement = HTMLVideoElement & {
	webkitEnterFullscreen?: () => void
	webkitExitFullscreen?: () => void
	webkitDisplayingFullscreen?: boolean
}

function fullscreenElement() {
	const doc = document as WebkitDocument
	return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function useFullscreen(
	container: Ref<HTMLElement | null>,
	video?: Ref<HTMLVideoElement | null>,
) {
	const isFullscreen = ref(false)

	function enterVideoFullscreen() {
		const el = video?.value as WebkitVideoElement | null | undefined
		el?.webkitEnterFullscreen?.()
	}

	function toggle() {
		const doc = document as WebkitDocument
		const videoEl = video?.value as WebkitVideoElement | null | undefined

		if (fullscreenElement()) {
			if (doc.exitFullscreen) void doc.exitFullscreen()
			else doc.webkitExitFullscreen?.()
			return
		}

		if (videoEl?.webkitDisplayingFullscreen) {
			videoEl.webkitExitFullscreen?.()
			return
		}

		const el = container.value as WebkitElement | null
		if (!el) return

		if (el.requestFullscreen) {
			// Rejects on iPad Safari inside some embeds; fall back to the video.
			el.requestFullscreen().catch(enterVideoFullscreen)
		} else if (el.webkitRequestFullscreen) {
			el.webkitRequestFullscreen()
		} else {
			enterVideoFullscreen()
		}
	}

	const onChange = () => {
		isFullscreen.value = Boolean(fullscreenElement())
	}
	// Native iOS player: our container never enters fullscreen, so these are
	// the only signals that the video did.
	const onBegin = () => {
		isFullscreen.value = true
	}
	const onEnd = () => {
		isFullscreen.value = false
	}

	let boundVideo: HTMLVideoElement | null = null

	onMounted(() => {
		document.addEventListener('fullscreenchange', onChange)
		document.addEventListener('webkitfullscreenchange', onChange)
		boundVideo = video?.value ?? null
		boundVideo?.addEventListener('webkitbeginfullscreen', onBegin)
		boundVideo?.addEventListener('webkitendfullscreen', onEnd)
	})

	onScopeDispose(() => {
		document.removeEventListener('fullscreenchange', onChange)
		document.removeEventListener('webkitfullscreenchange', onChange)
		boundVideo?.removeEventListener('webkitbeginfullscreen', onBegin)
		boundVideo?.removeEventListener('webkitendfullscreen', onEnd)
	})

	return { isFullscreen, toggle }
}
