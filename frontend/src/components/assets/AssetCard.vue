<template>
	<article
		class="group relative overflow-hidden rounded-5 border border-outline-gray-1 bg-surface-base transition hover:border-outline-gray-2 hover:shadow-sm"
		:class="accentClass"
		:draggable="draggable"
		@click="emit('open', asset)"
		@dragstart="startDrag"
	>
		<div class="relative aspect-video bg-surface-gray-2">
			<img
				v-if="asset.thumbnail_url"
				:src="asset.thumbnail_url"
				alt=""
				draggable="false"
				loading="lazy"
				decoding="async"
				class="size-full object-cover"
			/>
			<div v-else :class="['grid size-full place-items-center', previewStyle.tile]">
				<span :class="[previewStyle.icon, 'size-8']" aria-hidden="true" />
			</div>
			<div
				class="absolute left-2 top-2 transition-opacity"
				:class="
					selected
						? 'opacity-100'
						: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
				"
				@click.stop
			>
				<Checkbox
					:model-value="selected"
					:aria-label="`Select ${asset.file_name}`"
					@update:model-value="emit('toggle', asset.name)"
				/>
			</div>
			<span
				v-if="asset.duration_seconds"
				class="absolute bottom-2 right-2 rounded-1 bg-surface-gray-9 px-1.5 py-0.5 text-2xs text-ink-base tabular-nums"
			>
				{{ formatDuration(asset.duration_seconds) }}
			</span>
		</div>

		<div class="space-y-2 p-3">
			<div class="flex min-w-0 items-start gap-2">
				<div class="min-w-0 flex-1">
					<p class="truncate text-base text-ink-gray-8" :title="asset.file_name">
						{{ asset.file_name }}
					</p>
					<p class="mt-1 truncate text-sm text-ink-gray-5">
						{{ asset.file_size ? formatBytes(asset.file_size) : 'Size unavailable' }}
						<template v-if="asset.uploaded_at">
							· {{ fromNow(asset.uploaded_at) }}
						</template>
					</p>
				</div>
				<div
					class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
					@click.stop
				>
					<AssetActions :asset="asset" @changed="emit('changed')" />
				</div>
			</div>
			<Button
				v-if="folderPath"
				class="max-w-full justify-start text-ink-gray-5"
				:title="folderPath"
				variant="ghost"
				icon-left="lucide-folder"
				:label="folderPath"
				@click.stop="emit('open-folder', asset.folder!)"
			/>
			<div v-if="asset.status !== 'Ready'" class="space-y-1">
				<div class="flex items-center gap-1.5 text-sm text-ink-gray-5">
					<span
						:class="statusDotClass"
						class="size-1.5 rounded-full"
						aria-hidden="true"
					/>
					<span>{{
						asset.status === 'Processing' ? 'Converting to MP4' : asset.status
					}}</span>
				</div>
				<Progress v-if="asset.status === 'Processing'" :value="55" />
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Checkbox, Progress } from 'frappe-ui'
import type { Asset } from '@/types'
import { formatBytes, formatDuration } from '@/lib/format'
import { fromNow } from '@/lib/dates'
import { fileKindStyle } from '@/lib/fileType'
import AssetActions from '@/components/assets/AssetActions.vue'

const props = defineProps<{
	asset: Asset
	selected: boolean
	draggable?: boolean
	folderPath?: string
	dragSelection?: string[]
}>()
const emit = defineEmits<{
	toggle: [name: string]
	open: [asset: Asset]
	changed: []
	'open-folder': [name: string]
}>()

const accentClass = computed(
	() =>
		({
			red: 'border-t-[3px] border-t-outline-red-4',
			amber: 'border-t-[3px] border-t-outline-amber-4',
			green: 'border-t-[3px] border-t-outline-green-4',
			blue: 'border-t-[3px] border-t-outline-blue-4',
			purple: 'border-t-[3px] border-t-outline-violet-4',
			pink: 'border-t-[3px] border-t-outline-pink-4',
		})[props.asset.card_color ?? ''],
)
const previewStyle = computed(() => fileKindStyle(props.asset.file_type))
const statusDotClass = computed(
	() =>
		({
			Uploading: 'bg-surface-gray-6',
			Processing: 'bg-surface-blue-6',
			Ready: 'bg-surface-green-6',
			Error: 'bg-surface-red-6',
		})[props.asset.status],
)

function startDrag(event: DragEvent) {
	if (!props.draggable || !event.dataTransfer) return
	const names =
		props.selected && props.dragSelection?.length ? props.dragSelection : [props.asset.name]
	event.dataTransfer.setData('application/vms-assets', JSON.stringify(names))
	event.dataTransfer.effectAllowed = 'move'
}
</script>
