<template>
	<article
		class="group cursor-pointer overflow-hidden rounded-5 border border-outline-gray-1 bg-surface-base transition hover:border-outline-gray-2 hover:shadow-sm"
		data-testid="shared-asset-card"
		@click="$emit('open')"
	>
		<div class="relative aspect-video bg-surface-gray-2">
			<img
				v-if="asset.thumbnail_url"
				:src="asset.thumbnail_url"
				alt=""
				class="size-full object-cover"
			/>
			<div
				v-else
				:class="['grid size-full place-items-center', fileKindStyle(asset.file_type).tile]"
			>
				<span :class="[fileKindStyle(asset.file_type).icon, 'size-8']" aria-hidden="true" />
			</div>
		</div>
		<div class="flex items-start gap-2 p-3">
			<div class="min-w-0 flex-1">
				<p class="truncate text-base text-ink-gray-8" :title="asset.file_name">
					{{ asset.file_name }}
				</p>
				<p class="mt-1 flex items-center gap-2 truncate text-sm text-ink-gray-5">
					<span v-if="asset.file_size">{{ formatBytes(asset.file_size) }}</span>
					<Badge :label="asset.category" theme="gray" variant="subtle" />
				</p>
			</div>
			<Dropdown
				v-if="isConvertibleStill(asset.file_type, asset.file_name)"
				:options="downloadMenu"
				align="end"
			>
				<Button variant="ghost" icon="lucide-download" label="Download" @click.stop />
			</Dropdown>
			<Button
				v-else
				variant="ghost"
				icon="lucide-download"
				label="Download"
				@click.stop="$emit('download')"
			/>
		</div>
	</article>
</template>

<script setup lang="ts">
import { Badge, Button, Dropdown, type DropdownOption } from 'frappe-ui'
import { fileKindStyle, isConvertibleStill } from '@/lib/fileType'
import { formatBytes } from '@/lib/format'

export interface SharedAssetCardData {
	name: string
	file_name: string
	category: string
	file_size?: number
	file_type?: string
	thumbnail_url?: string
}

defineProps<{ asset: SharedAssetCardData; downloadMenu: DropdownOption[] }>()
defineEmits<{ open: []; download: [] }>()
</script>
