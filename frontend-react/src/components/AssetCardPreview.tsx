import { useEffect, useRef, useState } from "react"
import { useFrappePostCall } from "frappe-react-sdk"
import { Spinner } from "@/components/ui/spinner"
import { formatDuration } from "@/lib/utils"
import type { VMSAsset } from "@/types"
import { Film, Play } from "lucide-react"

/** Video containers browsers can actually decode. .mkv/.avi/.wmv etc. must be converted first. */
const PLAYABLE_EXTENSIONS = new Set([".mp4", ".webm", ".m4v", ".ogv", ".mov"])

/**
 * The one card currently playing, across every grid on the page. Module scope
 * rather than context: the cards never share a parent, and only one video
 * should ever be audible at a time.
 */
let activeVideo: HTMLVideoElement | null = null

function isPlayableInBrowser(asset: VMSAsset): boolean {
  if (asset.status !== "Ready") return false
  const ext = asset.file_name.toLowerCase().match(/\.[^.]+$/)?.[0]
  return ext ? PLAYABLE_EXTENSIONS.has(ext) : false
}

/**
 * Presigned-URL fetch plus the shared "only one video plays at a time" bookkeeping.
 * Both the grid card and the list row preview run on this.
 */
function useInlinePlayback(asset: VMSAsset) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Don't leave a torn-down element as the active one — it would keep the
  // unmounted <video> (and its buffered data) alive. Reading videoRef at
  // cleanup time is deliberate: we only clear the slot if it is still ours.
  useEffect(() => {
    const video = videoRef
    return () => {
      if (activeVideo === video.current) activeVideo = null
    }
  }, [])

  const { call: getViewUrl } = useFrappePostCall("vms.api.get_view_url")

  const startPlayback = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading || videoUrl) return
    setLoading(true)
    setError(false)
    try {
      const res = await getViewUrl({ asset_name: asset.name })
      setVideoUrl(res.message.url)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const videoProps = {
    ref: videoRef,
    src: videoUrl ?? undefined,
    controls: true,
    autoPlay: true,
    playsInline: true,
    controlsList: "nodownload",
    onPlay: () => {
      if (activeVideo && activeVideo !== videoRef.current) activeVideo.pause()
      activeVideo = videoRef.current
    },
    onError: () => {
      setVideoUrl(null)
      setError(true)
    },
  }

  return {
    playable: isPlayableInBrowser(asset),
    videoUrl,
    loading,
    error,
    startPlayback,
    videoProps,
  }
}

interface AssetPreviewProps {
  asset: VMSAsset
}

/**
 * Thumbnail area of a grid asset card. For playable videos it turns into an
 * inline player on click, so a video can be checked without opening review.
 */
export function AssetCardPreview({ asset }: AssetPreviewProps) {
  const { playable, videoUrl, loading, error, startPlayback, videoProps } =
    useInlinePlayback(asset)

  if (videoUrl) {
    return (
      // Clicks inside the player must not bubble to the card's navigate-to-review handler.
      <div
        className="relative aspect-video w-full bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <video {...videoProps} className="h-full w-full object-contain" />
      </div>
    )
  }

  return (
    <div className="group/preview relative flex aspect-video w-full items-center justify-center bg-muted">
      {asset.thumbnail_url ? (
        <img src={asset.thumbnail_url} alt="" draggable={false} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <Film size={32} strokeWidth={1.5} />
        </div>
      )}
      {playable && (
        <button
          type="button"
          onClick={startPlayback}
          aria-label={`Play ${asset.file_name}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/preview:bg-black/20 group-hover/preview:opacity-100 focus-visible:bg-black/20 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-black/70 text-white">
            {loading ? <Spinner className="size-5" /> : <Play size={22} />}
          </span>
        </button>
      )}
      {error && (
        <span className="absolute inset-x-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-center text-[11px] text-white">
          Preview unavailable
        </span>
      )}
      {!!asset.duration_seconds && (
        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatDuration(asset.duration_seconds)}
        </span>
      )}
    </div>
  )
}

/**
 * Thumbnail slot of a list-view asset row. A 64x40 thumbnail is too small to
 * play in, so starting playback grows the slot into a small player and the row
 * grows with it. Shares the single-playing-video slot with the grid cards.
 */
export function AssetRowPreview({ asset }: AssetPreviewProps) {
  const { playable, videoUrl, loading, error, startPlayback, videoProps } =
    useInlinePlayback(asset)

  if (videoUrl) {
    return (
      // Clicks inside the player must not bubble to the row's open-review handler.
      <div
        className="w-64 shrink-0 overflow-hidden rounded bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <video {...videoProps} className="aspect-video w-full object-contain" />
      </div>
    )
  }

  return (
    <div className="group/preview relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
      {asset.thumbnail_url ? (
        <img src={asset.thumbnail_url} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <Film size={18} strokeWidth={1.5} />
        </div>
      )}
      {playable && (
        <button
          type="button"
          onClick={startPlayback}
          aria-label={`Play ${asset.file_name}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/preview:bg-black/30 group-hover/preview:opacity-100 focus-visible:bg-black/30 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white">
            {loading ? <Spinner className="size-3" /> : <Play size={14} />}
          </span>
        </button>
      )}
      {error && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/75 px-0.5 text-center text-[9px] leading-tight text-white">
          Unavailable
        </span>
      )}
    </div>
  )
}
