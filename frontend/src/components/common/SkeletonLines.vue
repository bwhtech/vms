<template>
	<div class="space-y-2" aria-busy="true">
		<Skeleton
			v-for="n in lines"
			:key="n"
			:class="['h-3 rounded', n === lines && lines > 1 ? 'w-2/3' : 'w-full']"
		/>
	</div>
</template>

<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

withDefaults(defineProps<{ lines?: number }>(), { lines: 3 })
</script>
