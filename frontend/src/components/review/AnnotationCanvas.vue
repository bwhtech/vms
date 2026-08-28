<template>
	<div
		class="pointer-events-none absolute inset-0"
		:class="active && !readOnly ? 'pointer-events-auto' : ''"
		data-testid="annotation-canvas"
	/>
</template>

<script setup lang="ts">
import type { AnnotationJson } from '@/types'

defineProps<{
	target?: HTMLElement | null
	active?: boolean
	readOnly?: boolean
	annotationData?: AnnotationJson | null
}>()
</script>
