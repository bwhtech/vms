<template>
	<Dialog v-model:open="settingsOpen" title="Settings">
		<p class="text-p-base text-ink-gray-6">Coming in W7. Requested tab: {{ settingsTab }}.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { settingsOpen, settingsTab } = useOverlays()
</script>
