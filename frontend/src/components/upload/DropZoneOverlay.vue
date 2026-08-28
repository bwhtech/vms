<template>
	<div
		class="relative"
		@dragenter="handleDragEnter"
		@dragleave="handleDragLeave"
		@dragover="handleDragOver"
		@drop="handleDrop"
	>
		<slot />
		<div
			v-if="isDragging"
			class="pointer-events-none absolute inset-0 z-40 grid place-items-center rounded-6 border-2 border-dashed border-outline-gray-5 bg-surface-elevation-2/90 backdrop-blur-[2px]"
			data-testid="page-drop-zone"
		>
			<div class="flex flex-col items-center gap-2 text-ink-gray-7">
				<span class="lucide-cloud-upload size-10" aria-hidden="true" />
				<span class="text-base-medium">Drop files to upload</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ drop: [files: File[]] }>()

const isDragging = ref(false)
let dragDepth = 0

watch(
	() => props.disabled,
	(disabled) => {
		if (!disabled) return
		dragDepth = 0
		isDragging.value = false
	},
)

function handleDragEnter(event: DragEvent): void {
	if (!isFileDrag(event)) return
	event.preventDefault()
	event.stopPropagation()
	if (props.disabled) return
	dragDepth++
	isDragging.value = true
}

function handleDragLeave(event: DragEvent): void {
	if (!isDragging.value && dragDepth === 0) return
	event.preventDefault()
	event.stopPropagation()
	dragDepth = Math.max(0, dragDepth - 1)
	if (dragDepth === 0) isDragging.value = false
}

function handleDragOver(event: DragEvent): void {
	if (!isFileDrag(event)) return
	event.preventDefault()
	event.stopPropagation()
}

function handleDrop(event: DragEvent): void {
	if (!isDragging.value && !isFileDrag(event)) return
	event.preventDefault()
	event.stopPropagation()
	dragDepth = 0
	isDragging.value = false
	if (props.disabled) return
	const files = Array.from(event.dataTransfer?.files ?? [])
	if (files.length > 0) emit('drop', files)
}

function isFileDrag(event: DragEvent): boolean {
	const types = Array.from(event.dataTransfer?.types ?? [])
	return types.includes('Files') && !types.includes('application/vms-assets')
}
</script>
