<template>
	<label
		class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-6 border-2 border-dashed p-6 text-center"
		:class="dropAreaClasses"
		data-testid="upload-drop-area"
		@dragenter.prevent="dragging = true"
		@dragleave.prevent="dragging = false"
		@dragover.prevent
		@drop.prevent.stop="handleDrop"
	>
		<span class="lucide-cloud-upload size-8 text-ink-gray-5" aria-hidden="true" />
		<span class="text-base-medium text-ink-gray-8">
			{{
				singular
					? 'Drop a file here or click to browse'
					: 'Drop files here or click to browse'
			}}
		</span>
		<span class="text-p-sm text-ink-gray-5">Video, audio, or image files</span>
		<input
			class="sr-only"
			type="file"
			:accept="ACCEPTED_FILES"
			:disabled="disabled"
			:multiple="!singular"
			@change="handleSelection"
		/>
	</label>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const ACCEPTED_FILES = 'video/*,audio/*,image/*,.mkv,.avi,.m4v'

const props = defineProps<{ singular?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ files: [files: File[]] }>()

const dragging = ref(false)

const dropAreaClasses = computed(() => {
	if (props.disabled)
		return 'cursor-not-allowed border-outline-gray-2 bg-surface-gray-1 opacity-60'
	if (dragging.value) return 'cursor-copy border-outline-gray-5 bg-surface-gray-2'
	return 'cursor-pointer border-outline-gray-3 bg-surface-base hover:bg-surface-gray-1'
})

function handleSelection(event: Event): void {
	const input = event.target as HTMLInputElement
	emitFiles(Array.from(input.files ?? []))
	input.value = ''
}

function handleDrop(event: DragEvent): void {
	dragging.value = false
	if (props.disabled) return
	emitFiles(Array.from(event.dataTransfer?.files ?? []))
}

function emitFiles(files: File[]): void {
	if (props.disabled || files.length === 0) return
	emit('files', props.singular ? files.slice(0, 1) : files)
}
</script>
