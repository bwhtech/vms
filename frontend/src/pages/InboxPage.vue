<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">
				Inbox
				<span v-if="total" class="text-ink-gray-5">{{ total }}</span>
			</h1>
		</PageHeaderTitle>
		<Button
			variant="solid"
			label="Upload"
			icon-left="lucide-upload"
			data-testid="inbox-upload"
			@click="openUpload({ onDone: reload })"
		/>
	</PageHeader>

	<div class="px-3 py-5 pb-10 sm:px-5" data-testid="inbox">
		<!-- Bulk toolbar -->
		<div
			v-if="selection.length"
			class="mb-3 flex flex-wrap items-center gap-2"
			data-testid="inbox-bulk-bar"
		>
			<span class="text-sm text-ink-gray-6">{{ selection.length }} selected</span>
			<Select
				v-model="bulkCategory"
				:options="categoryOptions"
				placeholder="Categorise"
				:disabled="bulkBusy"
				class="w-36"
				data-testid="inbox-bulk-categorise"
				@update:model-value="bulkCategorise"
			/>
			<Button
				label="Download"
				icon-left="lucide-download"
				:loading="isDownloading"
				@click="downloadMany(selectedAssets)"
			/>
			<Button variant="ghost" label="Clear" :disabled="bulkBusy" @click="selection = []" />
		</div>

		<LoadingText v-if="inbox.loading && !assets.length" :lines="4" />
		<div v-else-if="inbox.error && !assets.length" class="space-y-3 py-6">
			<ErrorMessage :message="inbox.error" />
			<Button label="Try again" icon-left="lucide-refresh-cw" @click="reload" />
		</div>

		<EmptyState
			v-else-if="!assets.length"
			icon="lucide-inbox"
			title="No uncategorised assets"
			description="Files uploaded without a project land here. Categorise them, then move them into a project."
			data-testid="inbox-empty"
		>
			<template #actions>
				<Button
					variant="solid"
					label="Upload"
					icon-left="lucide-upload"
					@click="openUpload({ onDone: reload })"
				/>
			</template>
		</EmptyState>

		<template v-else>
			<List
				v-model:selection="selection"
				selectable
				:columns="COLUMNS"
				class="-mx-3 list-row-px-3 max-sm:[--list-columns:auto_minmax(0,1fr)_auto]"
				data-testid="inbox-list"
			>
				<ListHeader class="max-sm:!hidden">
					<ListHeaderCell>Name</ListHeaderCell>
					<ListHeaderCell>Categorise</ListHeaderCell>
					<ListHeaderCell>Status</ListHeaderCell>
					<ListHeaderCell class="justify-end">Size</ListHeaderCell>
					<ListHeaderCell>Uploaded</ListHeaderCell>
					<ListHeaderCell />
				</ListHeader>
				<ListRows v-slot="{ item: groupRow }" :items="groupedRows">
					<ListGroup v-if="groupRow.dayGroup" :label="groupRow.dayGroup.label">
						<ListRow
							v-for="asset in groupRow.dayGroup.items"
							:key="asset.name"
							:value="asset.name"
							class="min-h-12"
							data-testid="inbox-row"
						>
							<ListCell>
								<div class="flex min-w-0 items-center gap-3">
									<div
										class="flex h-6 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-gray-2"
									>
										<img
											v-if="asset.thumbnail_url"
											:src="asset.thumbnail_url"
											:alt="asset.file_name"
											class="size-full object-cover"
										/>
										<span
											v-else
											:class="[
												fileIcon(asset.file_type),
												'size-3.5 text-ink-gray-5',
											]"
											aria-hidden="true"
										/>
									</div>
									<div class="min-w-0">
										<RouterLink
											v-if="asset.status === 'Ready'"
											:to="`/review/${asset.name}`"
											class="block truncate text-base text-ink-gray-8 hover:underline"
											data-testid="inbox-row-name"
											@click.stop
										>
											{{ asset.file_name }}
										</RouterLink>
										<p v-else class="truncate text-base text-ink-gray-8">
											{{ asset.file_name }}
										</p>
										<p class="mt-0.5 truncate text-sm text-ink-gray-5">
											{{ asset.uploader_name || asset.uploaded_by }}
											<span class="sm:hidden">
												· {{ asset.status }} ·
												{{ formatBytes(asset.file_size ?? 0) }}
											</span>
										</p>
										<div class="mt-1.5 w-32 sm:hidden" @click.stop>
											<Select
												v-model="categoryDrafts[asset.name]"
												:options="categoryOptions"
												:disabled="bulkBusy || busy.has(asset.name)"
												aria-label="Categorise asset"
												@update:model-value="categorise(asset, $event)"
											/>
										</div>
									</div>
								</div>
							</ListCell>
							<ListCell class="max-sm:hidden" @click.stop>
								<Select
									v-model="categoryDrafts[asset.name]"
									:options="categoryOptions"
									:disabled="bulkBusy || busy.has(asset.name)"
									data-testid="inbox-row-categorise"
									@update:model-value="categorise(asset, $event)"
								/>
							</ListCell>
							<ListCell class="max-sm:hidden">
								<Badge
									:label="asset.status"
									:theme="assetStatusTheme(asset.status)"
								/>
							</ListCell>
							<ListCell
								class="justify-end text-sm text-ink-gray-7 tabular-nums max-sm:hidden"
							>
								{{ formatBytes(asset.file_size ?? 0) }}
							</ListCell>
							<ListCell class="text-sm max-sm:hidden">
								<RelativeTime :date="asset.uploaded_at || asset.creation" />
							</ListCell>
							<ListCell class="justify-end" @click.stop>
								<AssetActions :asset="asset" @changed="reload" />
							</ListCell>
						</ListRow>
					</ListGroup>
				</ListRows>
			</List>

			<div
				v-if="assets.length < total"
				class="mt-4 flex flex-wrap items-center justify-center gap-3"
				data-testid="inbox-load-more"
			>
				<span class="text-sm text-ink-gray-5">{{ assets.length }} of {{ total }}</span>
				<ErrorMessage v-if="inbox.error" :message="inbox.error" />
				<Button
					:label="inbox.error ? 'Try again' : 'Load more'"
					:loading="inbox.loading"
					@click="loadMore"
				/>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
	Badge,
	Button,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	Select,
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
import { ASSET_CATEGORIES, type Asset, type AssetCategory } from '@/types'
import { groupByDay } from '@/lib/dates'
import { formatBytes, serverMessage } from '@/lib/format'
import { assetStatusTheme } from '@/lib/status'
import { useDownload } from '@/composables/useDownload'
import { useOverlays } from '@/composables/useOverlays'
import AssetActions from '@/components/assets/AssetActions.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'

usePageMeta(() => ({ title: 'Inbox · VMS' }))

const PAGE_SIZE = 20
const COLUMNS = ['minmax(12rem,1fr)', '9rem', '6rem', '5rem', '7rem', '2.5rem']

const { openUpload } = useOverlays()
const { downloadMany, isDownloading } = useDownload()

const categoryOptions = ASSET_CATEGORIES.map((c) => ({ label: c, value: c }))

interface InboxResponse {
	assets: Asset[]
	total: number
	page: number
	page_size: number
	total_pages: number
}

interface InboxParams {
	start: number
	page_length: number
}

// Pages accumulate into `assets`; `start` is the offset of the page in flight.
const start = ref(0)
const assets = ref<Asset[]>([])
const total = ref(0)
const categoryDrafts = reactive<Record<string, AssetCategory | undefined>>({})

const inbox = useCall<InboxResponse, InboxParams>({
	url: '/api/v2/method/vms.api.get_inbox_assets',
	method: 'GET',
	params: () => ({ start: start.value, page_length: PAGE_SIZE }),
	cacheKey: 'inbox-assets',
	onSuccess: (data) => {
		total.value = data.total
		for (const asset of data.assets) categoryDrafts[asset.name] = asset.category
		assets.value = start.value === 0 ? data.assets : [...assets.value, ...data.assets]
	},
})

function reload() {
	selection.value = []
	start.value = 0
	void inbox.reload()
}

function loadMore() {
	start.value = assets.value.length
	void inbox.reload()
}

const groups = computed(() => groupByDay(assets.value, (a) => a.uploaded_at || a.creation))
const groupedRows = computed(() => {
	const groupStarts = new Map(groups.value.map((group) => [group.items[0]?.name, group]))
	return assets.value.map((asset) => ({ ...asset, dayGroup: groupStarts.get(asset.name) }))
})

const selection = ref<string[]>([])
const selectedAssets = computed(() => assets.value.filter((a) => selection.value.includes(a.name)))

const categoryCall = useCall<
	{ status: string; asset_name: string; category: string },
	{ asset_name: string; category: string }
>({
	url: '/api/v2/method/vms.api.update_asset_category',
	method: 'POST',
	immediate: false,
})

const busy = ref(new Set<string>())
const bulkBusy = ref(false)
const bulkCategory = ref<AssetCategory>()

async function setCategory(asset: Asset, category: AssetCategory) {
	if (asset.category === category) return
	await categoryCall.submit({ asset_name: asset.name, category })
	asset.category = category
	categoryDrafts[asset.name] = category
}

async function categorise(asset: Asset, value: string | number | undefined) {
	const category = toCategory(value)
	if (!category) return
	busy.value = new Set(busy.value).add(asset.name)
	try {
		await setCategory(asset, category)
	} catch (e) {
		categoryDrafts[asset.name] = asset.category
		toast.error(serverMessage(e) || 'Could not update category')
	} finally {
		const next = new Set(busy.value)
		next.delete(asset.name)
		busy.value = next
	}
}

async function bulkCategorise(value: string | number | undefined) {
	const category = toCategory(value)
	if (!category) return
	const targets = [...selectedAssets.value]
	bulkBusy.value = true
	let failed = 0
	try {
		for (const asset of targets) {
			try {
				await setCategory(asset, category)
			} catch {
				categoryDrafts[asset.name] = asset.category
				failed++
			}
		}
	} finally {
		bulkBusy.value = false
	}
	if (failed) toast.error(`${failed} asset(s) could not be updated`)
	else toast.success(`${targets.length} asset(s) marked ${category}`)
	bulkCategory.value = undefined
	selection.value = []
}

function toCategory(value: string | number | undefined): AssetCategory | null {
	return ASSET_CATEGORIES.includes(value as AssetCategory) ? (value as AssetCategory) : null
}

function fileIcon(fileType?: string): string {
	if (fileType?.startsWith('video/')) return 'lucide-film'
	if (fileType?.startsWith('image/')) return 'lucide-image'
	if (fileType?.startsWith('audio/')) return 'lucide-music'
	return 'lucide-file'
}
</script>
