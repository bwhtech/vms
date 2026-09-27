<template>
	<span
		class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-gray-3 text-ink-gray-5"
		:class="sizeClass"
		:style="cropStyle"
		aria-hidden="true"
	>
		<span v-if="!cropStyle" class="lucide-user size-1/2" />
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		thumbnail: string | null
		box: [number, number, number, number] | null
		size?: 'sm' | 'md' | 'lg'
	}>(),
	{ size: 'md' },
)

const sizeClass = computed(() => ({ sm: 'size-5', md: 'size-8', lg: 'size-12' })[props.size])

const cropStyle = computed(() => {
	if (!props.thumbnail || !props.box) return undefined
	const [x, y, w, h] = props.box
	return {
		backgroundImage: `url("${props.thumbnail}")`,
		backgroundSize: `${100 / w}% ${100 / h}%`,
		backgroundPosition: `${offset(x, w)}% ${offset(y, h)}%`,
	}
})

function offset(start: number, extent: number) {
	return extent >= 1 ? 0 : (start / (1 - extent)) * 100
}
</script>
