<template>
	<SidePanel v-model:open="notificationsOpen" title="Notifications">
		<p class="text-p-base text-ink-gray-6">Coming in W8.</p>
	</SidePanel>
</template>

<script setup lang="ts">
import SidePanel from '@/components/common/SidePanel.vue'
import { useOverlays } from '@/composables/useOverlays'

const { notificationsOpen } = useOverlays()
</script>
