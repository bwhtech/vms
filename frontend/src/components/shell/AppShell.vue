<template>
	<div v-if="!ready" class="grid h-screen place-items-center bg-surface-base">
		<Spinner class="size-6 text-ink-gray-5" />
	</div>

	<MobileShell v-else-if="!isDesktop">
		<router-view />
		<template #nav>
			<MobileShellNav />
		</template>
	</MobileShell>

	<DesktopShell v-else :scroll="!ownScroll">
		<template #sidebar>
			<AppSidebar />
		</template>
		<router-view />
	</DesktopShell>

	<!-- Every global overlay is mounted once here and opened through
	     `useOverlays()`, so no page owns a dialog it did not open. -->
	<CommandPalette />
	<NotificationsPanel />
	<KeyboardShortcutsDialog />
	<VmsSettingsDialog />
	<UploadDialog />
	<UploadQueuePanel />
	<CreateProjectDialog />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DesktopShell, MobileShell, Spinner, useKeyboardShortcut, usePageMeta } from 'frappe-ui'
import CreateProjectDialog from '@/components/projects/CreateProjectDialog.vue'
import VmsSettingsDialog from '@/components/settings/VmsSettingsDialog.vue'
import AppSidebar from '@/components/shell/AppSidebar.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'
import KeyboardShortcutsDialog from '@/components/shell/KeyboardShortcutsDialog.vue'
import MobileShellNav from '@/components/shell/MobileShellNav.vue'
import NotificationsPanel from '@/components/shell/NotificationsPanel.vue'
import UploadDialog from '@/components/upload/UploadDialog.vue'
import UploadQueuePanel from '@/components/upload/UploadQueuePanel.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useOverlays, type SettingsTab } from '@/composables/useOverlays'
import { useSession } from '@/composables/useSession'

usePageMeta(() => ({ title: 'VMS' }))

const route = useRoute()
const router = useRouter()
const { isDesktop } = useBreakpoint()
const { ready } = useSession()
const { commandPaletteOpen, shortcutsOpen, openSettings, openUpload } = useOverlays()

// Pages that own their scroll (the audit log) render a fixed-height body with
// their own ScrollArea, so the shell must not page-scroll around them.
const ownScroll = computed(() => route.meta.ownScroll === true)

const SETTINGS_TABS: SettingsTab[] = ['profile', 'general', 'transcription', 'youtube', 'users']

// `?settings=<tab>` is the deep link the YouTube OAuth callback and the old
// app's links use. Read it once, then strip it so a reload does not reopen.
onMounted(() => {
	const tab = route.query.settings
	if (typeof tab !== 'string') return
	openSettings(SETTINGS_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : 'profile')
	const query = { ...route.query }
	delete query.settings
	router.replace({ query })
})

useKeyboardShortcut([
	{
		combo: 'Mod+K',
		description: 'Open command palette',
		group: 'Global',
		allowInInput: true,
		handler: () => {
			commandPaletteOpen.value = !commandPaletteOpen.value
		},
	},
	{
		combo: 'U',
		description: 'Upload files',
		group: 'Global',
		handler: () => openUpload(),
	},
	{
		combo: 'Mod+Comma',
		description: 'Open settings',
		group: 'Global',
		allowInInput: true,
		handler: () => openSettings('profile'),
	},
	{
		combo: 'Shift+Slash',
		description: 'Show keyboard shortcuts',
		group: 'Global',
		handler: () => {
			shortcutsOpen.value = !shortcutsOpen.value
		},
	},
])
</script>
