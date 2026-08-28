<template>
	<Dropdown :options="options" align="end">
		<Button :label="activeLabel" icon-left="lucide-arrow-up-down" variant="subtle" />
	</Dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Dropdown } from 'frappe-ui'

type AssetSortField = 'creation' | 'file_size' | 'file_name'
type AssetSortOrder = 'asc' | 'desc'
interface AssetSort {
	field: AssetSortField
	order: AssetSortOrder
}

const props = defineProps<{ modelValue: AssetSort }>()
const emit = defineEmits<{ 'update:modelValue': [value: AssetSort] }>()

const choices: { label: string; value: AssetSort }[] = [
	{ label: 'Newest first', value: { field: 'creation', order: 'desc' } },
	{ label: 'Oldest first', value: { field: 'creation', order: 'asc' } },
	{ label: 'Name (A–Z)', value: { field: 'file_name', order: 'asc' } },
	{ label: 'Name (Z–A)', value: { field: 'file_name', order: 'desc' } },
	{ label: 'Largest first', value: { field: 'file_size', order: 'desc' } },
	{ label: 'Smallest first', value: { field: 'file_size', order: 'asc' } },
]

const activeLabel = computed(
	() =>
		choices.find(
			({ value }) =>
				value.field === props.modelValue.field && value.order === props.modelValue.order,
		)?.label ?? 'Sort',
)

const options = computed(() =>
	choices.map(({ label, value }) => ({
		label,
		icon:
			value.field === props.modelValue.field && value.order === props.modelValue.order
				? 'lucide-check'
				: undefined,
		onClick: () => emit('update:modelValue', value),
	})),
)
</script>
