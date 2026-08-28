<template>
	<!-- Guest page outside the shell: its own full-height root, no sidebar. -->
	<div class="flex h-screen flex-col bg-surface-base">
		<PageHeaderBase class="flex min-h-12 shrink-0 items-center border-b px-3 sm:px-5">
			<PageHeaderTitle>
				<h1 class="truncate">Shared project</h1>
			</PageHeaderTitle>
		</PageHeaderBase>
		<div class="min-h-0 flex-1 px-3 py-5 pb-10 sm:px-5">
			<p class="text-p-base text-ink-gray-6">
				Coming in W8. Project: {{ projectId }}.
				<template v-if="token">Share token present.</template>
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PageHeaderBase, PageHeaderTitle, usePageMeta } from 'frappe-ui'

defineProps<{ projectId: string }>()

const route = useRoute()

/** Share links carry their access token in the query string. */
const token = computed(() => {
	const value = route.query.token
	return typeof value === 'string' && value ? value : null
})

usePageMeta(() => ({ title: 'Shared project · VMS' }))
</script>
