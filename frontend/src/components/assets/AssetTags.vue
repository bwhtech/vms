<template>
	<Dialog
		:open="open"
		title="Tags"
		size="sm"
		:actions="[{ label: 'Done', variant: 'solid' }]"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-3">
			<div class="flex flex-wrap gap-1.5">
				<Badge
					v-for="tag in tags"
					:key="tag"
					variant="subtle"
					theme="gray"
					size="md"
					class="gap-1"
				>
					{{ tag }}
					<button
						type="button"
						class="ml-0.5 rounded text-ink-gray-5 hover:text-ink-gray-8"
						:aria-label="`Remove tag ${tag}`"
						@click="remove(tag)"
					>
						<span class="lucide-x size-3" aria-hidden="true" />
					</button>
				</Badge>
				<p v-if="!tags.length" class="text-sm text-ink-gray-5">No tags yet.</p>
			</div>
			<div class="flex items-end gap-2">
				<FormControl
					v-model="draft"
					label="Add tag"
					placeholder="e.g. b-roll"
					class="flex-1"
					:error="addCall.error?.message"
					@keydown.enter.prevent="add"
				/>
				<Button
					label="Add"
					:loading="addCall.loading"
					:disabled="!draft.trim()"
					@click="add"
				/>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Badge, Button, Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { Asset } from '@/types'
import { serverMessage } from '@/lib/format'

const props = defineProps<{ open: boolean; asset: Asset }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const tags = ref<string[]>([...(props.asset.tags ?? [])])
const draft = ref('')

watch(
	() => props.open,
	(open) => {
		if (open) {
			tags.value = [...(props.asset.tags ?? [])]
			draft.value = ''
		}
	},
)

interface TagParams {
	asset_name: string
	tag: string
}

const addCall = useCall<string[], TagParams>({
	url: '/api/v2/method/vms.api.add_asset_tag',
	method: 'POST',
	immediate: false,
})
const removeCall = useCall<string[], TagParams>({
	url: '/api/v2/method/vms.api.remove_asset_tag',
	method: 'POST',
	immediate: false,
})

async function add() {
	const tag = draft.value.trim()
	if (!tag) return
	try {
		const updated = await addCall.submit({ asset_name: props.asset.name, tag })
		tags.value = updated ?? [...tags.value, tag]
		draft.value = ''
		emit('changed')
	} catch (e) {
		toast.error(serverMessage(e))
	}
}

async function remove(tag: string) {
	try {
		const updated = await removeCall.submit({ asset_name: props.asset.name, tag })
		tags.value = updated ?? tags.value.filter((t) => t !== tag)
		emit('changed')
	} catch (e) {
		toast.error(serverMessage(e))
	}
}
</script>
