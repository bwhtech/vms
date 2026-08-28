<template>
	<ListRow
		class="group"
		:class="dragOver && 'bg-surface-gray-2 outline outline-outline-gray-3'"
		:draggable="draggable"
		@dragstart="startDrag"
		@dragend="dragOver = false"
		@dragover="onDragOver"
		@dragleave="onDragLeave"
		@drop="onDrop"
	>
		<ListCell>
			<Button
				class="min-w-0 justify-start"
				variant="ghost"
				icon-left="lucide-folder"
				:label="folder.folder_name"
				:route="`/projects/${folder.project || project}/folder/${folder.name}`"
			/>
		</ListCell>
		<ListCell v-if="compact" class="justify-end text-sm text-ink-gray-5">
			{{ itemCount }}
		</ListCell>
		<template v-else>
			<ListCell><span class="text-sm text-ink-gray-5">Folder</span></ListCell>
			<ListCell>
				<span class="text-sm text-ink-gray-5">{{ fromNow(folder.modified) }}</span>
			</ListCell>
			<ListCell>
				<span class="text-sm text-ink-gray-5">{{ itemCount }} items</span>
			</ListCell>
			<ListCell class="justify-end">
				<Dropdown :options="actions" align="end">
					<Button
						variant="ghost"
						icon="lucide-ellipsis-vertical"
						aria-label="Folder actions"
						@click.stop
					/>
				</Dropdown>
			</ListCell>
		</template>
	</ListRow>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Dropdown } from 'frappe-ui'
import { ListCell, ListRow } from 'frappe-ui/list'
import type { Folder } from '@/types'
import { fromNow } from '@/lib/dates'

const props = defineProps<{
	folder: Folder
	project: string
	itemCount?: number
	compact?: boolean
	draggable?: boolean
}>()
const emit = defineEmits<{
	rename: [folder: Folder]
	move: [folder: Folder]
	delete: [folder: Folder]
	'drop-assets': [names: string[], folder: string]
	'drop-folder': [name: string, folder: string]
}>()
const dragOver = ref(false)

const actions = computed(() => [
	{ label: 'Rename', icon: 'lucide-pencil', onClick: () => emit('rename', props.folder) },
	{ label: 'Move', icon: 'lucide-folder-input', onClick: () => emit('move', props.folder) },
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
