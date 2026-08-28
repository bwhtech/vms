<template>
	<SettingsDialog v-model:open="settingsOpen" v-model:tab="settingsTab" :shortcut="false">
		<SettingsSidebar>
			<SettingsNavGroup label="Account">
				<SettingsNavItem value="profile" data-testid="settings-nav-profile">
					<template #prefix>
						<span class="lucide-user size-4" aria-hidden="true" />
					</template>
					Profile
				</SettingsNavItem>
			</SettingsNavGroup>
			<SettingsNavGroup v-if="isSystemManager" label="Workspace">
				<SettingsNavItem value="general" data-testid="settings-nav-general">
					<template #prefix>
						<span class="lucide-settings-2 size-4" aria-hidden="true" />
					</template>
					General
				</SettingsNavItem>
				<SettingsNavItem value="transcription" data-testid="settings-nav-transcription">
					<template #prefix>
						<span class="lucide-captions size-4" aria-hidden="true" />
					</template>
					Transcription
				</SettingsNavItem>
				<SettingsNavItem value="youtube" data-testid="settings-nav-youtube">
					<template #prefix><YoutubeIcon class="size-4" /></template>
					YouTube
				</SettingsNavItem>
			</SettingsNavGroup>
			<SettingsNavGroup label="Team">
				<SettingsNavItem value="users" data-testid="settings-nav-users">
					<template #prefix>
						<span class="lucide-users size-4" aria-hidden="true" />
					</template>
					Users
				</SettingsNavItem>
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent>
			<SettingsTabProfile />
			<template v-if="isSystemManager">
				<SettingsTabGeneral />
				<SettingsTabTranscription />
				<SettingsTabYoutube />
			</template>
			<SettingsTabUsers />
		</SettingsContent>
	</SettingsDialog>
</template>

<script setup lang="ts">
import {
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsSidebar,
} from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'
import { useSession } from '@/composables/useSession'
import YoutubeIcon from '@/components/common/YoutubeIcon.vue'
import SettingsTabGeneral from './SettingsTabGeneral.vue'
import SettingsTabProfile from './SettingsTabProfile.vue'
import SettingsTabTranscription from './SettingsTabTranscription.vue'
import SettingsTabUsers from './SettingsTabUsers.vue'
import SettingsTabYoutube from './SettingsTabYoutube.vue'

// Opened via `useOverlays().openSettings(tab)` — the shell owns the `Mod+,`
// shortcut and the `?settings=<tab>` deep link, so the built-in one is off.
const { settingsOpen, settingsTab } = useOverlays()
const { isSystemManager } = useSession()
</script>
