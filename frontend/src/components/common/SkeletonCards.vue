<template>
	<div :class="gridClass" aria-busy="true">
		<div
			v-for="n in count"
			:key="n"
			class="space-y-3 rounded-md border border-outline-gray-1 bg-surface-base p-4"
		>
			<Skeleton v-if="media" class="aspect-video w-full rounded" />
			<Skeleton v-else class="size-8 rounded" />
			<Skeleton class="h-3 w-2/3 rounded" />
			<Skeleton class="h-3 w-1/3 rounded" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

withDefaults(defineProps<{ count?: number; media?: boolean; gridClass?: string }>(), {
	count: 6,
	media: false,
	gridClass: 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3',
})
</script>
