<template>
	<Dialog v-model:open="review.panels.split.value" title="Split video">
		<p class="text-p-sm text-ink-gray-5">Split options are loading.</p>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog } from 'frappe-ui'
import { useReview } from '@/composables/useReview'

const review = useReview()
</script>
