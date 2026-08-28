<template>
	<Dialog v-model:open="createProjectOpen" title="New project">
		<p class="text-p-base text-ink-gray-6">Coming in W2.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { createProjectOpen } = useOverlays()
</script>
