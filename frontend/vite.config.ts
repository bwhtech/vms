import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		frappeui({
			frontendRoute: '/vms',
			frappeProxy: { port: 8080 },
			jinjaBootData: true,
			lucideIcons: true,
			buildConfig: {
				indexHtmlPath: '../vms/www/vms.html',
				outDir: '../vms/public/frontend',
				baseUrl: '/assets/vms/frontend/',
			},
		}),
		vue(),
		VitePWA({
			// 'prompt', not 'autoUpdate': autoUpdate never calls onNeedRefresh and
			// reloads the tab itself on activate, which would drop an in-progress
			// comment or playback position.
			registerType: 'prompt',
			// The bundle is served from /assets/vms/frontend/, but the app lives at
			// /vms. A worker registered under /assets/... never controls the page,
			// so the worker is served from the site root: `buildBase: '/'` makes the
			// registration URL root-relative and the build copies it to vms/www/.
			buildBase: '/',
			// Frappe renders www/*.js through jinja; `min.js` is its static bypass.
			filename: 'sw.min.js',
			// /vms, not /vms/ — scope matching is a string prefix.
			scope: '/vms',
			workbox: {
				navigateFallback: null,
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				// Otherwise sw.min.js importScripts() a sibling workbox-*.js.
				inlineWorkboxRuntime: true,
				// The DiceBear style definitions are code-split so the picker pays
				// for them and nobody else does. Precaching them puts all 1.2 MB
				// back on every install and undoes that.
				globIgnores: ['**/*.min-*.js'],
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
				// Precache URLs are relative to the worker's location (site root).
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
			// The manifest is a static file in public/ linked from index.html.
			manifest: false,
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	optimizeDeps: {
		// frappe-ui ships unbuilt source with `~icons/lucide/*` virtual imports
		// that esbuild's prebundler cannot resolve.
		exclude: ['frappe-ui'],
		// Transitive CJS deps that still need converting to ESM once frappe-ui
		// itself is excluded from prebundling.
		include: ['tippy.js', 'engine.io-client', 'socket.io-client', 'debug'],
	},
})
