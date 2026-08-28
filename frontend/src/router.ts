import { watch, type ComputedRef, type Ref } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { resolveLoggedUser } from '@/composables/useSession'
import { useSetup } from '@/composables/useSetup'

/**
 * Shell routes are children of one layout record so `AppShell` mounts once
 * and the page swaps inside it. Guest routes (review, shared) and the setup
 * wizard are top-level: they render their own `h-screen` root, no sidebar.
 */
const shellRoutes: RouteRecordRaw[] = [
	{ path: '', name: 'Dashboard', component: () => import('@/pages/DashboardPage.vue') },
	{ path: 'uncategorised', name: 'Inbox', component: () => import('@/pages/InboxPage.vue') },
	{ path: 'projects', name: 'Projects', component: () => import('@/pages/ProjectsPage.vue') },
	{
		path: 'projects/:projectId',
		name: 'ProjectDetail',
		component: () => import('@/pages/ProjectDetailPage.vue'),
		props: true,
	},
	{
		path: 'projects/:projectId/folder/:folderId',
		name: 'ProjectFolder',
		component: () => import('@/pages/ProjectDetailPage.vue'),
		props: true,
	},
	{
		path: 'audit-logs',
		name: 'AuditLog',
		component: () => import('@/pages/AuditLogPage.vue'),
		// The page owns its scroll: filters stay pinned, only the log scrolls.
		meta: { ownScroll: true },
	},
	{ path: 'trash', name: 'Trash', component: () => import('@/pages/TrashPage.vue') },
	{ path: 'tools', name: 'Tools', component: () => import('@/pages/ToolsPage.vue') },
	{
		// Hidden sandbox for the shared components. Not linked from anywhere.
		path: 'dev',
		name: 'Dev',
		component: () => import('@/pages/DevPage.vue'),
	},
]

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		component: () => import('@/components/shell/AppShell.vue'),
		children: shellRoutes,
	},
	{
		path: '/setup',
		name: 'Setup',
		component: () => import('@/pages/SetupWizardPage.vue'),
	},
	{
		path: '/review/:assetId',
		name: 'Review',
		component: () => import('@/pages/ReviewPage.vue'),
		props: true,
		meta: { guest: true },
	},
	{
		path: '/shared/:projectId',
		name: 'SharedProject',
		component: () => import('@/pages/SharedProjectPage.vue'),
		props: true,
		meta: { guest: true },
	},
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
	// The app is mounted at /vms by `website_route_rules`.
	history: createWebHistory('/vms'),
	routes,
	scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
	// Review and shared pages authenticate with `?token=` instead of a session.
	if (to.meta.guest) return true

	const user = await resolveLoggedUser()
	if (!user) {
		const target = `/vms${to.fullPath}`
		window.location.href = `/login?redirect-to=${encodeURIComponent(target)}`
		return false
	}

	// A System Manager on a site that has never been set up lands in the
	// wizard until it is done; everyone else never sees it.
	const setup = useSetup()
	await whenReady(setup.ready)
	const needsSetup = setup.isSystemManager.value && setup.status.value === 'pending'
	if (needsSetup && to.path !== '/setup') return '/setup'
	if (!needsSetup && to.path === '/setup') return '/'
	return true
})

function whenReady(source: ComputedRef<boolean> | Ref<boolean>): Promise<void> {
	if (source.value) return Promise.resolve()
	return new Promise((resolve) => {
		const stop = watch(source, (value) => {
			if (!value) return
			stop()
			resolve()
		})
	})
}

// A lazy chunk that 404s means the deployed build moved under us. Reload once,
// tracked in sessionStorage so a genuinely broken chunk can't loop.
const RELOAD_KEY = 'vms-chunk-reload'
router.onError((error) => {
	if (!/dynamically imported module|Importing a module script failed/i.test(String(error))) return
	if (sessionStorage.getItem(RELOAD_KEY)) return
	sessionStorage.setItem(RELOAD_KEY, '1')
	window.location.reload()
})
router.isReady().then(() => sessionStorage.removeItem(RELOAD_KEY))

export default router
