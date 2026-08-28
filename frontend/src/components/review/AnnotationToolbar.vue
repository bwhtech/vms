<template>
	<div class="space-y-2 border-t border-outline-gray-1 px-3 py-2">
		<div class="flex items-center gap-2">
			<div v-if="editing" class="flex items-center gap-1">
				<Button variant="ghost" size="sm" :disabled="saving" @click="emit('cancel')">
					Cancel
				</Button>
				<Button variant="solid" size="sm" :loading="saving" @click="emit('save')">
					Save
				</Button>
			</div>
			<Button
				v-else
				variant="ghost"
				size="sm"
				aria-label="Finish drawing"
				title="Finish drawing"
				@click="emit('done')"
			>
				<span class="lucide-check size-4" />
			</Button>

			<div class="h-5 w-px bg-outline-gray-2" />
			<TabButtons v-model="activeTool" :options="tools" variant="ghost" size="sm">
				<template #prefix="{ button }">
					<span :class="toolIcons[String(button.value)]" class="size-4 shrink-0" />
				</template>
			</TabButtons>
		</div>

		<div class="flex items-center gap-1.5">
			<div class="flex items-center gap-1" aria-label="Drawing color">
				<button
					v-for="color in ANNOTATION_COLORS"
					:key="color"
					type="button"
					class="size-5 rounded-full border-2 border-surface-base shadow-sm outline outline-1 transition-transform hover:scale-110 focus-visible:outline-2"
					:class="
						color === fabricCanvas.activeColor.value
							? 'outline-outline-gray-5'
							: 'outline-transparent'
					"
					:style="{ backgroundColor: color }"
					:aria-label="`Use ${color} for drawing`"
					:aria-pressed="color === fabricCanvas.activeColor.value"
					@click="fabricCanvas.changeColor(color)"
				/>
			</div>

			<div class="ml-auto flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					aria-label="Undo drawing"
					title="Undo"
					:disabled="!fabricCanvas.canUndo.value"
					@click="fabricCanvas.undo"
				>
					<span class="lucide-undo-2 size-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					aria-label="Redo drawing"
					title="Redo"
					:disabled="!fabricCanvas.canRedo.value"
					@click="fabricCanvas.redo"
				>
					<span class="lucide-redo-2 size-4" />
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, TabButtons } from 'frappe-ui'
import { ANNOTATION_COLORS, useFabricCanvas, type DrawingTool } from '@/composables/useFabricCanvas'

withDefaults(defineProps<{ editing?: boolean; saving?: boolean }>(), {
	editing: false,
	saving: false,
})

const emit = defineEmits<{ done: []; save: []; cancel: [] }>()
const fabricCanvas = useFabricCanvas()

const activeTool = computed({
	get: () => fabricCanvas.activeTool.value,
	set: (tool) => fabricCanvas.changeTool(tool as DrawingTool),
})

const tools = [
	{ value: 'select', tooltip: 'Select' },
	{ value: 'arrow', tooltip: 'Arrow' },
	{ value: 'freehand', tooltip: 'Pen' },
	{ value: 'line', tooltip: 'Line' },
	{ value: 'rectangle', tooltip: 'Rectangle' },
	{ value: 'triangle', tooltip: 'Triangle' },
]

const toolIcons: Record<string, string> = {
	select: 'lucide-mouse-pointer-2',
	arrow: 'lucide-arrow-up-right',
	freehand: 'lucide-pen-tool',
	line: 'lucide-slash',
	rectangle: 'lucide-square',
	triangle: 'lucide-triangle',
}
</script>
