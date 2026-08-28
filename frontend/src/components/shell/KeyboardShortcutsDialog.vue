<template>
	<!-- frappe-ui's dialog lists every shortcut registered through
	     `useKeyboardShortcut`; W8 only adds the app-specific groups. -->
	<FrappeKeyboardShortcutsDialog v-model:open="shortcutsOpen" />
</template>

<script setup lang="ts">
import { KeyboardShortcutsDialog as FrappeKeyboardShortcutsDialog } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { shortcutsOpen } = useOverlays()
</script>
