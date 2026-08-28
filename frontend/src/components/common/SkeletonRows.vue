<template>
	<div class="divide-y divide-outline-gray-1" aria-busy="true">
		<div v-for="n in rows" :key="n" class="flex items-center gap-3 py-3">
			<Skeleton v-if="thumbnail" class="h-8 w-12 shrink-0 rounded-4" />
			<div class="flex-1 space-y-2">
				<Skeleton class="h-3 w-1/3 rounded-4" />
				<Skeleton class="h-3 w-1/5 rounded-4" />
			</div>
			<Skeleton class="h-5 w-16 rounded-full" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

withDefaults(defineProps<{ rows?: number; thumbnail?: boolean }>(), { rows: 5, thumbnail: true })
</script>
