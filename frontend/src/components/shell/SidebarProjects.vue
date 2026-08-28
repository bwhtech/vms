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
		<!-- Every row action lives in a right-click menu, so the row itself is
		     nothing but the link: no hover buttons taking up the trailing zone. -->
		<ContextMenu
			v-for="project in orderedProjects"
			:key="project.name"
			:options="menuFor(project)"
		>
			<SidebarItem
				:label="project.project_name"
				:to="`/projects/${project.name}`"
				:active="activeProjectId === project.name"
				data-testid="sidebar-project"
				:data-project="project.name"
				:data-pinned="isPinned(project.name) ? 'true' : undefined"
			>
				<template #prefix>
					<IdentityAvatar
						:name="project.name"
						:icon="project.icon"
						:color="project.color"
						:avatar="project.avatar"
						size="xs"
						hide-tooltip
					/>
				</template>
				<template #suffix>
					<span
						v-if="isPinned(project.name)"
						class="lucide-pin mr-1.5 size-3 shrink-0 text-ink-gray-4"
						aria-label="Pinned"
						role="img"
					/>
				</template>
			</SidebarItem>
		</ContextMenu>
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
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
	Button,
	ContextMenu,
	SidebarItem,
	SidebarLabel,
	dialog,
	toast,
	useDoctype,
	useList,
	type ContextMenuOptions,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import { useOverlays } from '@/composables/useOverlays'
import { usePinnedProjects } from '@/composables/usePinnedProjects'
import IdentityAvatar from '@/components/common/IdentityAvatar.vue'

const LIMIT = 8

interface SidebarProject {
	name: string
	project_name: string
	icon?: string | null
	color?: string | null
	avatar?: string | null
}

const route = useRoute()
const router = useRouter()
const { createProjectOpen } = useOverlays()
const { pinned, isPinned, toggle: togglePin } = usePinnedProjects()

const projects = useList<SidebarProject>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name', 'icon', 'color', 'avatar'],
	orderBy: 'modified desc',
	limit: LIMIT,
	cacheKey: 'sidebar-projects',
})

/**
 * A pin must outlast the cap: the recent-projects query above is a window, and
 * a project pinned today drops out of it as soon as eight others are touched.
 * This second list fetches exactly the pinned rows, and only when there are any.
 */
const pinnedProjects = useList<SidebarProject>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name', 'icon', 'color', 'avatar'],
	filters: () => ({ name: ['in', pinned.value] }),
	limit: 50,
	immediate: false,
	cacheKey: 'sidebar-pinned-projects',
})

watch(
	pinned,
	(names) => {
		if (names.length) void pinnedProjects.reload()
	},
	{ immediate: true },
)

/** Both project routes carry `projectId`; a folder view still lights its project. */
const activeProjectId = computed(() => String(route.params.projectId ?? ''))

/** Pinned projects first, in pin order; everything else keeps the query's order. */
const orderedProjects = computed<SidebarProject[]>(() => {
	const rows = projects.data ?? []
	const byName = new Map(
		[...rows, ...(pinnedProjects.data ?? [])].map((project) => [project.name, project]),
	)
	const top = pinned.value
		.map((name) => byName.get(name))
		.filter((project): project is SidebarProject => project !== undefined)
	const rest = rows.filter((project) => !isPinned(project.name))
	return [...top, ...rest]
})

// -- row actions ---------------------------------------------------------

const projectDoctype = useDoctype<SidebarProject>('VMS Project')

function menuFor(project: SidebarProject): ContextMenuOptions {
	const pinnedRow = isPinned(project.name)
	return [
		{
			label: pinnedRow ? 'Unpin' : 'Pin to top',
			icon: pinnedRow ? 'lucide-pin-off' : 'lucide-pin',
			onClick: () => togglePin(project.name),
		},
		{ label: 'Rename', icon: 'lucide-pencil', onClick: () => rename(project) },
		{
			label: 'Delete',
			icon: 'lucide-trash-2',
			theme: 'red',
			onClick: () => confirmDelete(project),
		},
	]
}

function rename(project: SidebarProject) {
	dialog.prompt({
		title: 'Rename project',
		confirmLabel: 'Rename',
		fields: [
			{
				name: 'project_name',
				label: 'Project name',
				required: true,
				defaultValue: project.project_name,
			},
		],
		onConfirm: async ({ values }) => {
			const projectName = String(values.project_name ?? '').trim()
			if (!projectName || projectName === project.project_name) return
			try {
				await projectDoctype.setValue.submit({
					name: project.name,
					project_name: projectName,
				})
			} catch (error) {
				toast.error(serverMessage(error) || 'Could not rename the project')
				return
			}
			projects.reload()
		},
	})
}

function confirmDelete(project: SidebarProject) {
	dialog.danger({
		title: 'Delete project?',
		message: `“${project.project_name}” can only be deleted when it contains no assets or folders.`,
		confirmLabel: 'Delete project',
		onConfirm: async () => {
			try {
				await projectDoctype.delete.submit({ name: project.name })
			} catch (error) {
				toast.error(serverMessage(error) || 'Empty the project before deleting it')
				return
			}
			toast.success('Project deleted')
			projects.reload()
			// The page the sidebar was pointing at no longer has a document.
			if (activeProjectId.value === project.name) await router.push('/projects')
		},
	})
}
</script>
