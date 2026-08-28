<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-200"
			leave-active-class="transition-opacity duration-150"
			enter-from-class="opacity-0"
			leave-to-class="opacity-0"
		>
			<div
				v-if="open"
				class="fixed inset-0 z-50 bg-black-overlay-200 dark:bg-black-overlay-700"
				data-slot="side-panel-backdrop"
				@click="close"
			/>
		</Transition>
		<Transition
			enter-active-class="transition-transform duration-200 ease-out"
			leave-active-class="transition-transform duration-150 ease-in"
			enter-from-class="translate-x-full"
			leave-to-class="translate-x-full"
		>
			<aside
				v-if="open"
				ref="panel"
				class="fixed inset-y-0 right-0 z-50 flex max-w-full flex-col border-l border-outline-gray-1 bg-surface-base shadow-xl focus:outline-none"
				:style="{ width }"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				tabindex="-1"
				data-slot="side-panel"
				@keydown.esc.stop="close"
			>
				<header
					class="flex h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-4"
				>
					<h2 class="flex-1 truncate text-base font-semibold text-ink-gray-9">
						{{ title }}
					</h2>
					<slot name="actions" />
					<Button variant="ghost" icon="lucide-x" label="Close" @click="close" />
				</header>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<slot />
				</div>
			</aside>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Button } from 'frappe-ui'

/**
 * Right-docked panel for Versions / Transcription / Notifications. frappe-ui's
 * `Dialog` only knows `position: 'center' | 'top'`, so this is app markup.
 */
const props = withDefaults(defineProps<{ open: boolean; title: string; width?: string }>(), {
	width: '24rem',
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const panel = ref<HTMLElement | null>(null)

function close() {
	emit('update:open', false)
}

watch(
	() => props.open,
	async (open) => {
		if (!open) return
		await nextTick()
		panel.value?.focus()
	},
)
</script>
