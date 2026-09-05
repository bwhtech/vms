<template>
	<article
		class="group relative rounded-5 border bg-surface-base transition hover:shadow-sm"
		:class="
			dragOver
				? 'border-outline-gray-3 bg-surface-gray-2'
				: 'border-outline-gray-1 hover:border-outline-gray-2'
		"
		:draggable="draggable"
		@dragstart="startDrag"
		@dragend="dragOver = false"
		@dragover="onDragOver"
		@dragleave="onDragLeave"
		@drop="onDrop"
	>
		<RouterLink
			class="block focus:outline-none"
			:to="`/projects/${folder.project || project}/folder/${folder.name}`"
		>
			<div class="grid aspect-[4/3] place-items-center rounded-t-5 bg-surface-gray-1 p-5">
				<svg
					class="w-3/5 transition-opacity group-hover:opacity-90"
					viewBox="0 0 64 52"
					aria-hidden="true"
				>
					<path
						class="fill-current text-ink-gray-4"
						d="M2 10a8 8 0 0 1 8-8h11.6a8 8 0 0 1 5.66 2.34L30.8 8H54a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V10Z"
					/>
					<path
						class="fill-current text-ink-gray-3"
						d="M2 20a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v22a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V20Z"
					/>
				</svg>
			</div>

			<div class="flex min-w-0 items-start gap-2 p-3">
				<div class="min-w-0 flex-1">
					<p class="truncate text-base text-ink-gray-8" :title="folder.folder_name">
						{{ folder.folder_name }}
					</p>
					<p class="mt-1 truncate text-sm text-ink-gray-5">
						{{ itemCount === 1 ? '1 item' : `${itemCount ?? 0} items` }}
						<template v-if="folder.modified">
							· {{ fromNow(folder.modified) }}
						</template>
					</p>
				</div>
				<div class="size-7 shrink-0" aria-hidden="true" />
			</div>
		</RouterLink>

		<div
			class="absolute bottom-3 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
			@click.stop
		>
			<Dropdown :options="actions" align="end">
				<Button
					variant="ghost"
					icon="lucide-ellipsis-vertical"
					aria-label="Folder actions"
					@click.stop
				/>
			</Dropdown>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Button, Dropdown } from 'frappe-ui'
import type { Folder } from '@/types'
import { fromNow } from '@/lib/dates'

const props = defineProps<{
	folder: Folder
	project: string
	itemCount?: number
	draggable?: boolean
}>()
const emit = defineEmits<{
	rename: [folder: Folder]
	move: [folder: Folder]
	share: [folder: Folder]
	delete: [folder: Folder]
	'drop-assets': [names: string[], folder: string]
	'drop-folder': [name: string, folder: string]
}>()
const dragOver = ref(false)

const actions = computed(() => [
	{ label: 'Rename', icon: 'lucide-pencil', onClick: () => emit('rename', props.folder) },
	{ label: 'Move', icon: 'lucide-folder-input', onClick: () => emit('move', props.folder) },
	{ label: 'Share', icon: 'lucide-share-2', onClick: () => emit('share', props.folder) },
	{
		label: 'Delete',
		icon: 'lucide-trash-2',
		theme: 'red' as const,
		onClick: () => emit('delete', props.folder),
	},
])

function startDrag(event: DragEvent) {
	if (!props.draggable || !event.dataTransfer) return
	event.dataTransfer.setData('application/vms-folder', props.folder.name)
	event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent) {
	if (!event.dataTransfer) return
	const accepted =
		event.dataTransfer.types.includes('application/vms-assets') ||
		event.dataTransfer.types.includes('application/vms-folder')
	if (!accepted) return
	event.preventDefault()
	dragOver.value = true
}

function onDragLeave(event: DragEvent) {
	if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) return
	dragOver.value = false
}

function onDrop(event: DragEvent) {
	if (!event.dataTransfer) return
	event.preventDefault()
	dragOver.value = false
	const folder = event.dataTransfer.getData('application/vms-folder')
	if (folder && folder !== props.folder.name) emit('drop-folder', folder, props.folder.name)
	const payload = event.dataTransfer.getData('application/vms-assets')
	if (!payload) return
	try {
		const names = JSON.parse(payload) as string[]
		if (names.length) emit('drop-assets', names, props.folder.name)
	} catch {
		// Ignore malformed drag payloads from outside VMS.
	}
}
</script>
