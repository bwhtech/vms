<template>
	<Dialog
		:open="open"
		title="Move to project"
		size="sm"
		:actions="[
			{ label: 'Move', variant: 'solid', disabled: !target, onClick: submit },
			{ label: 'Cancel' },
		]"
		@update:open="emit('update:open', $event)"
	>
		<FormControl
			v-model="target"
			type="select"
			label="Project"
			placeholder="Choose a project"
			:options="projectOptions"
			:error="move.error?.message"
		/>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall, useList } from 'frappe-ui'
import type { Asset, Project } from '@/types'

const props = defineProps<{ open: boolean; asset: Asset }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const target = ref('')

watch(
	() => props.open,
	(open) => {
		if (open) target.value = ''
	},
)

const projects = useList<Pick<Project, 'name' | 'project_name'>>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name'],
	orderBy: 'modified desc',
	limit: 200,
	cacheKey: 'move-asset-projects',
})

const projectOptions = computed(() =>
	(projects.data ?? [])
		.filter((p) => p.name !== props.asset.project)
		.map((p) => ({ label: p.project_name, value: p.name })),
)

const move = useCall<unknown, { asset_name: string; target_project: string }>({
	url: '/api/v2/method/vms.api.move_asset',
	method: 'POST',
	immediate: false,
})

async function submit({ close }: { close: () => void }) {
	if (!target.value) return
	await move.submit({ asset_name: props.asset.name, target_project: target.value })
	toast.success('Asset moved')
	emit('changed')
	close()
}
</script>
