<template>
	<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
		<AssetCard
			v-for="asset in assets"
			:key="asset.name"
			:asset="asset"
			:selected="selection.includes(asset.name)"
			:draggable="draggable"
			:drag-selection="selection"
			:folder-path="asset.folder ? folderPaths?.get(asset.folder) : undefined"
			@toggle="toggle"
			@open="emit('open', $event)"
			@changed="emit('changed')"
			@open-folder="emit('open-folder', $event)"
		/>
	</div>
</template>

<script setup lang="ts">
import type { Asset } from '@/types'
import AssetCard from '@/components/assets/AssetCard.vue'

const props = defineProps<{
	assets: Asset[]
	selection: string[]
	draggable?: boolean
	folderPaths?: Map<string, string>
}>()
const emit = defineEmits<{
	'update:selection': [value: string[]]
	open: [asset: Asset]
	changed: []
	'open-folder': [name: string]
}>()

function toggle(name: string) {
	const next = props.selection.includes(name)
		? props.selection.filter((item) => item !== name)
		: [...props.selection, name]
	emit('update:selection', next)
}
</script>
