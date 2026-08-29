<template>
	<Dialog :open="open" size="4xl" bare @update:open="emit('update:open', $event)">
		<template #default="{ close }">
			<div class="flex items-center gap-2 border-b border-outline-gray-1 px-4 py-2">
				<p class="flex-1 truncate text-base font-medium text-ink-gray-8">{{ name }}</p>
				<Button
					v-if="downloadUrl"
					variant="ghost"
					icon-left="lucide-download"
					label="Download"
					:link="downloadUrl"
				/>
				<Button variant="ghost" icon="lucide-x" label="Close" @click="close" />
			</div>
			<div
				class="relative flex max-h-[80vh] items-center justify-center bg-surface-gray-7 p-2"
			>
				<video
					v-if="isVideo"
					:src="url"
					controls
					autoplay
					class="max-h-[76vh] max-w-full rounded-4"
				/>
				<img
					v-else
					:src="url"
					:alt="name"
					class="max-h-[76vh] max-w-full rounded-4 object-contain"
				/>

				<Button
					v-if="hasPrevious"
					class="absolute left-3 top-1/2 -translate-y-1/2"
					variant="solid"
					theme="gray"
					icon="lucide-chevron-left"
					aria-label="Previous image"
					@click="emit('previous')"
				/>
				<Button
					v-if="hasNext"
					class="absolute right-3 top-1/2 -translate-y-1/2"
					variant="solid"
					theme="gray"
					icon="lucide-chevron-right"
					aria-label="Next image"
					@click="emit('next')"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, watch } from 'vue'
import { Button, Dialog } from 'frappe-ui'

const props = defineProps<{
	open: boolean
	url: string
	name: string
	mime: string
	downloadUrl?: string
	hasPrevious?: boolean
	hasNext?: boolean
}>()

const emit = defineEmits<{
	'update:open': [value: boolean]
	previous: []
	next: []
}>()

const isVideo = computed(() => props.mime.startsWith('video/'))

// A video's own controls own the arrow keys (frame stepping, volume), so the
// gallery only claims them for stills.
const navigable = computed(() => props.open && !isVideo.value)

function handleArrowKeys(event: KeyboardEvent) {
	if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
	const target = event.target as HTMLElement | null
	if (target?.matches('input, textarea, [contenteditable="true"]')) return
	event.preventDefault()
	if (event.key === 'ArrowLeft' && props.hasPrevious) emit('previous')
	if (event.key === 'ArrowRight' && props.hasNext) emit('next')
}

watch(
	navigable,
	(active) => {
		if (active) document.addEventListener('keydown', handleArrowKeys)
		else document.removeEventListener('keydown', handleArrowKeys)
	},
	{ immediate: true },
)
onScopeDispose(() => document.removeEventListener('keydown', handleArrowKeys))
</script>
