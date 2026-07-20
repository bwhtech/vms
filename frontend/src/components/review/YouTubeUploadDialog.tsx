import { useState } from "react"
import { useNavigate } from "react-router"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface YouTubeChannel {
  name: string
  channel_name: string
  is_default: number
}

interface YouTubeUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetName: string
  fileName: string
  uploadStatus: string
  uploadStage: string
  uploadPercent: number
  uploadError: string
  uploadVideoUrl: string
  /** Docname of the channel the asset was actually uploaded to; "" before any upload. */
  uploadChannel: string
  /** Channel the asset was actually uploaded to; "" before any upload. */
  uploadChannelName: string
  /** Metadata the existing upload was submitted with; "" before any upload. */
  uploadTitle: string
  uploadDescription: string
  uploadPrivacy: string
  onUploadStarted: () => void
}

const PRIVACY_OPTIONS = [
  { value: "unlisted", label: "Unlisted" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
]

export function YouTubeUploadDialog({
  open,
  onOpenChange,
  assetName,
  fileName,
  uploadStatus,
  uploadStage,
  uploadPercent,
  uploadError,
  uploadVideoUrl,
  uploadChannel,
  uploadChannelName,
  uploadTitle,
  uploadDescription,
  uploadPrivacy,
  onUploadStarted,
}: YouTubeUploadDialogProps) {
  const [title, setTitle] = useState(fileName.replace(/\.[^/.]+$/, ""))
  const [description, setDescription] = useState("")
  const [privacyStatus, setPrivacyStatus] = useState("unlisted")
  const [selectedChannel, setSelectedChannel] = useState("")
  const navigate = useNavigate()

  // The dialog stays mounted with the review page, so its state outlives a
  // close. Reset the form as it reopens, otherwise an abandoned edit comes
  // back the next time the dialog is opened. Adjusted during render rather
  // than in an effect, so the stale values are never painted.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(fileName.replace(/\.[^/.]+$/, ""))
      setDescription("")
      setPrivacyStatus("unlisted")
      setSelectedChannel("")
    }
  }

  const { data: statusData } = useFrappeGetCall<{
    message: { connected: boolean; channel_name: string; channels: YouTubeChannel[] }
  }>("vms.youtube.get_youtube_status", undefined, "youtube-status-check", {
    revalidateOnFocus: false,
  })

  const { call: callUpload, loading: uploading } = useFrappePostCall(
    "vms.youtube.upload_to_youtube"
  )

  const isConnected = statusData?.message?.connected
  const channels = statusData?.message?.channels ?? []
  // Channels come back default-first, so the head is the pre-selected one
  const channel = selectedChannel || channels[0]?.name || ""
  const isInProgress = uploadStatus === "Queued" || uploadStatus === "Uploading"
  const isComplete = uploadStatus === "Complete"
  const isError = uploadStatus === "Error"
  // Once an upload exists, the channel it went to is the one to report — the
  // picker's selection resets on reload and would fall back to the default.
  const hasUpload = isInProgress || isComplete || isError
  // Retry has to go back to the channel that failed, not the current default —
  // that is the channel this dialog names in its header. Falls back to the
  // picker if that channel has since been removed, which the backend rejects.
  const targetChannel =
    hasUpload && channels.some((c) => c.name === uploadChannel) ? uploadChannel : channel
  const channelName =
    (hasUpload ? uploadChannelName : "") ||
    channels.find((c) => c.name === channel)?.channel_name ||
    statusData?.message?.channel_name ||
    "YouTube"

  // Retry has to resend what was published, not the form's defaults. The form
  // is not rendered in the error state, so its title is whatever the file name
  // seeded and its privacy is back to "unlisted" — republishing a private video
  // as unlisted would change who can see it.
  const targetTitle = (hasUpload && uploadTitle) || title.trim()
  const targetDescription = hasUpload ? uploadDescription : description.trim()
  const targetPrivacy = (hasUpload && uploadPrivacy) || privacyStatus

  const handleUpload = async () => {
    if (!targetTitle) {
      toast.error("Title is required")
      return
    }

    try {
      await callUpload({
        asset_name: assetName,
        title: targetTitle,
        description: targetDescription,
        privacy_status: targetPrivacy,
        channel: targetChannel,
      })
      onUploadStarted()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to start upload"
      toast.error(message)
    }
  }

  const stageLabel = uploadStage === "downloading"
    ? "Downloading from storage..."
    : uploadStage === "uploading"
      ? "Uploading to YouTube..."
      : uploadStage === "queued"
        ? "Queued, waiting to start..."
        : "Processing..."

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isInProgress) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if (isInProgress) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle>Upload to YouTube</DialogTitle>
          <DialogDescription>
            {!isConnected
              ? "YouTube is not connected"
              : isComplete
                ? `Uploaded to ${channelName}`
                : `Uploading to ${channelName}`}
          </DialogDescription>
        </DialogHeader>

        {isConnected === false ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Connect your YouTube account in Settings to upload videos.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                // The "open-settings" event is only listened for in AppLayout, and
                // the review page renders outside it — so leave the review route
                // and let AppLayout's ?settings= param open the panel on arrival.
                navigate("/?settings=youtube")
              }}
            >
              Open Settings
            </Button>
          </div>
        ) : isInProgress ? (
          <div className="py-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stageLabel}</span>
                <span>{uploadPercent}%</span>
              </div>
              <Progress value={uploadPercent} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You can close this dialog — the upload will continue in the background.
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : isComplete ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <div className="size-2 rounded-full bg-green-500 shrink-0" />
              <p className="text-sm font-medium">Upload complete</p>
            </div>
            <DialogFooter>
              {uploadVideoUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={uploadVideoUrl} target="_blank" rel="noopener noreferrer">
                    View on YouTube
                  </a>
                </Button>
              )}
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : isError ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <div className="size-2 rounded-full bg-destructive shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Upload failed</p>
                {uploadError && (
                  <p className="text-xs text-muted-foreground truncate">{uploadError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                Retry
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {channels.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="yt-channel" className="text-xs">
                    Channel
                  </Label>
                  <Select value={channel} onValueChange={setSelectedChannel}>
                    <SelectTrigger id="yt-channel" className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          channels.find((c) => c.name === value)?.channel_name ?? value
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.channel_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="yt-title" className="text-xs">
                  Title
                </Label>
                <Input
                  id="yt-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="yt-description" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="yt-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="yt-privacy" className="text-xs">
                  Privacy
                </Label>
                <Select value={privacyStatus} onValueChange={setPrivacyStatus}>
                  <SelectTrigger id="yt-privacy" className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        PRIVACY_OPTIONS.find((o) => o.value === value)?.label ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIVACY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Starting..." : "Upload"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
