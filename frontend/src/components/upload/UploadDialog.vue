<template>
	<Dialog v-model:open="uploadOpen" title="Upload files">
		<p class="text-p-base text-ink-gray-6">Coming in W3.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { uploadOpen } = useOverlays()
</script>
