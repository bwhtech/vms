<template>
	<MultiSelect
		v-model="selection"
		:options="options"
		:loading="tags.loading"
		placeholder="Tags"
		empty-text="No tags found"
		aria-label="Filter by tag"
		class="w-44"
	/>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MultiSelect, useCall } from 'frappe-ui'

interface ProjectTag {
	tag: string
	count: number
}

const props = defineProps<{ project: string; folder?: string | null; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const selection = ref<string[]>(props.modelValue ? [props.modelValue] : [])
const tags = useCall<{ tags: ProjectTag[] }, { project: string; folder?: string }>({
	url: '/api/v2/method/vms.api.get_project_tags',
	method: 'GET',
	params: () => ({ project: props.project, folder: props.folder || undefined }),
	refetch: true,
	cacheKey: ['project-tags', () => props.project, () => props.folder ?? 'root'],
})

const options = computed(() =>
	(tags.data?.tags ?? []).map(({ tag, count }) => ({ label: `${tag} (${count})`, value: tag })),
)

watch(
	() => props.modelValue,
	(value) => {
		selection.value = value ? [value] : []
	},
)

watch(selection, (values) => {
	const value = values.at(-1) ?? null
	if (values.length > 1) selection.value = value ? [value] : []
	if (value !== props.modelValue) emit('update:modelValue', value)
})
</script>
