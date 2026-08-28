<template>
	<div class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
		<slot name="icon">
			<span v-if="icon" :class="[icon, 'size-6 text-ink-gray-4']" aria-hidden="true" />
		</slot>
		<p class="text-base font-medium text-ink-gray-7">{{ title }}</p>
		<p v-if="description" class="max-w-sm text-sm text-ink-gray-5">{{ description }}</p>
		<div v-if="$slots.actions" class="mt-2 flex items-center gap-2">
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	title: string
	description?: string
	/** A `lucide-*` class name; the `#icon` slot overrides it. */
	icon?: string
}>()

defineSlots<{
	icon?: () => unknown
	actions?: () => unknown
}>()
</script>
