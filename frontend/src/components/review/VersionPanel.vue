<template>
	<SidePanel v-model:open="review.panels.versions.value" title="Versions">
		<p class="text-p-sm text-ink-gray-5">Version history is loading.</p>
	</SidePanel>
</template>

<script setup lang="ts">
import SidePanel from '@/components/common/SidePanel.vue'
import { useReview } from '@/composables/useReview'

const review = useReview()
</script>
