<template>
	<Dropdown :options="options" align="end">
		<Button variant="ghost" icon="lucide-ellipsis-vertical" label="Asset actions" @click.stop />
	</Dropdown>
	<RenameAssetDialog v-model:open="renameOpen" :asset="asset" @changed="emit('changed')" />
	<MoveAssetDialog v-model:open="moveOpen" :asset="asset" @changed="emit('changed')" />
	<AssetTags v-model:open="tagsOpen" :asset="asset" @changed="emit('changed')" />
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { Button, Dropdown } from 'frappe-ui'
import type { Asset } from '@/types'
import AssetTags from '@/components/assets/AssetTags.vue'
import MoveAssetDialog from '@/components/assets/MoveAssetDialog.vue'
import RenameAssetDialog from '@/components/assets/RenameAssetDialog.vue'
import { useAssetActions } from '@/components/assets/useAssetActions'

const props = defineProps<{ asset: Asset }>()
const emit = defineEmits<{ changed: [] }>()

const renameOpen = ref(false)
const moveOpen = ref(false)
const tagsOpen = ref(false)

const options = useAssetActions(toRef(props, 'asset'), {
	onChanged: () => emit('changed'),
	openRename: () => (renameOpen.value = true),
	openMove: () => (moveOpen.value = true),
	openTags: () => (tagsOpen.value = true),
})
</script>
