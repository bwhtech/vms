import { useCallback, useEffect, useState, type RefObject } from "react"

/**
 * Safari (desktop) only exposes the prefixed Fullscreen API, and Safari on
 * iPhone has no element fullscreen at all — the only way in is the video
 * element's own `webkitEnterFullscreen()`, which hands over to the native
 * player. This hook tries, in order: the standard API, the webkit-prefixed
 * one, then the video fallback.
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
  containerRef: RefObject<HTMLElement | null>,
  videoRef?: RefObject<HTMLVideoElement | null>,
) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterVideoFullscreen = useCallback(() => {
    const video = videoRef?.current as WebkitVideoElement | null | undefined
    video?.webkitEnterFullscreen?.()
  }, [videoRef])

  const toggle = useCallback(() => {
    const doc = document as WebkitDocument
    const video = videoRef?.current as WebkitVideoElement | null | undefined

    if (fullscreenElement()) {
      if (doc.exitFullscreen) doc.exitFullscreen()
      else doc.webkitExitFullscreen?.()
      return
    }

    if (video?.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.()
      return
    }

    const el = containerRef.current as WebkitElement | null
    if (!el) return

    if (el.requestFullscreen) {
      // Rejects on iPad Safari inside some embeds; fall back to the video.
      el.requestFullscreen().catch(enterVideoFullscreen)
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    } else {
      enterVideoFullscreen()
    }
  }, [containerRef, videoRef, enterVideoFullscreen])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!fullscreenElement())
    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("webkitfullscreenchange", onChange)

    // Native iOS player: our container never enters fullscreen, so these are
    // the only signals that the video did.
    const video = videoRef?.current
    const onBegin = () => setIsFullscreen(true)
    const onEnd = () => setIsFullscreen(false)
    video?.addEventListener("webkitbeginfullscreen", onBegin)
    video?.addEventListener("webkitendfullscreen", onEnd)

    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("webkitfullscreenchange", onChange)
      video?.removeEventListener("webkitbeginfullscreen", onBegin)
      video?.removeEventListener("webkitendfullscreen", onEnd)
    }
  }, [videoRef])

  return { isFullscreen, toggle }
}
