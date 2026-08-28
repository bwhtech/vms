import { useRef, useEffect, useState, useCallback } from "react"
import { useFrappePostCall } from "frappe-react-sdk"
import { useVideoPlayer } from "@/hooks/useVideoPlayer"
import { useFullscreen } from "@/hooks/useFullscreen"
import { useReviewContext } from "@/hooks/useReviewContext"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { VideoControls } from "./VideoControls"
import { VideoTimeline } from "./VideoTimeline"
import { AnnotationCanvas } from "./AnnotationCanvas"

/** How long a source swap can buffer before the overlay admits it is slow. */
const SWITCH_SLOW_MS = 8000

interface VideoPlayerProps {
  assetName: string
  /**
   * Whether the asset has a streaming proxy ready. Not read directly — the
   * backend picks the key — but flipping it refetches the view URL, so a proxy
   * that finishes generating while the page is open swaps in without a reload.
   */
  preferProxy?: boolean
}

export function VideoPlayer({ assetName, preferProxy = false }: VideoPlayerProps) {
  const {
    comments,
    setCurrentTime,
    seekToRef,
    annotationMode,
    replayAnnotation,
    fabricCanvas,
    viewAnnotation,
    token,
  } = useReviewContext()

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoWrapperRef = useRef<HTMLDivElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isSwitchingSource, setIsSwitchingSource] = useState(false)
  const [switchTakingLong, setSwitchTakingLong] = useState(false)
  // Distinguishes the first fetch from a later swap. A ref rather than reading
  // `videoUrl`, which would have to go in the effect's deps and re-run it.
  const hasSourceRef = useRef(false)
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // What a stalled swap falls back to: the source that was playing before it,
  // with the position and play state captured at the same moment.
  const revertRef = useRef<{ url: string; at: number; playing: boolean } | null>(null)
  const currentUrlRef = useRef<string | null>(null)

  const { call: getViewUrl } = useFrappePostCall("vms.review_api.get_review_view_url")

  const player = useVideoPlayer(videoRef)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef, videoRef)

  // Fetch video URL. Refetched when `preferProxy` flips, since the backend
  // serves the proxy key once one exists — the swap replaces the element's
  // src, which resets playback, so the position and play state are restored
  // once the new source reports its metadata.
  useEffect(() => {
    if (!assetName) return
    const params: Record<string, string> = { asset_name: assetName }
    if (token) params.token = token

    const video = videoRef.current
    const resumeAt = video?.currentTime ?? 0
    const wasPlaying = video ? !video.paused : false

    getViewUrl(params).then((res) => {
      const isSwap = hasSourceRef.current
      const previousUrl = currentUrlRef.current
      hasSourceRef.current = true
      currentUrlRef.current = res.message.url
      setVideoUrl(res.message.url)
      if (!isSwap) return

      revertRef.current = previousUrl
        ? { url: previousUrl, at: resumeAt, playing: wasPlaying }
        : null

      // The new URL buffers from scratch, so without this the picture just
      // freezes with nothing saying why.
      setIsSwitchingSource(true)
      setSwitchTakingLong(false)
      const el = videoRef.current
      if (!el) {
        setIsSwitchingSource(false)
        return
      }
      const onMetadata = () => {
        if (resumeAt <= 0) return
        el.currentTime = resumeAt
        if (wasPlaying) void el.play()
      }
      // Cleared on `canplay`, not `loadedmetadata`: metadata arrives well
      // before the restored position is buffered, which is the gap being
      // covered. `error` too, or a source that fails to load hangs the overlay.
      const done = () => {
        setIsSwitchingSource(false)
        setSwitchTakingLong(false)
        if (switchTimerRef.current) {
          clearTimeout(switchTimerRef.current)
          switchTimerRef.current = null
        }
        el.removeEventListener("canplay", done)
        el.removeEventListener("error", done)
      }
      el.addEventListener("loadedmetadata", onMetadata, { once: true })
      el.addEventListener("canplay", done)
      el.addEventListener("error", done)
      // A source that stalls without failing fires neither `canplay` nor
      // `error`, so the overlay would sit there indefinitely claiming to be
      // mid-switch. Escalate the copy rather than dropping the overlay: a swap
      // stalled while paused shows no buffering spinner, so removing it would
      // leave a frozen frame explaining nothing.
      switchTimerRef.current = setTimeout(() => setSwitchTakingLong(true), SWITCH_SLOW_MS)
    })

    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current)
        switchTimerRef.current = null
      }
    }
  }, [assetName, token, getViewUrl, preferProxy])

  // Escape hatch for a swap that never finishes: put the previous source back
  // rather than leaving the user with an overlay that only explains the stall.
  // The proxy is an optimisation, so falling back to the original costs nothing
  // but bandwidth.
  const keepOriginalSource = useCallback(() => {
    const revert = revertRef.current
    if (!revert) return

    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current)
      switchTimerRef.current = null
    }
    setIsSwitchingSource(false)
    setSwitchTakingLong(false)
    revertRef.current = null
    currentUrlRef.current = revert.url
    setVideoUrl(revert.url)

    const el = videoRef.current
    if (!el) return
    // Same reason as the swap itself: assigning src resets currentTime, and a
    // seek before metadata is known is discarded.
    el.addEventListener(
      "loadedmetadata",
      () => {
        if (revert.at > 0) el.currentTime = revert.at
        if (revert.playing) void el.play()
      },
      { once: true },
    )
  }, [])

  // Expose seek function to parent via context ref
  useEffect(() => {
    seekToRef.current = (time: number) => {
      player.seek(time)
      videoRef.current?.pause()
    }
  }, [seekToRef, player])

  // Notify context of time updates (drift-based replay dismissal handled in context)
  useEffect(() => {
    setCurrentTime(player.currentTime)
  }, [player.currentTime, setCurrentTime])

  // Pause video when annotation mode activates
  useEffect(() => {
    if (annotationMode || replayAnnotation) {
      videoRef.current?.pause()
    }
  }, [annotationMode, replayAnnotation])

  const SKIP_SECONDS = 10
  const FPS = 30

  const skipForward = useCallback(() => {
    player.seek(player.currentTime + SKIP_SECONDS)
  }, [player])

  const skipBackward = useCallback(() => {
    player.seek(player.currentTime - SKIP_SECONDS)
  }, [player])

  // JKL shuttle speeds: successive presses cycle through these
  const SHUTTLE_SPEEDS = [1, 2, 4, 8] as const
  const shuttleIndexRef = useRef(0)
  const shuttleDirRef = useRef<"fwd" | "rev" | null>(null)
  const rewindIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playerRef = useRef(player)
  playerRef.current = player

  const clearRewind = useCallback(() => {
    if (rewindIntervalRef.current) {
      clearInterval(rewindIntervalRef.current)
      rewindIntervalRef.current = null
    }
  }, [])

  const startRewind = useCallback(
    (speed: number) => {
      clearRewind()
      const video = videoRef.current
      if (!video) return
      video.pause()
      // Seek backwards at `speed` x real-time, updating every 50ms
      rewindIntervalRef.current = setInterval(() => {
        const v = videoRef.current
        if (!v) return
        const step = speed * (50 / 1000)
        const next = v.currentTime - step
        if (next <= 0) {
          playerRef.current.seek(0)
          clearRewind()
          shuttleIndexRef.current = 0
          shuttleDirRef.current = null
        } else {
          playerRef.current.seek(next)
        }
      }, 50)
    },
    [clearRewind, videoRef],
  )

  // Clean up rewind interval on unmount
  useEffect(() => clearRewind, [clearRewind])

  // Keyboard shortcuts: JKL shuttle, Space, Arrow keys (frame/10-frame), M (mute), F (fullscreen)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return

      const video = videoRef.current
      if (!video) return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          player.togglePlay()
          // Reset shuttle state on space
          clearRewind()
          shuttleIndexRef.current = 0
          shuttleDirRef.current = null
          break

        case "KeyK":
          e.preventDefault()
          // K always pauses and resets shuttle
          clearRewind()
          shuttleIndexRef.current = 0
          shuttleDirRef.current = null
          if (!video.paused) {
            video.pause()
          } else {
            video.play()
          }
          break

        case "KeyL": {
          e.preventDefault()
          clearRewind()
          if (shuttleDirRef.current === "fwd" && shuttleIndexRef.current < SHUTTLE_SPEEDS.length - 1) {
            shuttleIndexRef.current++
          } else if (shuttleDirRef.current !== "fwd") {
            shuttleIndexRef.current = 0
            shuttleDirRef.current = "fwd"
          }
          const speed = SHUTTLE_SPEEDS[shuttleIndexRef.current]
          video.playbackRate = speed
          if (video.paused) video.play()
          break
        }

        case "KeyJ": {
          e.preventDefault()
          // If currently playing forward, stop first
          if (!video.paused) video.pause()
          if (shuttleDirRef.current === "rev" && shuttleIndexRef.current < SHUTTLE_SPEEDS.length - 1) {
            shuttleIndexRef.current++
          } else if (shuttleDirRef.current !== "rev") {
            shuttleIndexRef.current = 0
            shuttleDirRef.current = "rev"
          }
          const speed = SHUTTLE_SPEEDS[shuttleIndexRef.current]
          startRewind(speed)
          break
        }

        case "ArrowLeft":
          e.preventDefault()
          clearRewind()
          shuttleIndexRef.current = 0
          shuttleDirRef.current = null
          if (e.shiftKey) {
            // Skip 10 frames
            player.seek(player.currentTime - 10 / FPS)
          } else {
            // Skip 1 frame
            player.seek(player.currentTime - 1 / FPS)
          }
          if (!video.paused) video.pause()
          break

        case "ArrowRight":
          e.preventDefault()
          clearRewind()
          shuttleIndexRef.current = 0
          shuttleDirRef.current = null
          if (e.shiftKey) {
            // Skip 10 frames
            player.seek(player.currentTime + 10 / FPS)
          } else {
            // Skip 1 frame
            player.seek(player.currentTime + 1 / FPS)
          }
          if (!video.paused) video.pause()
          break

        case "KeyM":
          e.preventDefault()
          player.toggleMute()
          break

        case "KeyF":
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [player, clearRewind, startRewind, toggleFullscreen, videoRef])

  const isCanvasActive = annotationMode || !!replayAnnotation

  return (
    <div ref={containerRef} className="flex flex-col overflow-hidden rounded-lg border bg-black md:h-full">
      <div ref={videoWrapperRef} className="relative flex items-center justify-center bg-black aspect-video md:aspect-auto md:min-h-0 md:flex-1">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          className="h-full w-full object-contain"
          onClick={isCanvasActive ? undefined : player.togglePlay}
          playsInline
        />
        {!videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Loading video...
          </div>
        )}
        {videoUrl && isSwitchingSource && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <Spinner className="size-10 text-white/80" />
            <span className="max-w-xs text-center text-sm text-white/80">
              {switchTakingLong
                ? "Still switching to the streaming proxy — the connection looks slow."
                : "Switching to streaming proxy..."}
            </span>
            {switchTakingLong && (
              <Button
                variant="secondary"
                size="sm"
                className="pointer-events-auto"
                onClick={keepOriginalSource}
              >
                Keep playing the original
              </Button>
            )}
          </div>
        )}
        {videoUrl && !isSwitchingSource && player.isBuffering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner className="size-10 text-white/80" />
          </div>
        )}
        <AnnotationCanvas
          videoContainerRef={videoWrapperRef}
          isActive={isCanvasActive}
          readOnly={!!replayAnnotation}
          annotationData={replayAnnotation}
        />
      </div>

      <div className="bg-card border-t">
        <VideoTimeline
          currentTime={player.currentTime}
          duration={player.duration}
          comments={comments}
          onSeek={player.seek}
          onCommentMarkerClick={viewAnnotation}
          tooltipContainer={isFullscreen ? containerRef.current : undefined}
        />
        <VideoControls
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          volume={player.volume}
          isMuted={player.isMuted}
          playbackRate={player.playbackRate}
          isLooping={player.isLooping}
          onTogglePlay={player.togglePlay}
          onToggleMute={player.toggleMute}
          onVolumeChange={player.setVolume}
          onPlaybackRateChange={player.setPlaybackRate}
          onToggleLoop={player.toggleLoop}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSkipBackward={skipBackward}
          onSkipForward={skipForward}
          popoverContainer={isFullscreen ? containerRef.current : undefined}
        />
      </div>
    </div>
  )
}
