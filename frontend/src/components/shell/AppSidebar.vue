<template>
	<Sidebar width="14rem">
		<SidebarHeader
			title="VMS"
			:subtitle="user?.full_name ?? ''"
			:logo="LOGO_URL"
			:menu-items="workspaceMenu"
		/>

		<ScrollArea class="min-h-0 flex-1 px-1">
			<SidebarSection>
				<!-- Search is a nav row, not a header button: the palette is the
				     app's search, and this is where the recipe puts it. -->
				<SidebarItem icon="lucide-search" label="Search" @click="commandPaletteOpen = true">
					<template #suffix>
						<KeyboardShortcut class="mr-2" combo="Mod+K" />
					</template>
				</SidebarItem>
				<SidebarItem icon="lucide-home" label="Home" to="/" :active="route.path === '/'" />
				<SidebarItem
					icon="lucide-inbox"
					label="Inbox"
					to="/uncategorised"
					:active="route.path === '/uncategorised'"
				>
					<template v-if="uncategorisedCount" #suffix>
						<span class="mr-2 text-sm text-ink-gray-5">{{ uncategorisedCount }}</span>
					</template>
				</SidebarItem>
				<SidebarItem
					icon="lucide-bell"
					label="Notifications"
					@click="notificationsOpen = true"
				>
					<template v-if="hasUnread" #suffix>
						<span
							class="mr-3 size-2 rounded-full bg-surface-red-6"
							aria-label="Unread notifications"
						/>
					</template>
				</SidebarItem>
			</SidebarSection>

			<SidebarProjects />

			<SidebarSection label="More">
				<SidebarItem icon="lucide-scroll-text" label="Audit log" to="/audit-logs" />
				<SidebarItem icon="lucide-trash-2" label="Trash" to="/trash" />
			</SidebarSection>
		</ScrollArea>

		<div class="shrink-0 p-2">
			<StorageMeter />
		</div>
	</Sidebar>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import type { VNode } from 'vue'
import { useRoute } from 'vue-router'
import {
	KeyboardShortcut,
	ScrollArea,
	Sidebar,
	SidebarHeader,
	SidebarItem,
	SidebarSection,
	useCall,
} from 'frappe-ui'
import StorageMeter from '@/components/common/StorageMeter.vue'
import SidebarProjects from '@/components/shell/SidebarProjects.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useOverlays } from '@/composables/useOverlays'
import { useSession } from '@/composables/useSession'

/** Vite serves `public/` at the build's base URL. */
const LOGO_URL = `${import.meta.env.BASE_URL}vms-mark.png`

interface SidebarCounts {
	uncategorised: number
}

/** The `SidebarHeader` dropdown takes a narrower shape than `Dropdown` does. */
interface MenuItem {
	label: string
	icon?: string
	onClick?: () => void
	submenu?: MenuItem[]
	slots?: { prefix?: () => VNode }
}

/** One row of `frappe.apps.get_apps`: an installed app that opted into the apps screen. */
interface AppEntry {
	name: string
	logo: string
	title: string
	route: string
}

const route = useRoute()
const { isSystemManager, logout, user } = useSession()
const { commandPaletteOpen, notificationsOpen, openSettings, shortcutsOpen } = useOverlays()
const { unreadCount } = useNotifications()

const counts = useCall<SidebarCounts>({
	url: '/api/v2/method/vms.api.get_sidebar_counts',
	method: 'GET',
	cacheKey: 'sidebar-counts',
})

const uncategorisedCount = computed(() => counts.data?.uncategorised ?? 0)
// Unread comes from the shared notification list, so marking read in the
// panel clears the dot without a second round trip.
const hasUnread = computed(() => unreadCount.value > 0)

// The apps screen hook is the site-wide list of installed apps, so the switcher
// stays correct as apps are installed or removed without a VMS-side registry.
const apps = useCall<AppEntry[]>({
	url: '/api/v2/method/frappe.apps.get_apps',
	method: 'GET',
	cacheKey: 'installed-apps',
})

// Desk is not on the apps screen (it is every site's fallback), so it is added by
// hand — but only for System Managers, since a Video Manager has no desk access
// and would land on a permission error. VMS itself is dropped: switching to where
// you already are is a no-op.
const deskApp: AppEntry = {
	name: 'frappe',
	logo: '/assets/frappe/images/framework.png',
	title: 'Desk',
	route: '/desk',
}

const appSwitcherItems = computed<MenuItem[]>(() =>
	[
		...(isSystemManager.value ? [deskApp] : []),
		...(apps.data ?? []).filter((app) => app.name !== 'vms'),
	].map((app) => ({
		label: app.title,
		onClick: () => {
			window.location.href = app.route
		},
		slots: {
			prefix: () => h('img', { src: app.logo, alt: '', class: 'size-4 rounded-sm' }),
		},
	})),
)

// Workspace-level actions belong to the workspace, so they hang off its header.
const workspaceMenu = computed<MenuItem[]>(() => [
	...(appSwitcherItems.value.length
		? [{ label: 'Switch app', icon: 'lucide-layout-grid', submenu: appSwitcherItems.value }]
		: []),
	{ label: 'Settings', icon: 'lucide-settings', onClick: () => openSettings('profile') },
	{
		label: 'Keyboard shortcuts',
		icon: 'lucide-keyboard',
		onClick: () => {
			shortcutsOpen.value = true
		},
	},
	{ label: 'Log out', icon: 'lucide-log-out', onClick: () => logout() },
])
</script>
