<template>
	<Dropdown :options="options" align="end">
		<Button variant="ghost" :aria-label="`Change category from ${current}`" @click.stop>
			<Badge :label="current" :theme="categoryTheme(current)" variant="subtle" />
		</Button>
	</Dropdown>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Badge, Button, Dropdown, toast, useCall } from 'frappe-ui'
import { ASSET_CATEGORIES, type AssetCategory } from '@/types'
import { categoryTheme } from '@/lib/status'
import { serverMessage } from '@/lib/format'

const props = defineProps<{ assetName: string; category: AssetCategory }>()
const emit = defineEmits<{ changed: [category: AssetCategory] }>()
const current = ref(props.category)

watch(
	() => props.category,
	(value) => (current.value = value),
)

const update = useCall<unknown, { asset_name: string; category: AssetCategory }>({
	url: '/api/v2/method/vms.api.update_asset_category',
	method: 'POST',
	immediate: false,
})

const options = computed(() =>
	ASSET_CATEGORIES.map((category) => ({
		label: category,
		icon: category === current.value ? 'lucide-check' : undefined,
		onClick: () => change(category),
	})),
)

async function change(category: AssetCategory) {
	if (category === current.value) return
	const previous = current.value
	current.value = category
	try {
		await update.submit({ asset_name: props.assetName, category })
		emit('changed', category)
	} catch (error) {
		current.value = previous
		toast.error(serverMessage(error) || 'Could not update category')
	}
}
</script>
