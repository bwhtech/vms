import { computed } from 'vue'
import { toast, useCall, useDoc } from 'frappe-ui'
import { serverMessage } from '@/lib/format'

/** The VMS Settings single, as the v2 document API returns it. */
export interface VmsSettingsDoc {
	name: string
	setup_complete: number
	r2_account_id: string
	r2_access_key_id: string
	r2_secret_access_key: string
	r2_bucket_name: string
	r2_public_url: string
	cloudflare_api_token: string
	max_file_size: number
	presigned_url_expiry: number
	allowed_extensions: string
	trash_retention_days: string
	transcription_provider: string
	whisper_model: string
	openai_api_key: string
	deepgram_api_key: string
	youtube_client_id: string
}

export const GB = 1024 * 1024 * 1024
export const MB = 1024 * 1024
export const DEFAULT_MAX_FILE_SIZE = 5 * GB
export const DEFAULT_EXTENSIONS = 'mp4,mov,avi,mkv,webm,m4v,mp3,wav,png,jpg,jpeg,gif,webp'

export const RETENTION_OPTIONS = [
	{ label: 'Never', value: '0' },
	{ label: '7 days', value: '7' },
	{ label: '14 days', value: '14' },
	{ label: '30 days', value: '30' },
]

/**
 * One `useDoc('VMS Settings')` shared by every settings tab and the setup
 * wizard. A module singleton, so a save from one tab is visible in the next.
 */
let settings: ReturnType<typeof createSettings> | null = null

function createSettings() {
	const doc = useDoc<VmsSettingsDoc>({ doctype: 'VMS Settings', name: 'VMS Settings' })

	/** PUT only the fields that changed; resolves once the store holds the new doc. */
	async function save(values: Partial<VmsSettingsDoc>): Promise<void> {
		await doc.setValue.submit(values)
	}

	return { doc, save }
}

export function useVmsSettings() {
	if (!settings) settings = createSettings()
	return settings
}

/** `{ a: 1, b: 2 }` minus every key whose value equals the one in `base`. */
export function changedFields<T extends object>(base: T | null, form: Partial<T>): Partial<T> {
	const diff: Partial<T> = {}
	for (const key of Object.keys(form) as (keyof T)[]) {
		if (!base || form[key] !== base[key]) diff[key] = form[key]
	}
	return diff
}

/** "2 GB" / "1.5 GB" / "512 MB" for a byte count. */
export function formatFileSizeLimit(bytes: number): string {
	if (bytes >= GB) {
		const gb = bytes / GB
		return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
	}
	return `${Math.round(bytes / MB)} MB`
}

export interface R2Form {
	r2_account_id: string
	r2_access_key_id: string
	r2_secret_access_key: string
	r2_bucket_name: string
	r2_public_url: string
	cloudflare_api_token: string
}

export const R2_FIELDS: (keyof R2Form)[] = [
	'r2_account_id',
	'r2_access_key_id',
	'r2_secret_access_key',
	'r2_bucket_name',
	'r2_public_url',
	'cloudflare_api_token',
]

export function r2FormFrom(doc: VmsSettingsDoc | null): R2Form {
	const form = {} as R2Form
	for (const key of R2_FIELDS) form[key] = doc?.[key] ?? ''
	return form
}

/**
 * `test_r2_connection` reads the saved settings, so unsaved edits are written
 * first. Shared by the General tab and the wizard's Storage step.
 */
export function useR2Test() {
	const { doc, save } = useVmsSettings()
	const test = useCall<{ status: string }>({
		url: '/api/v2/method/vms.api.test_r2_connection',
		method: 'POST',
		immediate: false,
	})

	async function testConnection(form: R2Form): Promise<void> {
		try {
			const changes = changedFields(doc.doc, form)
			if (Object.keys(changes).length) await save(changes)
			await test.submit()
			toast.success('R2 connection successful')
		} catch (error) {
			toast.error(serverMessage(error) || 'R2 connection failed')
		}
	}

	return { testConnection, testing: computed(() => test.loading || doc.setValue.loading) }
}
