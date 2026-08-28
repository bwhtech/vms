<template>
	<div
		:class="[
			'shrink-0 overflow-hidden rounded-4',
			sizeClass,
			thumbnailUrl ? 'bg-surface-gray-2' : style.tile,
			'grid place-items-center',
		]"
	>
		<img v-if="thumbnailUrl" :src="thumbnailUrl" :alt="alt" class="size-full object-cover" />
		<span v-else :class="[style.icon, iconClass]" aria-hidden="true" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fileKindStyle } from '@/lib/fileType'

const props = withDefaults(
	defineProps<{
		fileType?: string | null
		thumbnailUrl?: string | null
		alt?: string
		size?: 'sm' | 'md'
	}>(),
	{ fileType: null, thumbnailUrl: null, alt: '', size: 'sm' },
)

const style = computed(() => fileKindStyle(props.fileType))
const sizeClass = computed(() => (props.size === 'md' ? 'h-8 w-12' : 'h-6 w-10'))
const iconClass = computed(() => (props.size === 'md' ? 'size-4' : 'size-3.5'))
</script>
