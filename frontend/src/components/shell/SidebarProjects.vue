<template>
	<div class="mt-4 flex h-7 items-center justify-between">
		<SidebarLabel>Projects</SidebarLabel>
		<Button
			variant="ghost"
			icon="lucide-plus text-ink-gray-5"
			label="New project"
			@click="createProjectOpen = true"
		/>
	</div>

	<nav class="mt-0.5 flex flex-col gap-0.5">
		<SidebarItem
			v-for="project in projects.data ?? []"
			:key="project.name"
			icon="lucide-folder"
			:label="project.project_name"
			:to="`/projects/${project.name}`"
			:active="activeProjectId === project.name"
			data-testid="sidebar-project"
			:data-project="project.name"
		/>
		<!-- The list is capped at `LIMIT`; a full page means there may be more. -->
		<SidebarItem
			v-if="(projects.data?.length ?? 0) >= LIMIT"
			icon="lucide-ellipsis"
			label="All projects"
			to="/projects"
			:active="false"
		/>
	</nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Button, SidebarItem, SidebarLabel, useList } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const LIMIT = 8

interface SidebarProject {
	name: string
	project_name: string
}

const route = useRoute()
const { createProjectOpen } = useOverlays()

const projects = useList<SidebarProject>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name'],
	orderBy: 'modified desc',
	limit: LIMIT,
	cacheKey: 'sidebar-projects',
})

/** Both project routes carry `projectId`; a folder view still lights its project. */
const activeProjectId = computed(() => String(route.params.projectId ?? ''))
</script>
