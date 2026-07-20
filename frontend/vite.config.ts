import path from 'path';
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import proxyOptions from './proxyOptions';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			// 'prompt', not 'autoUpdate': autoUpdate never calls onNeedRefresh (so
			// ReloadPrompt's toast is unreachable) and reloads the tab itself on
			// activate, which would drop an in-progress comment or playback position.
			registerType: 'prompt',
			// The bundle is built with --base=/assets/vms/frontend/, but the app is
			// served at /vms. A worker registered under /assets/... has a scope that
			// does not cover the page, so it never controls a client and the whole
			// PWA is inert. Serve it from the site root instead: `buildBase: '/'`
			// makes the registration URL root-relative, and the build copies the
			// worker into vms/www/ where Frappe serves it at /sw.min.js.
			buildBase: '/',
			// Frappe renders www/*.js through jinja; the `min.js` suffix is its
			// documented static bypass, so a future bundle containing `{{` or `{%`
			// cannot corrupt the worker.
			filename: 'sw.min.js',
			// /vms, not /vms/ — scope matching is a string prefix and the app is
			// reachable at both.
			scope: '/vms',
			workbox: {
				navigateFallback: null,
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				// Otherwise sw.min.js importScripts() a sibling workbox-*.js, which
				// would have to be copied to the site root as well.
				inlineWorkboxRuntime: true,
				// Precache URLs are relative to the worker's location, which is now
				// the site root rather than the asset directory.
				manifestTransforms: [
					(entries) => ({
						manifest: entries.map((entry) => ({
							...entry,
							url: `/assets/vms/frontend/${entry.url}`,
						})),
						warnings: [],
					}),
				],
			},
			// The web app manifest is a static file in public/ with an explicit link
			// in index.html, not generated here. `buildBase: '/'` would otherwise
			// point the injected link at the site root, where Frappe renders
			// .webmanifest through jinja and returns the template path as the body.
			manifest: false,
		}),
	],
	server: {
		port: 8080,
		host: '0.0.0.0',
		proxy: proxyOptions
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	build: {
		outDir: '../vms/public/frontend',
		emptyOutDir: true,
		target: 'es2015',
	},
});
