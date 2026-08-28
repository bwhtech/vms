<template>
	<div class="min-h-screen bg-surface-base">
		<PageHeaderBase class="flex min-h-12 items-center border-b px-3 sm:px-5">
			<PageHeaderTitle>
				<h1 class="truncate">Set up VMS</h1>
			</PageHeaderTitle>
		</PageHeaderBase>
		<div class="mx-auto max-w-2xl px-3 py-5 pb-10 sm:px-5">
			<p class="text-p-base text-ink-gray-6">Coming in W7.</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { PageHeaderBase, PageHeaderTitle, usePageMeta } from 'frappe-ui'

usePageMeta(() => ({ title: 'Setup · VMS' }))
</script>
