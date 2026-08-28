<template>
	<Dialog
		:open="open"
		title="Rename asset"
		size="sm"
		:actions="[{ label: 'Rename', variant: 'solid', onClick: submit }, { label: 'Cancel' }]"
		@update:open="emit('update:open', $event)"
	>
		<FormControl
			v-model="fileName"
			label="File name"
			required
			autofocus
			:error="rename.error?.message"
			@keydown.enter="submit({ close })"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Asset } from '@/types'

const props = defineProps<{ open: boolean; asset: Asset }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const fileName = ref(props.asset.file_name)

watch(
	() => props.open,
	(open) => {
		if (open) fileName.value = props.asset.file_name
	},
)

const rename = useCall<Asset, { asset_name: string; new_file_name: string }>({
	url: '/api/v2/method/vms.api.rename_asset',
	method: 'POST',
	immediate: false,
})

function close() {
	emit('update:open', false)
}

async function submit({ close }: { close: () => void }) {
	const name = fileName.value.trim()
	if (!name || name === props.asset.file_name) return close()
	await rename.submit({ asset_name: props.asset.name, new_file_name: name })
	toast.success('Asset renamed')
	emit('changed')
	close()
}
</script>
