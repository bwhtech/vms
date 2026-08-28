<template>
	<List
		v-model:selection="selectionModel"
		:columns="['minmax(0,1fr)', '8rem', '7.5rem', '6rem', '3rem']"
		selectable
		:row-height="56"
		class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5 max-sm:[--list-columns:auto_minmax(0,1fr)_3rem]"
	>
		<ListHeader class="max-sm:!hidden">
			<ListHeaderCellSort
				:direction="direction('file_name')"
				@click="toggleSort('file_name')"
			>
				Name
			</ListHeaderCellSort>
			<ListHeaderCell>Category</ListHeaderCell>
			<ListHeaderCellSort :direction="direction('creation')" @click="toggleSort('creation')">
				Modified
			</ListHeaderCellSort>
			<ListHeaderCellSort
				align="end"
				:direction="direction('file_size')"
				@click="toggleSort('file_size')"
			>
				Size
			</ListHeaderCellSort>
			<ListHeaderCell />
		</ListHeader>

		<ListGroup v-if="folders.length" label="Folders">
			<FolderRow
				v-for="folder in folders"
				:key="folder.name"
				:folder="folder"
				:project="project"
				:item-count="folderCounts.get(folder.name) ?? 0"
				draggable
				@rename="emit('rename-folder', $event)"
				@move="emit('move-folder', $event)"
				@delete="emit('delete-folder', $event)"
				@drop-assets="(names, target) => emit('drop-assets', names, target)"
				@drop-folder="(name, target) => emit('drop-folder', name, target)"
			/>
		</ListGroup>

		<ListGroup label="Files">
			<ListRows :items="assets" row-key="name">
				<template #default="{ item: asset }">
					<ListRow
						:value="asset.name"
						draggable="true"
						@dragstart="startDrag($event, asset)"
					>
						<ListCell class="gap-3">
							<div
								class="grid h-8 w-12 shrink-0 place-items-center overflow-hidden rounded bg-surface-gray-2 text-ink-gray-4"
							>
								<img
									v-if="asset.thumbnail_url"
									:src="asset.thumbnail_url"
									alt=""
									draggable="false"
									class="size-full object-cover"
								/>
								<span v-else class="lucide-film size-4" aria-hidden="true" />
							</div>
							<div class="min-w-0 flex-1">
								<Button
									class="max-w-full justify-start"
									variant="ghost"
									:label="asset.file_name"
									@click.stop="emit('open', asset)"
								/>
								<Button
									v-if="asset.folder && folderPaths?.get(asset.folder)"
									class="max-w-full justify-start text-ink-gray-5"
									variant="ghost"
									icon-left="lucide-folder"
									:label="folderPaths.get(asset.folder)"
									@click.stop="emit('open-folder', asset.folder)"
								/>
								<div v-if="asset.status === 'Processing'" class="mt-1 max-w-40">
									<Progress :value="55" />
								</div>
							</div>
						</ListCell>
						<ListCell class="max-sm:hidden">
							<CategoryBadge
								:asset-name="asset.name"
								:category="asset.category"
								@changed="emit('changed')"
							/>
						</ListCell>
						<ListCell class="max-sm:hidden">
							<span class="text-sm text-ink-gray-5">{{
								fromNow(asset.modified || asset.creation)
							}}</span>
						</ListCell>
						<ListCell class="justify-end max-sm:hidden">
							<span class="text-sm text-ink-gray-7">{{
								formatBytes(asset.file_size ?? 0)
							}}</span>
						</ListCell>
						<ListCell class="justify-end" @click.stop>
							<AssetActions :asset="asset" @changed="emit('changed')" />
						</ListCell>
					</ListRow>
				</template>
			</ListRows>
		</ListGroup>
	</List>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Progress } from 'frappe-ui'
import {
	List,
	ListCell,
	ListGroup,
	ListHeader,
	ListHeaderCell,
	ListHeaderCellSort,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import type { Asset, Folder } from '@/types'
import { formatBytes } from '@/lib/format'
import { fromNow } from '@/lib/dates'
import AssetActions from '@/components/assets/AssetActions.vue'
import CategoryBadge from '@/components/assets/CategoryBadge.vue'
import FolderRow from '@/components/folders/FolderRow.vue'

type AssetSortField = 'creation' | 'file_size' | 'file_name'
interface AssetSort {
	field: AssetSortField
	order: 'asc' | 'desc'
}

const props = defineProps<{
	assets: Asset[]
	folders: Folder[]
	project: string
	selection: string[]
	sort: AssetSort
	folderCounts: Map<string, number>
	folderPaths?: Map<string, string>
}>()
const emit = defineEmits<{
	'update:selection': [value: string[]]
	'update:sort': [value: AssetSort]
	open: [asset: Asset]
	changed: []
	'open-folder': [name: string]
	'rename-folder': [folder: Folder]
	'move-folder': [folder: Folder]
	'delete-folder': [folder: Folder]
	'drop-assets': [names: string[], folder: string]
	'drop-folder': [name: string, folder: string]
}>()

const selectionModel = computed({
	get: () => props.selection,
	set: (value) => emit('update:selection', value),
})

function direction(field: AssetSortField) {
	return props.sort.field === field ? props.sort.order : null
}

function toggleSort(field: AssetSortField) {
	const order = props.sort.field === field && props.sort.order === 'asc' ? 'desc' : 'asc'
	emit('update:sort', { field, order })
}

function startDrag(event: DragEvent, asset: Asset) {
	if (!event.dataTransfer) return
	const names =
		props.selection.includes(asset.name) && props.selection.length > 1
			? props.selection
			: [asset.name]
	event.dataTransfer.setData('application/vms-assets', JSON.stringify(names))
	event.dataTransfer.effectAllowed = 'move'
}
</script>
