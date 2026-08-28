<template>
	<Dialog
		:open="open"
		title="New folder"
		size="sm"
		:actions="[
			{
				label: 'Create',
				variant: 'solid',
				loading: create.loading,
				disabled: !name.trim(),
				onClick: submit,
			},
			{ label: 'Cancel' },
		]"
		@update:open="emit('update:open', $event)"
	>
		<FormControl
			v-model="name"
			label="Folder name"
			:description="
				parentName ? `Created inside ${parentName}.` : 'Created at the project root.'
			"
			required
			autofocus
			:error="create.error?.message"
			@keydown.enter.prevent="submit({ close: closeDialog })"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Folder } from '@/types'
import { serverMessage } from '@/lib/format'

const props = defineProps<{
	open: boolean
	project: string
	parentFolder?: string | null
	parentName?: string
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; created: [folder: Folder] }>()
const name = ref('')

function closeDialog() {
	emit('update:open', false)
}

watch(
	() => props.open,
	(open) => {
		if (open) name.value = ''
	},
)

const create = useCall<Folder, { folder_name: string; project: string; parent_folder?: string }>({
	url: '/api/v2/method/vms.api.create_folder',
	method: 'POST',
	immediate: false,
})

async function submit({ close }: { close: () => void }) {
	const folderName = name.value.trim()
	if (!folderName) return
	try {
		const folder = await create.submit({
			folder_name: folderName,
			project: props.project,
			parent_folder: props.parentFolder || undefined,
		})
		if (folder) emit('created', folder)
		toast.success(`Folder “${folderName}” created`)
		close()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not create folder')
	}
}
</script>
