<template>
	<div
		v-if="active"
		class="absolute inset-0 z-10"
		:class="readOnly ? 'pointer-events-none' : 'pointer-events-auto'"
		data-testid="annotation-canvas"
	>
		<canvas ref="canvasElement" class="absolute inset-0" />
	</div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AnnotationJson } from '@/types'
import { useFabricCanvas } from '@/composables/useFabricCanvas'

const props = withDefaults(
	defineProps<{
		target?: HTMLElement | null
		active?: boolean
		readOnly?: boolean
		annotationData?: AnnotationJson | null
	}>(),
	{
		target: null,
		active: false,
		readOnly: false,
		annotationData: null,
	},
)

const canvasElement = ref<HTMLCanvasElement | null>(null)
const fabricCanvas = useFabricCanvas()
let resizeObserver: ResizeObserver | null = null
let generation = 0

watch(
	() => [props.active, props.readOnly, props.annotationData, props.target] as const,
	() => void mountCanvas(),
	{ immediate: true },
)

async function mountCanvas() {
	const currentGeneration = ++generation
	stopObserving()
	if (!props.active) {
		await fabricCanvas.dispose()
		return
	}
	await nextTick()
	if (currentGeneration !== generation || !canvasElement.value) return
	const target = props.target ?? canvasElement.value.parentElement
	if (!target) return
	const { width, height } = target.getBoundingClientRect()
	fabricCanvas.init(canvasElement.value, width, height, props.readOnly)
	if (props.annotationData) {
		await fabricCanvas.loadForDisplay(props.annotationData, props.readOnly)
	}
	if (currentGeneration !== generation) return
	resizeObserver = new ResizeObserver(() => {
		const rect = target.getBoundingClientRect()
		void fabricCanvas.resize(rect.width, rect.height)
	})
	resizeObserver.observe(target)
}

function stopObserving() {
	resizeObserver?.disconnect()
	resizeObserver = null
}

onBeforeUnmount(() => {
	generation += 1
	stopObserving()
	void fabricCanvas.dispose()
})
</script>
