<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">Inbox</h1>
		</PageHeaderTitle>
	</PageHeader>
	<div class="px-3 py-5 pb-10 sm:px-5">
		<p class="text-p-base text-ink-gray-6">Coming in W1.</p>
	</div>
</template>

<script setup lang="ts">
import { PageHeader, PageHeaderTitle, usePageMeta } from 'frappe-ui'

usePageMeta(() => ({ title: 'Inbox · VMS' }))
</script>
