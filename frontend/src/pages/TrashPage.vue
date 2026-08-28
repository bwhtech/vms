<template>
	<PageHeader>
		<PageHeaderTitle>
			<div class="min-w-0">
				<h1 class="truncate">Trash</h1>
				<p class="text-sm text-ink-gray-5">{{ summary }}</p>
			</div>
		</PageHeaderTitle>
		<div class="flex items-center gap-2">
			<template v-if="selected.length">
				<Button
					:label="`Restore (${selected.length})`"
					icon-left="lucide-archive-restore"
					:loading="busy === 'restore'"
					data-testid="trash-restore-selected"
					@click="restore(selected)"
				/>
				<Button
					:label="`Delete forever (${selected.length})`"
					icon-left="lucide-trash-2"
					theme="red"
					:loading="busy === 'delete'"
					data-testid="trash-delete-selected"
					@click="confirmDelete(selected)"
				/>
			</template>
			<Button
				v-else-if="total"
				label="Empty trash"
				icon-left="lucide-trash-2"
				theme="red"
				variant="solid"
				:loading="busy === 'empty'"
				data-testid="trash-empty"
				@click="confirmEmpty"
			/>
		</div>
	</PageHeader>

	<div class="px-3 py-5 pb-10 sm:px-5" data-testid="trash-page">
		<LoadingText v-if="loading && !rows.length" :lines="5" />
		<ErrorMessage v-else-if="loadError && !rows.length" :message="loadError" />
		<EmptyState
			v-else-if="!rows.length"
			icon="lucide-trash-2"
			title="Trash is empty"
			description="Deleted folders and assets stay here until you restore them or delete them forever."
		/>

		<template v-else>
			<List
				v-model:selection="selection"
				selectable
				:columns="COLUMNS"
				class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5 max-sm:[--list-columns:auto_minmax(0,1fr)_auto]"
				data-testid="trash-list"
			>
				<ListHeader class="max-sm:!hidden">
					<ListHeaderCell>Name</ListHeaderCell>
					<ListHeaderCell>Project</ListHeaderCell>
					<ListHeaderCell>Deleted by</ListHeaderCell>
					<ListHeaderCell>Deleted</ListHeaderCell>
					<ListHeaderCell class="justify-end">Size</ListHeaderCell>
					<ListHeaderCell />
				</ListHeader>
				<ListRows v-slot="{ item: groupRow }" :items="groupedRows" row-key="key">
					<ListGroup v-if="groupRow.group" :label="groupRow.group.label">
						<ListRow
							v-for="row in groupRow.group.items"
							:key="row.key"
							:value="row.key"
							class="min-h-12"
							data-testid="trash-row"
						>
							<ListCell>
								<div class="flex min-w-0 items-center gap-3">
									<span
										:class="[
											row.kind === 'folder' ? 'lucide-folder' : 'lucide-file',
											'size-4 shrink-0 text-ink-gray-5',
										]"
										aria-hidden="true"
									/>
									<div class="min-w-0">
										<p class="truncate text-base text-ink-gray-8">
											{{ row.label }}
										</p>
										<p
											class="mt-0.5 truncate text-sm text-ink-gray-5 sm:hidden"
										>
											{{ row.project_name || 'No project' }} ·
											<RelativeTime
												v-if="row.deleted_at"
												:date="row.deleted_at"
											/>
										</p>
									</div>
								</div>
							</ListCell>
							<ListCell class="max-sm:hidden">
								<span class="truncate text-sm text-ink-gray-7">{{
									row.project_name || '—'
								}}</span>
							</ListCell>
							<ListCell class="max-sm:hidden">
								<span class="truncate text-sm text-ink-gray-7">{{
									row.deleter_name || '—'
								}}</span>
							</ListCell>
							<ListCell class="text-sm max-sm:hidden">
								<RelativeTime v-if="row.deleted_at" :date="row.deleted_at" />
								<span v-else class="text-ink-gray-5">—</span>
							</ListCell>
							<ListCell
								class="justify-end text-sm text-ink-gray-7 tabular-nums max-sm:hidden"
							>
								{{ row.file_size ? formatBytes(row.file_size) : '—' }}
							</ListCell>
							<ListCell class="justify-end gap-1" @click.stop>
								<Button
									icon="lucide-archive-restore"
									label="Restore"
									variant="ghost"
									:disabled="Boolean(busy)"
									@click="restore([row.key])"
								/>
								<Button
									icon="lucide-trash-2"
									label="Delete forever"
									variant="ghost"
									theme="red"
									:disabled="Boolean(busy)"
									@click="confirmDelete([row.key])"
								/>
							</ListCell>
						</ListRow>
					</ListGroup>
				</ListRows>
			</List>

			<div
				v-if="rows.length < total"
				class="mt-4 flex flex-wrap items-center justify-center gap-3"
				data-testid="trash-load-more"
			>
				<span class="text-sm text-ink-gray-5">{{ rows.length }} of {{ total }}</span>
				<ErrorMessage v-if="loadError" :message="loadError" />
				<Button
					:label="loadError ? 'Try again' : 'Load more'"
					:loading="loading"
					@click="loadMore"
				/>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
	Button,
	dialog,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	toast,
	useCall,
	usePageMeta,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListGroup,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import type { Asset, Folder } from '@/types'
import { formatBytes, serverMessage } from '@/lib/format'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'

usePageMeta(() => ({ title: 'Trash · VMS' }))

const PAGE_SIZE = 20
const COLUMNS = ['minmax(10rem,1fr)', '10rem', '10rem', '8rem', '6rem', 'auto']

type TrashKind = 'folder' | 'asset'
interface TrashRow {
	/** `${kind}:${name}` — unique across both doctypes, used as the row value. */
	key: string
	kind: TrashKind
	name: string
	label: string
	project_name?: string
	deleter_name?: string
	deleted_at?: string | null
	file_size?: number
}
interface PageParams {
	page: number
	page_size: number
}
interface FolderResponse {
	folders: Folder[]
	total: number
}
interface AssetResponse {
	assets: Asset[]
	total: number
}

const folders = ref<Folder[]>([])
const assets = ref<Asset[]>([])
const folderTotal = ref(0)
const assetTotal = ref(0)
const folderPage = ref(1)
const assetPage = ref(1)
const selection = ref<string[]>([])
const busy = ref<'' | 'restore' | 'delete' | 'empty'>('')

const trashFolders = useCall<FolderResponse, PageParams>({
	url: '/api/v2/method/vms.api.get_trash_folders',
	method: 'GET',
	params: () => ({ page: folderPage.value, page_size: PAGE_SIZE }),
	cacheKey: 'trash-folders',
	onSuccess: (data) => {
		folderTotal.value = data.total
		folders.value = folderPage.value === 1 ? data.folders : [...folders.value, ...data.folders]
	},
})
const trashAssets = useCall<AssetResponse, PageParams>({
	url: '/api/v2/method/vms.api.get_trash_assets',
	method: 'GET',
	params: () => ({ page: assetPage.value, page_size: PAGE_SIZE }),
	cacheKey: 'trash-assets',
	onSuccess: (data) => {
		assetTotal.value = data.total
		assets.value = assetPage.value === 1 ? data.assets : [...assets.value, ...data.assets]
	},
})

const restoreAsset = useCall<{ status: string }, { asset_name: string }>({
	url: '/api/v2/method/vms.api.restore_asset',
	method: 'POST',
	immediate: false,
})
const restoreFolder = useCall<{ status: string }, { folder_name: string }>({
	url: '/api/v2/method/vms.api.restore_folder',
	method: 'POST',
	immediate: false,
})
const deleteAsset = useCall<{ status: string }, { asset_name: string }>({
	url: '/api/v2/method/vms.api.permanently_delete_asset',
	method: 'POST',
	immediate: false,
})
const deleteFolder = useCall<{ status: string }, { folder_name: string }>({
	url: '/api/v2/method/vms.api.permanently_delete_folder',
	method: 'POST',
	immediate: false,
})
const emptyTrash = useCall<{ status: string; count: number }>({
	url: '/api/v2/method/vms.api.empty_trash',
	method: 'POST',
	immediate: false,
})

const loading = computed(() => trashFolders.loading || trashAssets.loading)
const loadError = computed(() => trashFolders.error || trashAssets.error)
const total = computed(() => folderTotal.value + assetTotal.value)
const selected = computed(() => selection.value)
const summary = computed(() =>
	total.value
		? `${total.value} deleted ${total.value === 1 ? 'item' : 'items'}`
		: 'Nothing in trash',
)

const rows = computed<TrashRow[]>(() => [
	...folders.value.map((f) => ({
		key: `folder:${f.name}`,
		kind: 'folder' as const,
		name: f.name,
		label: f.folder_name,
		project_name: f.project_name,
		deleter_name: f.deleter_name,
		deleted_at: f.deleted_at,
	})),
	...assets.value.map((a) => ({
		key: `asset:${a.name}`,
		kind: 'asset' as const,
		name: a.name,
		label: a.file_name,
		project_name: a.project_name,
		deleter_name: a.deleter_name,
		deleted_at: a.deleted_at,
		file_size: a.file_size,
	})),
])

// One group per kind; the first row of each carries the group so `ListRows`
// still sees every row (keeps select-all and row identity intact).
const groupedRows = computed(() => {
	const groups = (['folder', 'asset'] as const)
		.map((kind) => ({
			kind,
			label: kind === 'folder' ? 'Folders' : 'Assets',
			items: rows.value.filter((r) => r.kind === kind),
		}))
		.filter((g) => g.items.length)
	const starts = new Map(groups.map((g) => [g.items[0]?.key, g]))
	return rows.value.map((row) => ({ ...row, group: starts.get(row.key) }))
})

function reload() {
	selection.value = []
	folderPage.value = 1
	assetPage.value = 1
	return Promise.all([trashFolders.reload(), trashAssets.reload()])
}

function loadMore() {
	if (folders.value.length < folderTotal.value) {
		folderPage.value += 1
		void trashFolders.reload()
	}
	if (assets.value.length < assetTotal.value) {
		assetPage.value += 1
		void trashAssets.reload()
	}
}

function splitKey(key: string): { kind: TrashKind; name: string } {
	const index = key.indexOf(':')
	return { kind: key.slice(0, index) as TrashKind, name: key.slice(index + 1) }
}

function countLabel(count: number) {
	return `${count} ${count === 1 ? 'item' : 'items'}`
}

async function restore(keys: string[]) {
	busy.value = 'restore'
	try {
		for (const key of keys) {
			const { kind, name } = splitKey(key)
			if (kind === 'folder') await restoreFolder.submit({ folder_name: name })
			else await restoreAsset.submit({ asset_name: name })
		}
		toast.success(`Restored ${countLabel(keys.length)}`)
		await reload()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not restore')
	} finally {
		busy.value = ''
	}
}

function confirmDelete(keys: string[]) {
	dialog.danger({
		title: `Delete ${countLabel(keys.length)} forever?`,
		message: 'The files are removed from storage. This cannot be undone.',
		confirmLabel: 'Delete forever',
		onConfirm: () => permanentlyDelete(keys),
	})
}

async function permanentlyDelete(keys: string[]) {
	busy.value = 'delete'
	try {
		for (const key of keys) {
			const { kind, name } = splitKey(key)
			if (kind === 'folder') await deleteFolder.submit({ folder_name: name })
			else await deleteAsset.submit({ asset_name: name })
		}
		toast.success(`Deleted ${countLabel(keys.length)} forever`)
		await reload()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not delete')
	} finally {
		busy.value = ''
	}
}

function confirmEmpty() {
	dialog.danger({
		title: 'Empty trash?',
		message: `All ${countLabel(total.value)} in trash are deleted forever. This cannot be undone.`,
		confirmLabel: 'Empty trash',
		onConfirm: runEmpty,
	})
}

async function runEmpty() {
	busy.value = 'empty'
	try {
		await emptyTrash.submit()
		toast.success('Trash emptied')
		await reload()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not empty trash')
	} finally {
		busy.value = ''
	}
}
</script>
