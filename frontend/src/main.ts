import { createApp } from 'vue'
import { FrappeUI, call, setConfig } from 'frappe-ui'
import App from './App.vue'
import router from './router'
import { cleanupLegacyServiceWorkers } from './lib/sw-cleanup'
import './style.css'

/**
 * In production `frappe-ui/vite`'s jinjaBootData plugin writes every key of
 * `vms/www/vms.py`'s boot dict onto `window`. The dev server serves
 * `index.html` verbatim, so fetch the same dict over the API instead.
 */
async function loadDevBootData() {
	if (!import.meta.env.DEV) return
	try {
		const boot = await call<Record<string, unknown>>('vms.www.vms.get_context_for_dev')
		Object.assign(window, boot)
	} catch {
		// Only available while `developer_mode` is on; the app runs fine without it.
	}
}

async function start() {
	await loadDevBootData()
	setConfig('systemTimezone', window.system_timezone ?? null)
	cleanupLegacyServiceWorkers()

	const app = createApp(App)
	app.use(router)
	app.use(FrappeUI)
	app.mount('#app')
}

start()
