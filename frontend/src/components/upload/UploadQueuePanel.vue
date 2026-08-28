<template>
	<!-- Docked bottom-right while uploads run and the dialog is closed. -->
	<div
		v-if="active && !uploadOpen"
		class="fixed bottom-4 right-4 z-20 w-80 rounded-lg border border-outline-gray-2 bg-surface-base p-3 shadow-lg"
	>
		<p class="text-p-sm text-ink-gray-6">{{ active }} uploading… Coming in W3.</p>
	</div>
</template>

<script setup lang="ts">
import { useOverlays } from '@/composables/useOverlays'
import { useUploadQueue } from '@/composables/useUploadQueue'

const { uploadOpen } = useOverlays()
const { active } = useUploadQueue()
</script>
