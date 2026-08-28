<template>
	<Dialog
		:open="open"
		title="Move assets"
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
		<FormControl
			v-model="target"
			type="select"
			label="Destination"
			:description="`${assetNames.length} asset${assetNames.length === 1 ? '' : 's'} selected.`"
			:options="options"
			placeholder="Choose a folder"
			:error="move.error?.message"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Folder } from '@/types'
import { buildFolderOptions } from '@/lib/folderPaths'
import { serverMessage } from '@/lib/format'

const ROOT = '__root__'
const props = defineProps<{
	open: boolean
	assetNames: string[]
	folders: Folder[]
	currentFolder?: string | null
}>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()
const target = ref('')

watch(
	() => props.open,
	(open) => {
		if (open) target.value = ''
	},
)

const options = computed(() => [
	...(props.currentFolder ? [{ label: 'Project root', value: ROOT }] : []),
	...buildFolderOptions(props.folders)
		.filter((folder) => folder.name !== props.currentFolder)
		.map((folder) => ({ label: folder.path, value: folder.name })),
])

const move = useCall<unknown, { asset_names: string; folder: string | null }>({
	url: '/api/v2/method/vms.api.move_assets_to_folder',
	method: 'POST',
	immediate: false,
})

async function submit({ close }: { close: () => void }) {
	if (!target.value) return
	try {
		await move.submit({
			asset_names: JSON.stringify(props.assetNames),
			folder: target.value === ROOT ? null : target.value,
		})
		toast.success(
			`Moved ${props.assetNames.length} asset${props.assetNames.length === 1 ? '' : 's'}`,
		)
		emit('changed')
		close()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not move assets')
	}
}
</script>
