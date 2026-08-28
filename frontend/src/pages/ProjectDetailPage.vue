<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">{{ projectId }}</h1>
		</PageHeaderTitle>
	</PageHeader>
	<div class="px-3 py-5 pb-10 sm:px-5">
		<p class="text-p-base text-ink-gray-6">
			Coming in W2.
			<template v-if="folderId">Folder: {{ folderId }}.</template>
		</p>
	</div>
</template>

<script setup lang="ts">
import { PageHeader, PageHeaderTitle, usePageMeta } from 'frappe-ui'

const props = defineProps<{
	projectId: string
	folderId?: string
}>()

usePageMeta(() => ({ title: `${props.projectId} · VMS` }))
</script>
