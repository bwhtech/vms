<template>
	<SettingsPanel value="appearance">
		<SettingsHeader title="Appearance" description="How VMS looks on this device." />
		<SettingsBody>
			<div class="pt-6">
				<ThemeSwitcher
					name="VMS"
					:logo="LOGO_URL"
					label="Theme"
					description="Pick a look, or follow the system setting."
				/>
			</div>
		</SettingsBody>
	</SettingsPanel>
</template>

<script setup lang="ts">
import { SettingsBody, SettingsHeader, SettingsPanel, ThemeSwitcher } from 'frappe-ui'

/**
 * `ThemeSwitcher` drives `<html data-theme>` through the shared `useColorScheme`
 * singleton, so it needs no wiring — the whole app follows the choice made here.
 */
const LOGO_URL = `${import.meta.env.BASE_URL}vms-mark.svg`
</script>
