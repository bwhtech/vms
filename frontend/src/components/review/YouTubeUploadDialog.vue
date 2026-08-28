<template>
	<Dialog v-model:open="review.panels.youtube.value" title="Upload to YouTube">
		<p class="text-p-sm text-ink-gray-5">YouTube upload options are loading.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useReview } from '@/composables/useReview'

const review = useReview()
</script>
