<template>
	<div class="flex flex-wrap items-center gap-2 border-b border-outline-gray-1 px-3 py-3 sm:px-5">
		<TextInput
			v-model="searchModel"
			class="w-full sm:w-64"
			:placeholder="folder ? 'Search this folder' : 'Search this project'"
			aria-label="Search assets"
		>
			<template #prefix>
				<span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" />
			</template>
		</TextInput>
		<AssetTagFilter v-model="tagModel" :project="project" :folder="folder" />
		<Select
			v-model="categoryModel"
			class="w-40"
			:options="categoryOptions"
			aria-label="Filter by category"
		/>
		<AssetSortMenu v-model="sortModel" />
		<div class="ml-auto">
			<TabButtons v-model="viewModel" :options="viewOptions" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Select, TabButtons, TextInput } from 'frappe-ui'
import type { AssetCategory } from '@/types'
import AssetSortMenu from '@/components/assets/AssetSortMenu.vue'
import AssetTagFilter from '@/components/assets/AssetTagFilter.vue'

interface AssetSort {
	field: 'creation' | 'file_size' | 'file_name'
	order: 'asc' | 'desc'
}

const props = defineProps<{
	project: string
	folder?: string | null
	search: string
	tag: string | null
	category: AssetCategory | ''
	sort: AssetSort
	view: 'grid' | 'list'
}>()
const emit = defineEmits<{
	'update:search': [value: string]
	'update:tag': [value: string | null]
	'update:category': [value: AssetCategory | '']
	'update:sort': [value: AssetSort]
	'update:view': [value: 'grid' | 'list']
}>()

const searchModel = model('search')
const tagModel = model('tag')
const categoryModel = model('category')
const sortModel = model('sort')
const viewModel = model('view')

const categoryOptions = [
	{ label: 'All categories', value: '' },
	{ label: 'Footage', value: 'Footage' },
	{ label: 'For Review', value: 'For Review' },
	{ label: 'Deliverable', value: 'Deliverable' },
]
const viewOptions = [
	{ value: 'grid', label: 'Grid', icon: 'lucide-layout-grid', tooltip: 'Grid view' },
	{ value: 'list', label: 'List', icon: 'lucide-list', tooltip: 'List view' },
]

function model<T extends keyof typeof props>(name: T) {
	return computed({
		get: () => props[name],
		set: (value) => emit(`update:${name}` as never, value as never),
	})
}
</script>
