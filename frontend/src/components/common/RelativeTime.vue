<template>
	<Tooltip :text="absolute">
		<time :datetime="date" class="text-ink-gray-5">{{ relative }}</time>
	</Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip } from 'frappe-ui'
import { formatDateTime, fromNow } from '@/lib/dates'

const props = defineProps<{ date: string }>()

const relative = computed(() => fromNow(props.date))
const absolute = computed(() => formatDateTime(props.date))
</script>
