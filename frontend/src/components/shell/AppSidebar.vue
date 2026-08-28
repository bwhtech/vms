<template>
	<Sidebar width="14rem">
		<SidebarHeader
			title="VMS"
			:subtitle="siteName"
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
					icon="lucide-folder"
					label="Projects"
					to="/projects"
					:active="route.path.startsWith('/projects')"
				/>
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
				<SidebarItem icon="lucide-wrench" label="Tools" to="/tools" />
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
import { computed } from 'vue'
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
const LOGO_URL = `${import.meta.env.BASE_URL}vms-logo.png`

interface SidebarCounts {
	uncategorised: number
}

/** The `SidebarHeader` dropdown takes a narrower shape than `Dropdown` does. */
interface MenuItem {
	label: string
	icon: string
	onClick: () => void
}

const route = useRoute()
const { logout } = useSession()
const { commandPaletteOpen, notificationsOpen, openSettings, shortcutsOpen } = useOverlays()
const { unreadCount } = useNotifications()

const siteName = window.site_name ?? ''

const counts = useCall<SidebarCounts>({
	url: '/api/v2/method/vms.api.get_sidebar_counts',
	method: 'GET',
	cacheKey: 'sidebar-counts',
})

const uncategorisedCount = computed(() => counts.data?.uncategorised ?? 0)
// Unread comes from the shared notification list, so marking read in the
// panel clears the dot without a second round trip.
const hasUnread = computed(() => unreadCount.value > 0)

// Workspace-level actions belong to the workspace, so they hang off its header.
const workspaceMenu: MenuItem[] = [
	{ label: 'Settings', icon: 'lucide-settings', onClick: () => openSettings('profile') },
	{
		label: 'Keyboard shortcuts',
		icon: 'lucide-keyboard',
		onClick: () => {
			shortcutsOpen.value = true
		},
	},
	{ label: 'Log out', icon: 'lucide-log-out', onClick: () => logout() },
]
</script>
