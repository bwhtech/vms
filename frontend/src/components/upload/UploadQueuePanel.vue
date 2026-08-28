<template>
	<div
		v-if="items.length > 0 && !uploadOpen"
		class="fixed bottom-20 left-3 right-3 z-40 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 px-3 py-2.5 shadow-lg sm:bottom-4 sm:left-auto sm:w-80"
		role="status"
		aria-live="polite"
		data-testid="upload-queue-panel"
	>
		<div class="flex items-center gap-2">
			<div
				class="grid size-6 shrink-0 place-items-center rounded-full"
				:class="allSettled ? 'bg-surface-green-2' : 'bg-surface-gray-2'"
			>
				<span
					class="size-3.5"
					:class="
						allSettled
							? 'lucide-check text-ink-green-6'
							: 'lucide-loader-circle animate-spin text-ink-gray-6'
					"
					aria-hidden="true"
				/>
			</div>

			<p class="min-w-0 flex-1 truncate text-base-medium text-ink-gray-8">{{ summary }}</p>

			<Button
				variant="ghost"
				icon="lucide-chevron-up"
				aria-label="Show upload details"
				@click="expand"
			/>
			<Button
				v-if="allSettled"
				variant="ghost"
				icon="lucide-x"
				aria-label="Dismiss uploads"
				@click="dismiss"
			/>
		</div>

		<div v-if="!allSettled" class="mt-2">
			<Progress :value="overallProgress" size="md" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { Button, Progress } from 'frappe-ui'

import { useOverlays } from '@/composables/useOverlays'
import { useUploadQueue } from '@/composables/useUploadQueue'

const AUTO_DISMISS_MS = 5000

const { uploadOpen } = useOverlays()
const { items, counts, allSettled, overallProgress, clearDone } = useUploadQueue()

let dismissTimer: ReturnType<typeof setTimeout> | undefined

const summary = computed(() => {
	if (!allSettled.value) return `Uploading ${counts.value.done} of ${counts.value.total}`
	const files = `${counts.value.done} file${counts.value.done === 1 ? '' : 's'} uploaded`
	return counts.value.error ? `${files}, ${counts.value.error} failed` : files
})

watch(
	[allSettled, uploadOpen],
	([settled, open]) => {
		clearDismissTimer()
		if (settled && !open) dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS)
	},
	{ immediate: true },
)

onBeforeUnmount(clearDismissTimer)

function expand(): void {
	uploadOpen.value = true
}

function dismiss(): void {
	clearDismissTimer()
	clearDone()
}

function clearDismissTimer(): void {
	if (dismissTimer) clearTimeout(dismissTimer)
	dismissTimer = undefined
}
</script>
