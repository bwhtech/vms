import { computed } from 'vue'
import { dialog, toast, useCall } from 'frappe-ui'
import { serverMessage } from '@/lib/format'

export interface YoutubeChannel {
	name: string
	channel_name: string
	channel_id: string
	connected_by: string
	is_default: number
	asset_count: number
}

interface YoutubeStatus {
	connected: boolean
	channel_name: string
	has_credentials: boolean
	channels: YoutubeChannel[]
}

interface FinalizeResponse {
	connected: boolean
	channel: string
	channel_name: string
	is_new: boolean
}

/** "1 asset" / "3 assets". */
function assetCountLabel(count: number) {
	return `${count} ${count === 1 ? 'asset' : 'assets'}`
}

/** What a removal costs, so the confirmation can say it. */
function unlinkWarning(count: number, target: 'it' | 'them') {
	const via = target === 'it' ? 'to it' : 'through them'
	if (count === 0) return `No assets were uploaded ${via}.`
	const subject = count === 1 ? 'it' : 'they'
	return `${assetCountLabel(count)} uploaded ${via} will no longer show which channel ${subject} went to.`
}

/**
 * YouTube OAuth state for the settings tab. Connecting redirects to Google;
 * Google sends the browser back to `/vms?settings=youtube&youtube_connected=1`
 * and the tab calls `finalize()` from that query.
 */
export function useYoutube() {
	const status = useCall<YoutubeStatus>({
		url: '/api/v2/method/vms.youtube.get_youtube_status',
		method: 'GET',
		cacheKey: 'youtube-status',
	})
	const redirect = useCall<{ redirect_uri: string }>({
		url: '/api/v2/method/vms.youtube.get_youtube_redirect_uri',
		method: 'GET',
		cacheKey: 'youtube-redirect-uri',
	})

	const connect = useCall<{ auth_url: string }, { client_id?: string; client_secret?: string }>({
		url: '/api/v2/method/vms.youtube.connect_youtube',
		method: 'POST',
		immediate: false,
	})
	const finalizeCall = useCall<FinalizeResponse>({
		url: '/api/v2/method/vms.youtube.finalize_youtube_connection',
		method: 'POST',
		immediate: false,
	})
	const disconnectAll = useCall<{ connected: boolean }>({
		url: '/api/v2/method/vms.youtube.disconnect_youtube',
		method: 'POST',
		immediate: false,
	})
	const disconnectChannel = useCall<unknown, { channel: string }>({
		url: '/api/v2/method/vms.youtube.disconnect_youtube_channel',
		method: 'POST',
		immediate: false,
	})
	const setDefaultCall = useCall<unknown, { channel: string }>({
		url: '/api/v2/method/vms.youtube.set_default_youtube_channel',
		method: 'POST',
		immediate: false,
	})

	const channels = computed(() => status.data?.channels ?? [])
	const hasCredentials = computed(() => Boolean(status.data?.has_credentials))
	const totalAssets = computed(() =>
		channels.value.reduce((sum, c) => sum + (c.asset_count ?? 0), 0),
	)

	/** Save credentials (when given), then leave for Google's consent screen. */
	async function startConnect(credentials?: { client_id: string; client_secret: string }) {
		try {
			const result = await connect.submit(credentials ?? {})
			if (result?.auth_url) window.location.href = result.auth_url
		} catch (error) {
			toast.error(serverMessage(error) || 'Failed to start YouTube connection')
		}
	}

	async function finalize() {
		try {
			const result = await finalizeCall.submit()
			const name = result?.channel_name
			if (result && !result.is_new) {
				toast.success(
					name
						? `${name} was already connected — its access has been refreshed`
						: 'That channel was already connected — its access has been refreshed',
				)
			} else {
				toast.success(name ? `Connected ${name}` : 'YouTube connected')
			}
		} catch (error) {
			toast.error(serverMessage(error) || 'Failed to finalize YouTube connection')
		} finally {
			void status.reload()
		}
	}

	function confirmRemoveChannel(channel: YoutubeChannel) {
		dialog.danger({
			title: `Remove ${channel.channel_name}?`,
			message: `${unlinkWarning(channel.asset_count, 'it')} You can connect it again later.`,
			confirmLabel: 'Remove channel',
			onConfirm: async () => {
				try {
					await disconnectChannel.submit({ channel: channel.name })
					toast.success(`Removed ${channel.channel_name}`)
				} catch (error) {
					toast.error(serverMessage(error) || 'Failed to remove channel')
				} finally {
					void status.reload()
				}
			},
		})
	}

	function confirmDisconnectAll() {
		dialog.danger({
			title: 'Disconnect YouTube?',
			message: `Every connected channel and the saved client credentials are removed. ${unlinkWarning(totalAssets.value, 'them')}`,
			confirmLabel: 'Disconnect',
			onConfirm: async () => {
				try {
					await disconnectAll.submit()
					toast.success('YouTube disconnected')
				} catch (error) {
					toast.error(serverMessage(error) || 'Failed to disconnect YouTube')
				} finally {
					void status.reload()
				}
			},
		})
	}

	async function setDefault(channel: YoutubeChannel) {
		try {
			await setDefaultCall.submit({ channel: channel.name })
			toast.success(`${channel.channel_name} is now the default channel`)
		} catch (error) {
			toast.error(serverMessage(error) || 'Failed to set default channel')
		} finally {
			void status.reload()
		}
	}

	return {
		channels,
		hasCredentials,
		loading: computed(() => status.loading && !status.data),
		redirectUri: computed(() => redirect.data?.redirect_uri ?? ''),
		connecting: computed(() => connect.loading),
		finalizing: computed(() => finalizeCall.loading),
		startConnect,
		finalize,
		confirmRemoveChannel,
		confirmDisconnectAll,
		setDefault,
	}
}
