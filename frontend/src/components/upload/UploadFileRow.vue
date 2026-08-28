<template>
	<div
		class="space-y-2 rounded border border-outline-gray-2 p-3"
		:class="{ 'opacity-60': item.status === 'cancelled' }"
		data-testid="upload-file-row"
	>
		<div class="flex items-start gap-3">
			<div
				class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full"
				:class="statusSurface"
			>
				<span class="size-3.5" :class="statusIcon" aria-hidden="true" />
			</div>

			<div class="min-w-0 flex-1">
				<p class="truncate text-base text-ink-gray-8">{{ item.file.name }}</p>
				<p class="mt-1 text-sm text-ink-gray-5">
					{{ formatBytes(item.file.size) }} · {{ statusLabel }}
				</p>
			</div>

			<div class="flex shrink-0 gap-1">
				<Button
					v-if="item.status === 'error'"
					variant="ghost"
					icon="lucide-refresh-cw"
					aria-label="Retry upload"
					@click="emit('retry', item.id)"
				/>
				<Button
					v-if="canCancel"
					variant="ghost"
					icon="lucide-x"
					aria-label="Cancel upload"
					@click="emit('cancel', item.id)"
				/>
			</div>
		</div>

		<Progress
			v-if="item.status === 'uploading' || item.status === 'confirming'"
			:value="item.progress"
			size="md"
			hint
		/>
		<p v-if="item.error" class="text-p-xs text-ink-red-6">{{ item.error }}</p>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Progress } from 'frappe-ui'

import type { UploadItem } from '@/types'
import { formatBytes } from '@/lib/format'

const props = defineProps<{ item: UploadItem }>()
const emit = defineEmits<{ cancel: [id: string]; retry: [id: string] }>()

const canCancel = computed(
	() => props.item.status === 'queued' || props.item.status === 'uploading',
)

const statusLabel = computed(() => {
	const labels = {
		queued: 'Waiting',
		uploading: 'Uploading',
		confirming: 'Finishing',
		done: 'Uploaded',
		error: 'Failed',
		cancelled: 'Cancelled',
	}
	return labels[props.item.status]
})

const statusIcon = computed(() => {
	const icons = {
		queued: 'lucide-clock-3 text-ink-gray-5',
		uploading: 'lucide-loader-circle animate-spin text-ink-blue-6',
		confirming: 'lucide-loader-circle animate-spin text-ink-blue-6',
		done: 'lucide-check text-ink-green-6',
		error: 'lucide-x text-ink-red-6',
		cancelled: 'lucide-minus text-ink-gray-5',
	}
	return icons[props.item.status]
})

const statusSurface = computed(() => {
	const surfaces = {
		queued: 'bg-surface-gray-2',
		uploading: 'bg-surface-blue-2',
		confirming: 'bg-surface-blue-2',
		done: 'bg-surface-green-2',
		error: 'bg-surface-red-2',
		cancelled: 'bg-surface-gray-2',
	}
	return surfaces[props.item.status]
})
</script>
