import { onScopeDispose } from 'vue'
import { io, type Socket } from 'socket.io-client'

/**
 * Frappe realtime over socket.io. frappe-ui 1.0 no longer opens a connection
 * for us (`initSocket` was removed), so this is the app's own lazy singleton.
 *
 * The namespace must equal the Frappe site name or the server rejects the
 * connection with "Invalid namespace" and no event ever arrives. Frappe
 * renders it into the served HTML; under `vite dev` the boot dict is fetched
 * by `main.ts`, and if it is missing altogether we fall back to the hostname.
 */
let socket: Socket | null = null

function siteName(): string {
	const injected = window.site_name
	return injected && !injected.includes('{{') ? injected : window.location.hostname
}

function socketUrl(): string {
	const { hostname, port, protocol } = window.location
	// Dev servers (vite, `bench start`) expose socketio on its own port; in
	// production nginx proxies `/socket.io` on the site's own origin.
	const socketPort = (window as { socketio_port?: number | string }).socketio_port ?? 9000
	const isDev = Boolean(port)
	const origin = isDev ? `http://${hostname}:${socketPort}` : `${protocol}//${hostname}`
	return `${origin}/${siteName()}`
}

export function getSocket(): Socket {
	if (!socket) {
		socket = io(socketUrl(), { withCredentials: true, reconnectionAttempts: 5 })
	}
	return socket
}

/** Subscribe to a realtime event for the lifetime of the current scope. */
export function onRealtime<T = unknown>(event: string, handler: (payload: T) => void): void {
	const s = getSocket()
	const listener = (payload: T) => handler(payload)
	s.on(event, listener)
	onScopeDispose(() => {
		s.off(event, listener)
	})
}

interface DocUpdatePayload {
	doctype: string
	name: string
	[key: string]: unknown
}

/** `doc_update` events for one doctype only. */
export function useDocRealtime(
	doctype: string,
	handler: (payload: { name: string }) => void,
): void {
	onRealtime<DocUpdatePayload>('doc_update', (payload) => {
		if (payload?.doctype === doctype) handler(payload)
	})
}
