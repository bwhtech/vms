<template>
	<div ref="container" @dragover="dragOver" @dragleave="dragLeave" @drop="drop">
		<Breadcrumbs :items="items" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Breadcrumbs } from 'frappe-ui'
import type { Folder } from '@/types'

const props = defineProps<{ project: string; projectName: string; trail: Folder[] }>()
const emit = defineEmits<{
	'drop-assets': [names: string[], folder: string | null]
	'drop-folder': [name: string, folder: string | null]
}>()
const container = ref<HTMLElement | null>(null)
const highlighted = ref<HTMLElement | null>(null)

const items = computed(() => [
	{ label: 'Projects', route: '/projects' },
	{ label: props.projectName, route: `/projects/${props.project}` },
	...props.trail.map((folder) => ({
		label: folder.folder_name,
		route: `/projects/${props.project}/folder/${folder.name}`,
	})),
])

function targetFor(event: DragEvent): { element: HTMLElement; folder: string | null } | null {
	const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('a, button')
	if (!element || !container.value?.contains(element)) return null
	const crumbs = Array.from(container.value.querySelectorAll<HTMLElement>('a, button'))
	const index = crumbs.indexOf(element)
	if (index < 1) return null
	return { element, folder: index === 1 ? null : (props.trail[index - 2]?.name ?? null) }
}

function dragOver(event: DragEvent) {
	if (!event.dataTransfer) return
	const accepted =
		event.dataTransfer.types.includes('application/vms-assets') ||
		event.dataTransfer.types.includes('application/vms-folder')
	const target = accepted ? targetFor(event) : null
	if (!target) return
	event.preventDefault()
	target.element.classList.add('bg-surface-gray-2', 'outline', 'outline-outline-gray-3')
	if (highlighted.value && highlighted.value !== target.element) clearHighlight()
	highlighted.value = target.element
}

function dragLeave(event: DragEvent) {
	if (container.value?.contains(event.relatedTarget as Node)) return
	clearHighlight()
}

function drop(event: DragEvent) {
	const target = targetFor(event)
	if (!target || !event.dataTransfer) return
	event.preventDefault()
	const movedFolder = event.dataTransfer.getData('application/vms-folder')
	if (movedFolder) emit('drop-folder', movedFolder, target.folder)
	const assets = event.dataTransfer.getData('application/vms-assets')
	if (assets) {
		try {
			emit('drop-assets', JSON.parse(assets) as string[], target.folder)
		} catch {
			// Ignore malformed drag payloads from outside VMS.
		}
	}
	clearHighlight()
}

function clearHighlight() {
	highlighted.value?.classList.remove('bg-surface-gray-2', 'outline', 'outline-outline-gray-3')
	highlighted.value = null
}
</script>
