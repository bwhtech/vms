<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">Projects</h1>
		</PageHeaderTitle>
		<Button
			label="New project"
			icon-left="lucide-plus"
			variant="solid"
			theme="gray"
			data-testid="new-project"
			@click="createProjectOpen = true"
		/>
	</PageHeader>
	<div class="px-3 py-5 pb-10 sm:px-5">
		<div
			v-if="projects.loading && !projects.data"
			class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
		>
			<div
				v-for="index in 6"
				:key="index"
				class="space-y-3 rounded-md border border-outline-gray-1 p-4"
			>
				<LoadingText :lines="2" />
			</div>
		</div>
		<ErrorMessage v-else-if="projects.error" :message="projects.error.message" />
		<EmptyState
			v-else-if="!projects.data?.length"
			icon="lucide-folder"
			title="No projects yet"
			description="Create your first project to organise video assets."
		>
			<template #actions>
				<Button
					label="New project"
					icon-left="lucide-plus"
					variant="solid"
					theme="gray"
					@click="createProjectOpen = true"
				/>
			</template>
		</EmptyState>
		<div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<ProjectCard v-for="project in projects.data" :key="project.name" :project="project" />
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	Button,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	useList,
	usePageMeta,
} from 'frappe-ui'
import type { Project } from '@/types'
import EmptyState from '@/components/common/EmptyState.vue'
import ProjectCard from '@/components/projects/ProjectCard.vue'
import { useOverlays } from '@/composables/useOverlays'

usePageMeta(() => ({ title: 'Projects · VMS' }))

const { createProjectOpen } = useOverlays()
const projects = useList<Project>({
	doctype: 'VMS Project',
	fields: [
		'name',
		'project_name',
		'description',
		'status',
		'owner_user',
		'due_date',
		'thumbnail_url',
		'share_token',
		'creation',
		'modified',
	],
	orderBy: 'modified desc',
	limit: 200,
	cacheKey: 'projects-page',
})
</script>
