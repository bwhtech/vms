import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { useState, useEffect } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

interface YouTubeChannel {
  name: string
  channel_name: string
  channel_id: string
  connected_by: string
  is_default: number
  asset_count: number
}

/** "1 asset" / "3 assets" — the count of what a removal will unlink. */
function assetCountLabel(count: number) {
  return `${count} ${count === 1 ? "asset" : "assets"}`
}

/** What a removal costs, e.g. "1 asset uploaded to it will no longer show which channel it went to." */
function unlinkWarning(count: number, target: "it" | "them") {
  if (count === 0) {
    return `No assets were uploaded ${target === "it" ? "to it" : "through them"}.`
  }

  const subject = count === 1 ? "it" : "they"
  return `${assetCountLabel(count)} uploaded ${
    target === "it" ? "to it" : "through them"
  } will no longer show which channel ${subject} went to.`
}

interface YouTubeStatus {
  connected: boolean
  channel_name: string
  has_credentials: boolean
  channels: YouTubeChannel[]
}

export function YouTubeSection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [isFinalizing, setIsFinalizing] = useState(false)
  // Either the name of a single channel to remove, or "all" for a full disconnect.
  // Held by name rather than by object so the dialog reads the latest counts.
  const [pendingRemoval, setPendingRemoval] = useState<string | "all" | null>(null)
  const [removing, setRemoving] = useState(false)
  // Set when the user wants to replace credentials that are already stored
  const [editingCredentials, setEditingCredentials] = useState(false)

  const {
    data: statusData,
    isLoading: statusLoading,
    isValidating: statusValidating,
    mutate,
  } = useFrappeGetCall<{ message: YouTubeStatus }>(
    "vms.youtube.get_youtube_status",
    undefined,
    "youtube-status",
    { revalidateOnFocus: false }
  )

  const { data: redirectData, isLoading: redirectLoading } = useFrappeGetCall<{
    message: { redirect_uri: string }
  }>(
    "vms.youtube.get_youtube_redirect_uri",
    undefined,
    "youtube-redirect-uri",
    { revalidateOnFocus: false }
  )

  const { call: callConnect, loading: connecting } = useFrappePostCall("vms.youtube.connect_youtube")
  const { call: callFinalize } = useFrappePostCall("vms.youtube.finalize_youtube_connection")
  const { call: callDisconnect, loading: disconnecting } = useFrappePostCall("vms.youtube.disconnect_youtube")
  const { call: callDisconnectChannel } = useFrappePostCall("vms.youtube.disconnect_youtube_channel")
  const { call: callSetDefault } = useFrappePostCall("vms.youtube.set_default_youtube_channel")

  const status = statusData?.message
  const channels = status?.channels ?? []
  const totalAssetCount = channels.reduce((sum, channel) => sum + (channel.asset_count ?? 0), 0)
  const pendingChannel =
    pendingRemoval && pendingRemoval !== "all"
      ? channels.find((channel) => channel.name === pendingRemoval)
      : undefined
  const redirectUri = redirectData?.message?.redirect_uri || ""
  // Credentials outlive a single channel's removal, so a reconnect can skip the paste step
  const reuseSavedCredentials = Boolean(status?.has_credentials) && !editingCredentials

  // Counts come from page load, so refresh them before the dialog quotes one
  const openRemoval = (target: string | "all") => {
    setPendingRemoval(target)
    mutate()
  }

  // A fast refresh shouldn't flash "Checking..." — only say so once the
  // cached count has been on screen long enough to be worth doubting.
  const [countIsStale, setCountIsStale] = useState(false)
  useEffect(() => {
    if (!statusValidating) {
      setCountIsStale(false)
      return
    }
    const timer = setTimeout(() => setCountIsStale(true), 300)
    return () => clearTimeout(timer)
  }, [statusValidating])

  // Handle OAuth redirect callback
  useEffect(() => {
    if (searchParams.get("youtube_connected") === "1") {
      searchParams.delete("youtube_connected")
      setSearchParams(searchParams, { replace: true })

      setIsFinalizing(true)
      callFinalize({})
        .then(() => {
          toast.success("YouTube connected successfully")
          mutate()
        })
        .catch(() => {
          toast.error("Failed to finalize YouTube connection")
        })
        .finally(() => {
          setIsFinalizing(false)
        })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Credentials are per-site, so adding a second channel reuses the stored ones
  const handleConnect = async (reuseCredentials = false) => {
    if (!reuseCredentials && (!clientId.trim() || !clientSecret.trim())) {
      toast.error("Please enter both Client ID and Client Secret")
      return
    }

    try {
      const res = await callConnect(
        reuseCredentials
          ? {}
          : { client_id: clientId.trim(), client_secret: clientSecret.trim() }
      )
      const authUrl = (res as { message: { auth_url: string } }).message.auth_url
      if (authUrl) {
        window.location.href = authUrl
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to connect YouTube"
      toast.error(message)
    }
  }

  const handleConfirmRemoval = async () => {
    if (!pendingRemoval) return

    setRemoving(true)
    try {
      if (pendingRemoval === "all") {
        await callDisconnect({})
        setClientId("")
        setClientSecret("")
        setEditingCredentials(false)
        toast.success("YouTube disconnected")
      } else {
        await callDisconnectChannel({ channel: pendingRemoval })
        toast.success(`Disconnected ${pendingChannel?.channel_name ?? "channel"}`)
      }
      setPendingRemoval(null)
      mutate()
    } catch (e: unknown) {
      const fallback =
        pendingRemoval === "all"
          ? "Failed to disconnect YouTube"
          : "Failed to disconnect channel"
      toast.error(e instanceof Error ? e.message : fallback)
    } finally {
      setRemoving(false)
    }
  }

  const handleSetDefault = async (channel: YouTubeChannel) => {
    try {
      await callSetDefault({ channel: channel.name })
      toast.success(`${channel.channel_name} is now the default channel`)
      mutate()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to set default channel"
      toast.error(message)
    }
  }

  if (isFinalizing || statusLoading || redirectLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <Spinner className="size-5" />
        <p className="text-sm text-muted-foreground">
          {isFinalizing ? "Connecting YouTube..." : "Loading..."}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">YouTube</h3>
              <p className="text-xs text-muted-foreground">
                Connect one or more YouTube accounts to upload videos directly from VMS.
              </p>
            </div>

            {status?.connected ? (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div
                    key={channel.name}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="size-2 rounded-full bg-green-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{channel.channel_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {channel.is_default ? "Default channel" : "Connected"}
                        {channel.asset_count > 0 && ` · ${assetCountLabel(channel.asset_count)}`}
                      </p>
                    </div>
                    {!channel.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => handleSetDefault(channel)}
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => openRemoval(channel.name)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => handleConnect(true)} disabled={connecting}>
                  {connecting ? "Redirecting..." : "Connect another channel"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Google will ask which account to use. Pick a different one to add a second
                  channel.
                </p>
              </div>
            ) : reuseSavedCredentials ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-sm font-medium">OAuth credentials saved</p>
                  <p className="text-xs text-muted-foreground">
                    No channel is connected. Authorize a YouTube account to start uploading —
                    the stored Client ID and Secret will be reused.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditingCredentials(true)}>
                  Enter different credentials
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 1: Show redirect URI */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    1. Create an OAuth Client in the{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Google Cloud Console
                    </a>{" "}
                    with this redirect URI:
                  </p>
                  <code
                    className="block text-xs bg-muted rounded px-2.5 py-2 break-all border cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(redirectUri)
                        toast.success("Redirect URI copied to clipboard")
                      } catch {
                        toast.error("Failed to copy")
                      }
                    }}
                    title="Click to copy"
                  >
                    {redirectUri}
                  </code>
                </div>

                {/* Step 2: Enter credentials */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    2. Paste the Client ID and Client Secret below:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube_client_id" className="text-xs">
                        Client ID
                      </Label>
                      <Input
                        id="youtube_client_id"
                        placeholder="Enter OAuth Client ID"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube_client_secret" className="text-xs">
                        Client Secret
                      </Label>
                      <Input
                        id="youtube_client_secret"
                        type="password"
                        placeholder="Enter OAuth Client Secret"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-end border-t border-border px-4 py-3 md:px-6">
        {status?.connected ? (
          <Button
            variant="destructive"
            onClick={() => openRemoval("all")}
            disabled={disconnecting}
          >
            {disconnecting
              ? "Disconnecting..."
              : channels.length > 1
                ? "Disconnect all channels"
                : "Disconnect YouTube"}
          </Button>
        ) : (
          <Button onClick={() => handleConnect(reuseSavedCredentials)} disabled={connecting}>
            {connecting ? "Redirecting..." : "Connect YouTube"}
          </Button>
        )}
      </div>

      <AlertDialog
        open={pendingRemoval === "all" || pendingChannel !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRemoval === "all"
                ? channels.length > 1
                  ? "Disconnect all channels?"
                  : "Disconnect YouTube?"
                : "Remove this channel?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval === "all" ? (
                <>
                  Every connected channel and the stored OAuth credentials will be removed.{" "}
                  {countIsStale ? (
                    <span className="italic">Checking how many assets this affects...</span>
                  ) : (
                    unlinkWarning(totalAssetCount, "them")
                  )}{" "}
                  Videos already on YouTube are unaffected. You will need to enter the Client ID
                  and Secret again to reconnect.
                </>
              ) : (
                <>
                  <strong className="text-foreground">
                    {pendingChannel?.channel_name ?? ""}
                  </strong>{" "}
                  will be disconnected.{" "}
                  {countIsStale ? (
                    <span className="italic">Checking how many assets this affects...</span>
                  ) : (
                    unlinkWarning(pendingChannel?.asset_count ?? 0, "it")
                  )}{" "}
                  Videos already on YouTube are unaffected.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmRemoval} disabled={removing}>
              {removing
                ? "Removing..."
                : pendingRemoval === "all"
                  ? "Disconnect"
                  : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
