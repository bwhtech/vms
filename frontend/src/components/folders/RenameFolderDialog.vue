<template>
	<Dialog
		:open="open"
		title="Rename folder"
		size="sm"
		:actions="[
			{
				label: 'Rename',
				variant: 'solid',
				loading: rename.loading,
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
			required
			autofocus
			:error="rename.error?.message"
			@keydown.enter.prevent="submit({ close: closeDialog })"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Folder } from '@/types'
import { serverMessage } from '@/lib/format'

const props = defineProps<{ open: boolean; folder: Folder }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()
const name = ref(props.folder.folder_name)

function closeDialog() {
	emit('update:open', false)
}

watch(
	() => props.open,
	(open) => {
		if (open) name.value = props.folder.folder_name
	},
)

const rename = useCall<Folder, { folder_name_id: string; new_name: string }>({
	url: '/api/v2/method/vms.api.rename_folder',
	method: 'POST',
	immediate: false,
})

async function submit({ close }: { close: () => void }) {
	const next = name.value.trim()
	if (!next || next === props.folder.folder_name) return close()
	try {
		await rename.submit({ folder_name_id: props.folder.name, new_name: next })
		toast.success('Folder renamed')
		emit('changed')
		close()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not rename folder')
	}
}
</script>
