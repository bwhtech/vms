<template>
	<div class="space-y-3">
		<div v-if="extensions.length" class="flex flex-wrap gap-1.5" data-testid="extension-chips">
			<span
				v-for="ext in extensions"
				:key="ext"
				class="inline-flex h-6 items-center gap-1 rounded-full bg-surface-gray-2 pl-2.5 pr-1 text-sm text-ink-gray-8"
			>
				{{ ext }}
				<button
					type="button"
					class="grid size-4 place-content-center rounded-full text-ink-gray-5 hover:bg-surface-gray-4 hover:text-ink-gray-8"
					:aria-label="`Remove ${ext}`"
					@click="remove(ext)"
				>
					<span class="lucide-x size-3" aria-hidden="true" />
				</button>
			</span>
		</div>
		<p v-else class="text-base text-ink-gray-5">
			No formats allowed yet — every upload will be rejected.
		</p>
		<div class="flex items-center gap-2">
			<TextInput
				v-model="draft"
				class="flex-1"
				placeholder="Add format (e.g. mp4)"
				aria-label="Add file format"
				@keydown.enter.prevent="add"
				@keydown.,.prevent="add"
			/>
			<Button label="Add" :disabled="!draft.trim()" @click="add" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button, TextInput } from 'frappe-ui'

/** Allowed upload extensions, lower-case, without dots. */
const extensions = defineModel<string[]>({ required: true })

const draft = ref('')

function add() {
	const ext = draft.value.trim().toLowerCase().replace(/^\./, '')
	draft.value = ''
	if (!ext || extensions.value.includes(ext)) return
	extensions.value = [...extensions.value, ext]
}

function remove(ext: string) {
	extensions.value = extensions.value.filter((e) => e !== ext)
}
</script>
