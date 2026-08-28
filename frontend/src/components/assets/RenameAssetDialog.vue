<template>
	<Dialog
		:open="open"
		title="Rename asset"
		size="sm"
		:actions="[{ label: 'Rename', variant: 'solid', onClick: submit }, { label: 'Cancel' }]"
		@update:open="emit('update:open', $event)"
	>
		<FormControl
			v-model="stem"
			label="File name"
			required
			autofocus
			:error="rename.error?.message"
			@keydown.enter="submit({ close: closeDialog })"
		>
			<template v-if="extension" #suffix>
				<span class="text-sm text-ink-gray-5">{{ extension }}</span>
			</template>
		</FormControl>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Asset } from '@/types'

const props = defineProps<{ open: boolean; asset: Asset }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const stem = ref(fileParts(props.asset.file_name).stem)
const extension = ref(fileParts(props.asset.file_name).extension)

watch(
	() => props.open,
	(open) => {
		if (!open) return
		const parts = fileParts(props.asset.file_name)
		stem.value = parts.stem
		extension.value = parts.extension
	},
)

const rename = useCall<Asset, { asset_name: string; new_file_name: string }>({
	url: '/api/v2/method/vms.api.rename_asset',
	method: 'POST',
	immediate: false,
})

function closeDialog() {
	emit('update:open', false)
}

async function submit({ close }: { close: () => void }) {
	const name = `${stem.value.trim()}${extension.value}`
	if (!name || name === props.asset.file_name) return close()
	await rename.submit({ asset_name: props.asset.name, new_file_name: name })
	toast.success('Asset renamed')
	emit('changed')
	close()
}

function fileParts(fileName: string) {
	const dot = fileName.lastIndexOf('.')
	return dot > 0
		? { stem: fileName.slice(0, dot), extension: fileName.slice(dot) }
		: { stem: fileName, extension: '' }
}
</script>
