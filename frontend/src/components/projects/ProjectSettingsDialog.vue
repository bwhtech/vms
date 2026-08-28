<template>
	<Dialog
		:open="open"
		title="Project settings"
		size="md"
		:actions="[
			{ label: 'Save changes', variant: 'solid', disabled: !name.trim(), onClick: save },
			{ label: 'Cancel' },
		]"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<FormControl v-model="name" label="Project name" required />
			<FormControl v-model="description" type="textarea" label="Description" />
			<FormControl v-model="status" type="select" label="Status" :options="statusOptions" />
			<FormControl v-model="dueDate" type="date" label="Due date" />
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl } from 'frappe-ui'
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@/types'

const props = defineProps<{ open: boolean; project: Project }>()
const emit = defineEmits<{
	'update:open': [value: boolean]
	save: [values: Partial<Project>, close: () => void]
}>()

const name = ref('')
const description = ref('')
const status = ref<ProjectStatus>('Open')
const dueDate = ref('')
const statusOptions = PROJECT_STATUSES.map((value) => ({ label: value, value }))

watch(
	() => props.open,
	(open) => {
		if (!open) return
		name.value = props.project.project_name
		description.value = props.project.description ?? ''
		status.value = props.project.status
		dueDate.value = props.project.due_date ?? ''
	},
	{ immediate: true },
)

function save({ close }: { close: () => void }) {
	if (!name.value.trim()) return
	emit(
		'save',
		{
			project_name: name.value.trim(),
			description: description.value.trim(),
			status: status.value,
			due_date: dueDate.value || undefined,
		},
		close,
	)
}
</script>
