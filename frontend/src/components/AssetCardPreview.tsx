import { useState } from "react"
import { useFrappePostCall } from "frappe-react-sdk"
import { HugeiconsIcon } from "@hugeicons/react"
import { Film01Icon, PlayIcon } from "@hugeicons/core-free-icons"
import { Spinner } from "@/components/ui/spinner"
import { formatDuration } from "@/lib/utils"
import type { VMSAsset } from "@/types"

/** Video containers browsers can actually decode. .mkv/.avi/.wmv etc. must be converted first. */
const PLAYABLE_EXTENSIONS = new Set([".mp4", ".webm", ".m4v", ".ogv", ".mov"])

function isPlayableInBrowser(asset: VMSAsset): boolean {
  if (asset.status !== "Ready") return false
  const ext = asset.file_name.toLowerCase().match(/\.[^.]+$/)?.[0]
  return ext ? PLAYABLE_EXTENSIONS.has(ext) : false
}

interface AssetCardPreviewProps {
  asset: VMSAsset
}

/**
 * Thumbnail area of a grid asset card. For playable videos it turns into an
 * inline player on click, so a video can be checked without opening review.
 */
export function AssetCardPreview({ asset }: AssetCardPreviewProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const { call: getViewUrl } = useFrappePostCall("vms.api.get_view_url")

  const playable = isPlayableInBrowser(asset)

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

  if (videoUrl) {
    return (
      // Clicks inside the player must not bubble to the card's navigate-to-review handler.
      <div
        className="relative aspect-video w-full bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={videoUrl}
          controls
          autoPlay
          playsInline
          controlsList="nodownload"
          className="h-full w-full object-contain"
          onError={() => {
            setVideoUrl(null)
            setError(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="group/preview relative flex aspect-video w-full items-center justify-center bg-muted">
      {asset.thumbnail_url ? (
        <img src={asset.thumbnail_url} alt="" draggable={false} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <HugeiconsIcon icon={Film01Icon} size={32} strokeWidth={1.5} />
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
            {loading ? <Spinner className="size-5" /> : <HugeiconsIcon icon={PlayIcon} size={22} />}
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
