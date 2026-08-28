<template>
	<Dialog
		v-model:open="createProjectOpen"
		title="New project"
		size="md"
		:actions="[
			{
				label: 'Create project',
				variant: 'solid',
				loading: createProject.loading,
				disabled: !projectName.trim(),
				onClick: submit,
			},
			{ label: 'Cancel' },
		]"
	>
		<div class="space-y-4">
			<!-- The project's mark first, the way it will read everywhere else. -->
			<div class="flex items-end gap-2">
				<IdentityPicker v-model:icon="icon" v-model:color="color" v-model:avatar="avatar" />
				<FormControl
					v-model="projectName"
					class="min-w-0 flex-1"
					label="Project name"
					placeholder="My video project"
					required
					autofocus
					:error="createProject.error?.message"
					@keydown.enter.prevent="submit({ close: closeDialog })"
				/>
			</div>
			<FormControl
				v-model="description"
				type="textarea"
				label="Description"
				placeholder="What is this project for?"
			/>
			<FormControl v-model="dueDate" type="date" label="Due date" />
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog, FormControl, toast, useNewDoc } from 'frappe-ui'
import type { Project } from '@/types'
import type { ProjectAvatarValue } from '@/lib/dicebear'
import { identityPatch, type ProjectColor } from '@/lib/project'
import IdentityPicker from '@/components/common/IdentityPicker.vue'
import { serverMessage } from '@/lib/format'
import { useOverlays } from '@/composables/useOverlays'
import { useSession } from '@/composables/useSession'

const emit = defineEmits<{ created: [project: Project] }>()

const router = useRouter()
const { createProjectOpen } = useOverlays()
const { userId } = useSession()
const projectName = ref('')
const description = ref('')
const dueDate = ref('')
const icon = ref('')
const color = ref<ProjectColor | ''>('')
const avatar = ref<ProjectAvatarValue | null>(null)

const createProject = useNewDoc<Project>('VMS Project')

function closeDialog() {
	createProjectOpen.value = false
}

watch(createProjectOpen, (open) => {
	if (open) return
	projectName.value = ''
	description.value = ''
	dueDate.value = ''
	icon.value = ''
	color.value = ''
	avatar.value = null
	createProject.reset()
})

async function submit({ close }: { close: () => void }) {
	const name = projectName.value.trim()
	if (!name) return
	Object.assign(createProject.doc, {
		project_name: name,
		description: description.value.trim() || undefined,
		due_date: dueDate.value || undefined,
		owner_user: userId.value || 'Administrator',
		status: 'Open',
		...identityPatch(icon.value, color.value, avatar.value),
	})
	try {
		const project = await createProject.submit()
		toast.success('Project created')
		emit('created', project)
		close()
		await router.push(`/projects/${project.name}`)
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not create project')
	}
}
</script>
