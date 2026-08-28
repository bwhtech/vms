import { ref } from 'vue'
import type { SettingsTab, UploadContext } from '@/types'

export type { SettingsTab, UploadContext }

/**
 * App-level overlay state. `AppShell` mounts every overlay once and reads its
 * flag from here, so any page — or the command palette, from any route — opens
 * one without props to thread or a dialog of its own to own.
 */
const commandPaletteOpen = ref(false)
const notificationsOpen = ref(false)
const shortcutsOpen = ref(false)
const settingsOpen = ref(false)
const settingsTab = ref<SettingsTab>('profile')
const uploadOpen = ref(false)
const uploadContext = ref<UploadContext>({})
const createProjectOpen = ref(false)

export function useOverlays() {
	function openSettings(tab: SettingsTab = 'profile') {
		settingsTab.value = tab
		settingsOpen.value = true
	}

	function openUpload(ctx: UploadContext = {}) {
		uploadContext.value = ctx
		uploadOpen.value = true
	}

	return {
		commandPaletteOpen,
		notificationsOpen,
		shortcutsOpen,
		settingsOpen,
		settingsTab,
		openSettings,
		uploadOpen,
		uploadContext,
		openUpload,
		createProjectOpen,
	}
}
