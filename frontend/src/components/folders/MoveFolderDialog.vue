<template>
	<Dialog
		:open="open"
		title="Move folder"
		size="sm"
		:actions="[
			{
				label: 'Move',
				variant: 'solid',
				loading: move.loading,
				disabled: !target,
				onClick: submit,
			},
			{ label: 'Cancel' },
		]"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<FormControl
				v-model="targetProject"
				type="select"
				label="Project"
				:options="projectOptions"
			/>
			<FormControl
				v-model="target"
				type="select"
				label="Destination"
				:options="folderOptions"
				placeholder="Choose a destination"
				:error="move.error?.message"
			/>
			<p v-if="targetProject !== sourceProject" class="text-p-sm text-ink-gray-5">
				Everything inside this folder moves to the selected project.
			</p>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall, useList } from 'frappe-ui'
import type { Folder, Project } from '@/types'
import { buildFolderOptions, collectDescendants } from '@/lib/folderPaths'
import { serverMessage } from '@/lib/format'

const ROOT = '__root__'
const props = defineProps<{ open: boolean; folder: Folder; sourceProject: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [project: string] }>()
const targetProject = ref(props.sourceProject)
const target = ref('')

watch(
	() => props.open,
	(open) => {
		if (!open) return
		targetProject.value = props.sourceProject
		target.value = ''
	},
)
watch(targetProject, () => (target.value = ''))

const projects = useList<Pick<Project, 'name' | 'project_name'>>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name'],
	orderBy: 'project_name asc',
	limit: 500,
	cacheKey: 'move-folder-projects',
})
const folders = useList<Pick<Folder, 'name' | 'folder_name' | 'parent_folder' | 'project'>>({
	doctype: 'VMS Folder',
	fields: ['name', 'folder_name', 'parent_folder', 'project'],
	filters: () => ({ project: targetProject.value, deleted_at: ['is', 'not set'] }),
	orderBy: 'folder_name asc',
	limit: 500,
	cacheKey: ['move-folder-destinations', targetProject],
})

const projectOptions = computed(() =>
	(projects.data ?? []).map((project) => ({ label: project.project_name, value: project.name })),
)
const folderOptions = computed(() => {
	const all = (folders.data ?? []) as Folder[]
	const crossProject = targetProject.value !== props.sourceProject
	const blocked = crossProject ? new Set<string>() : collectDescendants(all, props.folder.name)
	return [
		...(props.folder.parent_folder || crossProject
			? [{ label: 'Project root', value: ROOT }]
			: []),
		...buildFolderOptions(all)
			.filter(
				(folder) => !blocked.has(folder.name) && folder.name !== props.folder.parent_folder,
			)
			.map((folder) => ({ label: folder.path, value: folder.name })),
	]
})

const move = useCall<
	unknown,
	{ folder_name_id: string; parent_folder: string | null; target_project: string }
>({
	url: '/api/v2/method/vms.api.move_folder',
	method: 'POST',
	immediate: false,
})

async function submit({ close }: { close: () => void }) {
	if (!target.value) return
	try {
		await move.submit({
			folder_name_id: props.folder.name,
			parent_folder: target.value === ROOT ? null : target.value,
			target_project: targetProject.value,
		})
		toast.success(`Moved “${props.folder.folder_name}”`)
		emit('changed', targetProject.value)
		close()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not move folder')
	}
}
</script>
