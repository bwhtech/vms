<template>
	<RouterLink
		:to="`/projects/${project.name}`"
		class="group flex min-h-32 flex-col rounded-5 border border-outline-gray-1 bg-surface-base p-4 transition hover:border-outline-gray-2 hover:bg-surface-gray-1"
	>
		<div class="flex min-w-0 items-start gap-3">
			<div class="rounded-4 bg-surface-gray-2 p-2 text-ink-gray-5">
				<span class="lucide-folder size-5" aria-hidden="true" />
			</div>
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-lg-semibold text-ink-gray-8">
					{{ project.project_name }}
				</h2>
				<p class="mt-1 truncate text-sm text-ink-gray-4">{{ project.name }}</p>
			</div>
			<Badge :label="project.status" :theme="statusTheme" variant="subtle" />
		</div>
		<p v-if="project.description" class="mt-3 line-clamp-2 text-p-sm text-ink-gray-6">
			{{ plainDescription }}
		</p>
		<div class="mt-auto flex items-center justify-between gap-3 pt-4 text-sm text-ink-gray-5">
			<span>Updated {{ fromNow(project.modified) }}</span>
			<span v-if="project.due_date" :class="isOverdue(project.due_date) && 'text-ink-red-6'">
				Due {{ formatDate(project.due_date, 'D MMM') }}
			</span>
		</div>
	</RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge, type BadgeProps } from 'frappe-ui'
import type { Project } from '@/types'
import { formatDate, fromNow, isOverdue } from '@/lib/dates'

const props = defineProps<{ project: Project }>()

const statusTheme = computed<NonNullable<BadgeProps['theme']>>(
	() =>
		({
			Open: 'gray',
			'In Progress': 'blue',
			'In Review': 'amber',
			Completed: 'green',
			Archived: 'gray',
		})[props.project.status] as NonNullable<BadgeProps['theme']>,
)

const plainDescription = computed(() =>
	(props.project.description ?? '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim(),
)
</script>
