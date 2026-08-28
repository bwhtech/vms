<template>
	<div
		v-if="assets.length"
		class="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-6 border border-outline-gray-1 bg-surface-elevation-1 p-2 shadow-lg"
		role="toolbar"
		aria-label="Bulk asset actions"
	>
		<span class="whitespace-nowrap px-2 text-sm-medium text-ink-gray-8">
			{{ assets.length }} selected
		</span>
		<Divider orientation="vertical" class="mx-1 h-6" />
		<Button
			label="Move"
			icon-left="lucide-folder-input"
			variant="ghost"
			@click="emit('move')"
		/>
		<Button label="Tag" icon-left="lucide-tag" variant="ghost" @click="tagOpen = true" />
		<Button
			label="Download"
			icon-left="lucide-download"
			variant="ghost"
			:loading="isDownloading"
			@click="downloadMany(assets)"
		/>
		<Button
			label="Delete"
			icon-left="lucide-trash-2"
			variant="ghost"
			theme="red"
			@click="remove"
		/>
		<Button
			icon="lucide-x"
			aria-label="Clear selection"
			variant="ghost"
			@click="emit('clear')"
		/>
	</div>

	<Dialog
		v-model:open="tagOpen"
		title="Tag selected assets"
		size="sm"
		:actions="[
			{
				label: 'Add tag',
				variant: 'solid',
				loading: addingTag,
				disabled: !tag.trim(),
				onClick: addTag,
			},
			{ label: 'Cancel' },
		]"
	>
		<FormControl
			v-model="tag"
			label="Tag"
			description="The tag is added to every selected asset."
			placeholder="e.g. Must use"
			required
			autofocus
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, Dialog, Divider, FormControl, dialog, toast, useCall } from 'frappe-ui'
import type { Asset } from '@/types'
import { serverMessage } from '@/lib/format'
import { useDownload } from '@/composables/useDownload'

const props = defineProps<{ assets: Asset[] }>()
const emit = defineEmits<{ move: []; clear: []; changed: [] }>()
const { downloadMany, isDownloading } = useDownload()
const tagOpen = ref(false)
const tag = ref('')
const addingTag = ref(false)

const addTagCall = useCall<unknown, { asset_name: string; tag: string }>({
	url: '/api/v2/method/vms.api.add_asset_tag',
	method: 'POST',
	immediate: false,
})
const deleteCall = useCall<unknown, { asset_name: string }>({
	url: '/api/v2/method/vms.api.delete_asset',
	method: 'POST',
	immediate: false,
})
const restoreCall = useCall<unknown, { asset_name: string }>({
	url: '/api/v2/method/vms.api.restore_asset',
	method: 'POST',
	immediate: false,
})

async function addTag({ close }: { close: () => void }) {
	const value = tag.value.trim()
	if (!value) return
	addingTag.value = true
	try {
		for (const asset of props.assets) {
			await addTagCall.submit({ asset_name: asset.name, tag: value })
		}
		toast.success(`Tagged ${props.assets.length} asset${props.assets.length === 1 ? '' : 's'}`)
		tag.value = ''
		close()
		emit('changed')
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not add tag')
	} finally {
		addingTag.value = false
	}
}

function remove() {
	const assets = [...props.assets]
	dialog.danger({
		title: `Move ${assets.length} asset${assets.length === 1 ? '' : 's'} to Trash?`,
		message: 'You can restore them from Trash.',
		confirmLabel: 'Move to Trash',
		onConfirm: async () => {
			try {
				for (const asset of assets) await deleteCall.submit({ asset_name: asset.name })
				emit('clear')
				emit('changed')
				toast.success(
					`Moved ${assets.length} asset${assets.length === 1 ? '' : 's'} to Trash`,
					{
						action: {
							label: 'Undo',
							onClick: async () => {
								for (const asset of assets)
									await restoreCall.submit({ asset_name: asset.name })
								emit('changed')
								toast.success('Assets restored')
							},
						},
					},
				)
			} catch (error) {
				toast.error(serverMessage(error) || 'Could not delete assets')
			}
		},
	})
}
</script>
