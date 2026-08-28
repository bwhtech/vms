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
			<div class="flex max-h-[80vh] items-center justify-center bg-surface-gray-7 p-2">
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
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Dialog } from 'frappe-ui'

const props = defineProps<{
	open: boolean
	url: string
	name: string
	mime: string
	downloadUrl?: string
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const isVideo = computed(() => props.mime.startsWith('video/'))
</script>
