/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
	interface Window {
		/** Injected by `vms/www/vms.py` boot data. */
		csrf_token?: string
		site_name?: string
		system_timezone?: string
		frappe_version?: string
		read_only_mode?: boolean
	}
}

export {}
