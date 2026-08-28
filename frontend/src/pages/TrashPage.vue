<template>
	<PageHeader>
		<PageHeaderTitle>
			<div class="min-w-0">
				<h1 class="truncate">Trash</h1>
				<p class="text-sm text-ink-gray-5">{{ itemSummary }}</p>
			</div>
		</PageHeaderTitle>
		<template #actions>
			<Button
				v-if="selected.length"
				:label="`Restore (${selected.length})`"
				icon-left="lucide-archive-restore"
				:loading="busy === 'restore'"
				@click="restoreSelected"
			/>
			<Button
				v-if="selected.length"
				:label="`Delete forever (${selected.length})`"
				icon-left="lucide-shredder"
				theme="red"
				:loading="busy === 'delete'"
				@click="confirmDelete(selected)"
			/>
			<Button
				v-else-if="totalItems"
				label="Empty trash"
				icon-left="lucide-shredder"
				theme="red"
				@click="confirmEmpty"
			/>
		</template>
	</PageHeader>

	<div class="space-y-4 px-3 py-5 pb-10 sm:px-5" data-testid="trash-page">
		<Tabs v-model="tab" :tabs="tabs" />

		<LoadingText v-if="current.loading && !currentItems.length" :lines="5" />
		<ErrorMessage v-else-if="current.error" :message="current.error" />
		<EmptyState
			v-else-if="!currentItems.length"
			icon="lucide-trash-2"
			:title="tab === 'assets' ? 'No deleted assets' : 'No deleted folders'"
			description="Deleted items will appear here until they are restored or permanently removed."
		/>

		<List
			v-else-if="tab === 'assets'"
			v-model:selection="selectedAssets"
			:columns="ASSET_COLUMNS"
			selectable
			:row-height="52"
			class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5"
		>
			<ListHeader>
				<ListHeaderCell>File name</ListHeaderCell>
				<ListHeaderCell>Project</ListHeaderCell>
				<ListHeaderCell>Category</ListHeaderCell>
				<ListHeaderCell>Deleted by</ListHeaderCell>
				<ListHeaderCell>Deleted</ListHeaderCell>
				<ListHeaderCell align="end">Size</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListGroup label="Files">
				<ListRows :items="assets" row-key="name">
					<template #default="{ item }">
						<ListRow :value="item.name">
							<ListCell><span class="truncate text-base-medium text-ink-gray-8">{{ item.file_name }}</span></ListCell>
							<ListCell><span class="truncate text-sm text-ink-gray-6">{{ item.project_name || '—' }}</span></ListCell>
							<ListCell><Badge :label="item.category" theme="gray" /></ListCell>
							<ListCell><span class="truncate text-sm text-ink-gray-7">{{ item.deleter_name || '—' }}</span></ListCell>
							<ListCell><span class="text-sm text-ink-gray-5">{{ fromNow(item.deleted_at) || '—' }}</span></ListCell>
							<ListCell class="justify-end"><span class="text-sm tabular-nums text-ink-gray-6">{{ item.file_size ? formatBytes(item.file_size) : '—' }}</span></ListCell>
							<ListCell class="justify-end gap-1" @click.stop>
								<Button icon="lucide-archive-restore" label="Restore" variant="ghost" @click="restore([item.name])" />
								<Button icon="lucide-trash-2" label="Delete forever" variant="ghost" theme="red" @click="confirmDelete([item.name])" />
							</ListCell>
						</ListRow>
					</template>
				</ListRows>
			</ListGroup>
		</List>

		<List
			v-else
			v-model:selection="selectedFolders"
			:columns="FOLDER_COLUMNS"
			selectable
			:row-height="52"
			class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5"
		>
			<ListHeader>
				<ListHeaderCell>Folder name</ListHeaderCell>
				<ListHeaderCell>Project</ListHeaderCell>
				<ListHeaderCell>Deleted by</ListHeaderCell>
				<ListHeaderCell>Deleted</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListGroup label="Folders">
				<ListRows :items="folders" row-key="name">
					<template #default="{ item }">
						<ListRow :value="item.name">
							<ListCell class="gap-2"><span class="lucide-folder size-4 text-ink-gray-4" /><span class="truncate text-base-medium text-ink-gray-8">{{ item.folder_name }}</span></ListCell>
							<ListCell><span class="truncate text-sm text-ink-gray-6">{{ item.project_name || '—' }}</span></ListCell>
							<ListCell><span class="truncate text-sm text-ink-gray-7">{{ item.deleter_name || '—' }}</span></ListCell>
							<ListCell><span class="text-sm text-ink-gray-5">{{ fromNow(item.deleted_at) || '—' }}</span></ListCell>
							<ListCell class="justify-end gap-1" @click.stop>
								<Button icon="lucide-archive-restore" label="Restore" variant="ghost" @click="restore([item.name])" />
								<Button icon="lucide-trash-2" label="Delete forever" variant="ghost" theme="red" @click="confirmDelete([item.name])" />
							</ListCell>
						</ListRow>
					</template>
				</ListRows>
			</ListGroup>
		</List>

		<div v-if="currentItems.length < currentTotal" class="flex justify-center">
			<Button label="Load more" :loading="current.loading" @click="loadMore" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Badge, Button, dialog, ErrorMessage, LoadingText, PageHeader, PageHeaderTitle, Tabs, toast, useCall, usePageMeta } from 'frappe-ui'
import { List, ListCell, ListGroup, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
import type { Asset, Folder } from '@/types'
import { fromNow } from '@/lib/dates'
import { formatBytes, serverMessage } from '@/lib/format'
import EmptyState from '@/components/common/EmptyState.vue'

usePageMeta(() => ({ title: 'Trash · VMS' }))

const PAGE_SIZE = 20
const ASSET_COLUMNS = ['minmax(10rem,1fr)', '10rem', '7rem', '10rem', '8rem', '6rem', '6rem']
const FOLDER_COLUMNS = ['minmax(10rem,1fr)', '10rem', '10rem', '8rem', '6rem']
const tab = ref<'assets' | 'folders'>('assets')
const assetLimit = ref(PAGE_SIZE)
const folderLimit = ref(PAGE_SIZE)
const selectedAssets = ref<string[]>([])
const selectedFolders = ref<string[]>([])
const busy = ref<'' | 'restore' | 'delete' | 'empty'>('')

interface AssetResponse { assets: Asset[]; total: number }
interface FolderResponse { folders: Folder[]; total: number }
interface PageParams { page: number; page_size: number }

const assetResource = useCall<AssetResponse, PageParams>({
	url: '/api/v2/method/vms.api.get_trash_assets', method: 'GET',
	params: () => ({ page: 1, page_size: assetLimit.value }), refetch: true,
	cacheKey: ['trash-assets', assetLimit],
})
const folderResource = useCall<FolderResponse, PageParams>({
	url: '/api/v2/method/vms.api.get_trash_folders', method: 'GET',
	params: () => ({ page: 1, page_size: folderLimit.value }), refetch: true,
	cacheKey: ['trash-folders', folderLimit],
})
const restoreAsset = useCall<unknown, { asset_name: string }>({ url: '/api/v2/method/vms.api.restore_asset', method: 'POST', immediate: false })
const deleteAsset = useCall<unknown, { asset_name: string }>({ url: '/api/v2/method/vms.api.permanently_delete_asset', method: 'POST', immediate: false })
const restoreFolder = useCall<unknown, { folder_name: string }>({ url: '/api/v2/method/vms.api.restore_folder', method: 'POST', immediate: false })
const deleteFolder = useCall<unknown, { folder_name: string }>({ url: '/api/v2/method/vms.api.permanently_delete_folder', method: 'POST', immediate: false })
const emptyTrash = useCall<unknown>({ url: '/api/v2/method/vms.api.empty_trash', method: 'POST', immediate: false })

const assets = computed(() => assetResource.data?.assets ?? [])
const folders = computed(() => folderResource.data?.folders ?? [])
const assetTotal = computed(() => assetResource.data?.total ?? 0)
const folderTotal = computed(() => folderResource.data?.total ?? 0)
const totalItems = computed(() => assetTotal.value + folderTotal.value)
const current = computed(() => tab.value === 'assets' ? assetResource : folderResource)
const currentItems = computed(() => tab.value === 'assets' ? assets.value : folders.value)
const currentTotal = computed(() => tab.value === 'assets' ? assetTotal.value : folderTotal.value)
const selected = computed(() => tab.value === 'assets' ? selectedAssets.value : selectedFolders.value)
const itemSummary = computed(() => totalItems.value ? `${totalItems.value} deleted item${totalItems.value === 1 ? '' : 's'}` : 'No items in trash')
const tabs = computed(() => [
	{ label: `Assets${assetTotal.value ? ` (${assetTotal.value})` : ''}`, value: 'assets' },
	{ label: `Folders${folderTotal.value ? ` (${folderTotal.value})` : ''}`, value: 'folders' },
])

watch(tab, () => { selectedAssets.value = []; selectedFolders.value = [] })

function loadMore() {
	if (tab.value === 'assets') assetLimit.value += PAGE_SIZE
	else folderLimit.value += PAGE_SIZE
}

async function reloadAll() {
	await Promise.all([assetResource.reload(), folderResource.reload()])
}

async function restore(names: string[]) {
	busy.value = 'restore'
	try {
		for (const name of names) {
			if (tab.value === 'assets') await restoreAsset.submit({ asset_name: name })
			else await restoreFolder.submit({ folder_name: name })
		}
		toast.success(`Restored ${names.length} item${names.length === 1 ? '' : 's'}`)
		selectedAssets.value = []; selectedFolders.value = []
		await reloadAll()
	} catch (error) { toast.error(serverMessage(error) || 'Could not restore items') }
	finally { busy.value = '' }
}

function restoreSelected() { return restore([...selected.value]) }

function confirmDelete(names: string[]) {
	dialog.danger({
		title: `Delete ${names.length} item${names.length === 1 ? '' : 's'} forever?`,
		message: 'This action cannot be undone.', confirmLabel: 'Delete forever',
		onConfirm: () => permanentlyDelete(names),
	})
}

async function permanentlyDelete(names: string[]) {
	busy.value = 'delete'
	try {
		for (const name of names) {
			if (tab.value === 'assets') await deleteAsset.submit({ asset_name: name })
			else await deleteFolder.submit({ folder_name: name })
		}
		toast.success(`Permanently deleted ${names.length} item${names.length === 1 ? '' : 's'}`)
		selectedAssets.value = []; selectedFolders.value = []
		await reloadAll()
	} catch (error) { toast.error(serverMessage(error) || 'Could not delete items') }
	finally { busy.value = '' }
}

function confirmEmpty() {
	dialog.danger({
		title: 'Empty trash?', message: `Permanently delete all ${totalItems.value} items? This action cannot be undone.`,
		confirmLabel: 'Empty trash', onConfirm: runEmpty,
	})
}

async function runEmpty() {
	busy.value = 'empty'
	try { await emptyTrash.submit(); toast.success('Trash emptied'); await reloadAll() }
	catch (error) { toast.error(serverMessage(error) || 'Could not empty trash') }
	finally { busy.value = '' }
}
</script>
