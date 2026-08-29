const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** `0 B`, `12 B`, `1.5 MB`. */
export function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return '0 B'
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1)
	const value = bytes / Math.pow(1024, i)
	return `${value.toFixed(i === 0 ? 0 : 1)} ${BYTE_UNITS[i]}`
}

/** Format a duration in seconds as M:SS, or H:MM:SS once it passes an hour. */
export function formatDuration(seconds: number): string {
	const total = Math.round(seconds)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = (n: number) => String(n).padStart(2, '0')
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Pull the real failure reason out of a Frappe error.
 *
 * `err.message` is the request URL and exception class — "…/get_upload_url
 * ValidationError" — which means nothing to a user. The reason the method threw
 * is either already unpacked by frappe-ui into `err.messages`, or still raw in
 * `_server_messages`, a JSON string holding an array of JSON strings. Returns ""
 * when there is nothing useful, so callers can fall back with
 * `serverMessage(err) || '...'`.
 */
export function serverMessage(err: unknown): string {
	const error = err as { messages?: unknown; _server_messages?: string } | null

	if (Array.isArray(error?.messages)) {
		const unpacked = error.messages
			.filter((entry): entry is string => typeof entry === 'string')
			.map(cleanMessage)
			.filter(Boolean)
			.join(' ')
		if (unpacked) return unpacked
	}

	const raw = error?._server_messages
	if (!raw) return ''

	let entries: unknown
	try {
		entries = JSON.parse(raw)
	} catch {
		return ''
	}
	if (!Array.isArray(entries)) return ''

	return entries
		.map((entry) => {
			if (typeof entry !== 'string') return ''
			try {
				const parsed = JSON.parse(entry) as { message?: unknown }
				return typeof parsed?.message === 'string' ? parsed.message : ''
			} catch {
				return entry
			}
		})
		.map(cleanMessage)
		.filter(Boolean)
		.join(' ')
}

function cleanMessage(message: string): string {
	return message.replace(/<[^>]*>/g, '').trim()
}
