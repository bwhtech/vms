<template>
	<div
		ref="container"
		class="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-lg bg-black md:min-h-0"
		data-testid="review-image-viewer"
		@dblclick="toggle"
	>
		<img
			v-if="view.data?.url"
			:src="view.data.url"
			:alt="review.asset.value?.file_name || 'Review image'"
			class="max-h-full max-w-full object-contain"
			draggable="false"
		/>
		<ErrorMessage v-else-if="view.error" message="This image could not be loaded." />
		<Skeleton v-else class="aspect-video w-full max-w-3xl rounded-md bg-surface-gray-7" />

		<AnnotationCanvas
			:target="container"
			:active="review.annotation.mode.value !== 'off'"
			:read-only="review.annotation.mode.value === 'view'"
			:annotation-data="review.annotation.data.value"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ErrorMessage, Skeleton, useCall } from 'frappe-ui'
import type { ViewUrlResponse } from '@/types'
import AnnotationCanvas from '@/components/review/AnnotationCanvas.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import { useReview } from '@/composables/useReview'

const props = defineProps<{ assetName: string }>()
const review = useReview()
const container = ref<HTMLElement | null>(null)
const { toggle } = useFullscreen(container)

const view = useCall<ViewUrlResponse, { asset_name: string; token?: string }>({
	url: '/api/v2/method/vms.review_api.get_review_view_url',
	method: 'GET',
	params: {
		asset_name: props.assetName,
		...(review.token ? { token: review.token } : {}),
	},
	cacheKey: ['review-image-url', props.assetName, review.token ?? 'session'],
})
</script>
