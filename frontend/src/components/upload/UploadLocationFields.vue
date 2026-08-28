<template>
	<div class="grid gap-4 sm:grid-cols-2">
		<Combobox
			v-model="project"
			v-model:query="projectQuery"
			trigger="button"
			label="Project"
			placeholder="Choose a project"
			:options="projectOptions"
			:loading="projects.loading"
			empty-text="No projects found"
		/>
		<Combobox
			v-model="folder"
			v-model:query="folderQuery"
			trigger="button"
			label="Folder"
			placeholder="Project root"
			:options="folderOptions"
			:loading="folders.loading"
			:disabled="!project"
			empty-text="No folders found"
		/>
		<Select
			v-model="category"
			class="sm:col-span-2"
			label="Category"
			:description="hasQueuedFiles ? 'Applies to files you add next.' : undefined"
			:options="categoryOptions"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Combobox, Select, useList } from 'frappe-ui'

import { ASSET_CATEGORIES, type Folder, type Project } from '@/types'
import { buildFolderOptions } from '@/lib/folderPaths'

defineProps<{ hasQueuedFiles?: boolean }>()

const project = defineModel<string>('project', { required: true })
const folder = defineModel<string>('folder', { required: true })
const category = defineModel<string>('category', { required: true })

const projectQuery = ref('')
const folderQuery = ref('')

watch(project, () => {
	projectQuery.value = ''
})

watch(folder, () => {
	folderQuery.value = ''
})

const projects = useList<Pick<Project, 'name' | 'project_name'>>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name'],
	orderBy: 'modified desc',
	limit: 200,
	cacheKey: 'upload-projects',
})

const folders = useList<Folder>({
	doctype: 'VMS Folder',
	fields: [
		'name',
		'folder_name',
		'project',
		'parent_folder',
		'deleted_at',
		'creation',
		'modified',
	],
	orderBy: 'folder_name asc',
	limit: 500,
	cacheKey: 'upload-folders',
})

const projectOptions = computed(() => [
	{ label: 'Inbox (no project)', value: '', icon: 'lucide-inbox' },
	...(projects.data ?? []).map((item) => ({
		label: item.project_name,
		value: item.name,
		icon: 'lucide-folder',
	})),
])

const folderOptions = computed(() => {
	if (!project.value) return []
	const available = (folders.data ?? []).filter(
		(item) => item.project === project.value && !item.deleted_at,
	)
	return [
		{ label: 'Project root', value: '', icon: 'lucide-folder-root' },
		...buildFolderOptions(available).map((item) => ({
			label: item.path,
			value: item.name,
			icon: 'lucide-folder',
		})),
	]
})

const categoryOptions = ASSET_CATEGORIES.map((value) => ({ label: value, value }))
</script>
