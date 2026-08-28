<template>
	<Dialog v-model:open="commandPaletteOpen" title="Search">
		<p class="text-p-base text-ink-gray-6">Coming in W8.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { commandPaletteOpen } = useOverlays()
</script>
