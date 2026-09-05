import { computed, onScopeDispose, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { useRouter } from 'vue-router'
import { dialog, toast, useCall, useDoc, useList } from 'frappe-ui'
import type { Asset, AssetCategory, Folder, Project, ViewUrlResponse } from '@/types'
import { buildFolderPathMap } from '@/lib/folderPaths'
import { serverMessage } from '@/lib/format'
import { onRealtime } from '@/composables/useRealtime'

interface AssetSort {
	field: 'creation' | 'file_size' | 'file_name'
	order: 'asc' | 'desc'
}

const PAGE_SIZE = 20

interface ProjectAssetsResponse {
	assets: Asset[]
	total: number
	page: number
	page_size: number
	total_pages: number
}

interface ConversionEvent {
	asset_name: string
	status: string
	error_message?: string
}

export function useProjectBrowser(
	projectId: MaybeRefOrGetter<string>,
	folderId: MaybeRefOrGetter<string | undefined>,
) {
	const router = useRouter()
	const currentProject = computed(() => toValue(projectId))
	const currentFolder = computed(() => toValue(folderId) || null)
	const searchInput = ref('')
	const search = ref('')
	const category = ref<AssetCategory | ''>('')
	const tag = ref<string | null>(null)
	const sort = ref<AssetSort>({ field: 'creation', order: 'desc' })
	const limit = ref(PAGE_SIZE)
	const selection = ref<string[]>([])
	const preview = ref<{ asset: Asset; url: string } | null>(null)
	const view = ref<'grid' | 'list'>(storedView())
	let debounceTimer: ReturnType<typeof setTimeout> | undefined
	let pollTimer: ReturnType<typeof setInterval> | undefined

	const project = useDoc<Project>({ doctype: 'VMS Project', name: currentProject })
	const folders = useList<Folder>({
		doctype: 'VMS Folder',
		fields: [
			'name',
			'folder_name',
			'project',
			'parent_folder',
			'share_token',
			'creation',
			'modified',
		],
		filters: () => ({ project: currentProject.value, deleted_at: ['is', 'not set'] }),
		orderBy: 'folder_name asc',
		limit: 500,
		cacheKey: ['project-folders', currentProject.value],
	})
	const countRows = useList<Pick<Asset, 'name' | 'folder'>>({
		doctype: 'VMS Asset',
		fields: ['name', 'folder'],
		filters: () => ({
			project: currentProject.value,
			deleted_at: ['is', 'not set'],
			status: ['!=', 'Uploading'],
		}),
		limit: 500,
		cacheKey: ['project-asset-folder-counts', currentProject.value],
	})
	const assetsCall = useCall<
		ProjectAssetsResponse,
		{
			project: string
			folder?: string
			category?: AssetCategory
			tag?: string
			search?: string
			page: number
			page_size: number
			sort_by: AssetSort['field']
			sort_order: AssetSort['order']
		}
	>({
		url: '/api/v2/method/vms.api.get_project_assets',
		method: 'GET',
		params: () => ({
			project: currentProject.value,
			folder: category.value ? undefined : (currentFolder.value ?? undefined),
			category: category.value || undefined,
			tag: tag.value || undefined,
			search: search.value || undefined,
			page: 1,
			page_size: limit.value,
			sort_by: sort.value.field,
			sort_order: sort.value.order,
		}),
		refetch: true,
		cacheKey: ['project-assets', currentProject.value],
		staleOnError: true,
	})

	const assets = computed(() => assetsCall.data?.assets ?? [])
	const total = computed(() => assetsCall.data?.total ?? 0)
	const allFolders = computed(() => folders.data ?? [])
	const currentFolderDoc = computed(
		() => allFolders.value.find((folder) => folder.name === currentFolder.value) ?? null,
	)
	const childFolders = computed(() =>
		allFolders.value.filter((folder) => (folder.parent_folder || null) === currentFolder.value),
	)
	const trail = computed(() => buildTrail(allFolders.value, currentFolderDoc.value))
	const folderNotFound = computed(() =>
		Boolean(currentFolder.value && folders.isFinished && !currentFolderDoc.value),
	)
	const resultsSpanFolders = computed(() => Boolean(category.value || tag.value || search.value))
	const folderPaths = computed(() =>
		resultsSpanFolders.value
			? buildFolderPathMap(allFolders.value, category.value ? null : currentFolder.value)
			: undefined,
	)
	const visibleFolders = computed(() => (resultsSpanFolders.value ? [] : childFolders.value))
	const selectedAssets = computed(() =>
		assets.value.filter((asset) => selection.value.includes(asset.name)),
	)
	const folderCounts = computed(() => {
		const counts = new Map<string, number>()
		for (const asset of countRows.data ?? []) {
			if (asset.folder) counts.set(asset.folder, (counts.get(asset.folder) ?? 0) + 1)
		}
		for (const folder of allFolders.value) {
			if (folder.parent_folder) {
				counts.set(folder.parent_folder, (counts.get(folder.parent_folder) ?? 0) + 1)
			}
		}
		return counts
	})
	const hasMore = computed(() => assets.value.length < total.value)
	const hasProcessing = computed(() => assets.value.some((asset) => asset.status === 'Processing'))

	watch(searchInput, (value) => {
		clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => (search.value = value.trim()), 250)
	})
	watch([currentProject, currentFolder, category, tag, search, sort], resetList, { deep: true })
	watch(view, (value) => localStorage.setItem('vms_asset_view', value))
	watch(hasProcessing, configurePolling, { immediate: true })

	onRealtime<ConversionEvent>('asset_conversion_progress', (event) => {
		if (!assets.value.some((asset) => asset.name === event.asset_name)) return
		if (event.status === 'Ready') toast.success('MP4 conversion complete')
		if (event.status === 'Error') toast.error(event.error_message || 'MP4 conversion failed')
		void reloadAssets()
	})

	onScopeDispose(() => {
		clearTimeout(debounceTimer)
		clearInterval(pollTimer)
	})

	async function reloadAssets() {
		await assetsCall.reload()
		void countRows.reload()
	}

	async function reloadAll() {
		await Promise.all([assetsCall.reload(), folders.reload(), countRows.reload()])
	}

	async function openAsset(asset: Asset) {
		if (asset.status !== 'Ready') return
		if (!asset.file_type?.startsWith('image/')) {
			await router.push(`/review/${asset.name}`)
			return
		}
		await showPreview(asset)
	}

	async function showPreview(asset: Asset) {
		try {
			const result = await viewUrl.submit({ asset_name: asset.name })
			if (result?.url) preview.value = { asset, url: result.url }
		} catch (error) {
			toast.error(serverMessage(error) || 'Could not open preview')
		}
	}

	/** The gallery the preview steps through: the images of the listing behind it. */
	const previewable = computed(() =>
		assets.value.filter(
			(asset) => asset.status === 'Ready' && asset.file_type?.startsWith('image/'),
		),
	)
	const previewIndex = computed(() => {
		const current = preview.value?.asset.name
		return current ? previewable.value.findIndex((asset) => asset.name === current) : -1
	})
	const hasPreviousPreview = computed(() => previewIndex.value > 0)
	const hasNextPreview = computed(
		() => previewIndex.value >= 0 && previewIndex.value < previewable.value.length - 1,
	)

	function stepPreview(step: 1 | -1) {
		const next = previewable.value[previewIndex.value + step]
		if (previewIndex.value >= 0 && next) void showPreview(next)
	}

	const viewUrl = useCall<ViewUrlResponse, { asset_name: string }>({
		url: '/api/v2/method/vms.api.get_view_url',
		method: 'POST',
		immediate: false,
	})
	const moveAssetsCall = useCall<unknown, { asset_names: string; folder: string | null }>({
		url: '/api/v2/method/vms.api.move_assets_to_folder',
		method: 'POST',
		immediate: false,
	})
	const moveFolderCall = useCall<unknown, { folder_name_id: string; parent_folder: string | null }>(
		{
			url: '/api/v2/method/vms.api.move_folder',
			method: 'POST',
			immediate: false,
		},
	)
	const deleteFolderCall = useCall<unknown, { folder_name: string }>({
		url: '/api/v2/method/vms.api.delete_folder',
		method: 'POST',
		immediate: false,
	})
	const restoreFolderCall = useCall<unknown, { folder_name: string }>({
		url: '/api/v2/method/vms.api.restore_folder',
		method: 'POST',
		immediate: false,
	})

	async function moveAssets(names: string[], target: string | null) {
		if (!names.length) return
		try {
			await moveAssetsCall.submit({ asset_names: JSON.stringify(names), folder: target })
			selection.value = []
			toast.success(`Moved ${names.length} asset${names.length === 1 ? '' : 's'}`)
			await reloadAssets()
		} catch (error) {
			toast.error(serverMessage(error) || 'Could not move assets')
		}
	}

	async function moveFolder(name: string, parent: string | null) {
		const source = allFolders.value.find((folder) => folder.name === name)
		if (!source || (source.parent_folder || null) === parent) return
		try {
			await moveFolderCall.submit({ folder_name_id: name, parent_folder: parent })
			toast.success(`Moved “${source.folder_name}”`)
			await reloadAll()
		} catch (error) {
			toast.error(serverMessage(error) || 'Could not move folder')
		}
	}

	function deleteFolder(folder: Folder) {
		dialog.danger({
			title: 'Move folder to Trash?',
			message: `“${folder.folder_name}” and everything inside it will move to Trash.`,
			confirmLabel: 'Move to Trash',
			onConfirm: async () => {
				try {
					await deleteFolderCall.submit({ folder_name: folder.name })
					if (folder.name === currentFolder.value) {
						const route = folder.parent_folder
							? `/projects/${currentProject.value}/folder/${folder.parent_folder}`
							: `/projects/${currentProject.value}`
						await router.replace(route)
					}
					await reloadAll()
					toast.success('Folder moved to Trash', {
						action: {
							label: 'Undo',
							onClick: async () => {
								await restoreFolderCall.submit({ folder_name: folder.name })
								await reloadAll()
								toast.success('Folder restored')
							},
						},
					})
				} catch (error) {
					toast.error(serverMessage(error) || 'Could not delete folder')
				}
			},
		})
	}

	function configurePolling(active: boolean) {
		clearInterval(pollTimer)
		if (!active) return
		pollTimer = setInterval(() => void reloadAssets(), 5000)
	}

	function resetList() {
		limit.value = PAGE_SIZE
		selection.value = []
	}

	return {
		project,
		folders,
		assetsCall,
		assets,
		total,
		allFolders,
		currentFolder,
		currentFolderDoc,
		trail,
		folderNotFound,
		visibleFolders,
		folderPaths,
		folderCounts,
		selectedAssets,
		hasMore,
		searchInput,
		category,
		tag,
		sort,
		selection,
		view,
		preview,
		hasPreviousPreview,
		hasNextPreview,
		showPreviousPreview: () => stepPreview(-1),
		showNextPreview: () => stepPreview(1),
		limit,
		openAsset,
		moveAssets,
		moveFolder,
		deleteFolder,
		reloadAssets,
		reloadAll,
		loadMore: () => (limit.value += PAGE_SIZE),
	}
}

function storedView(): 'grid' | 'list' {
	return localStorage.getItem('vms_asset_view') === 'list' ? 'list' : 'grid'
}

function buildTrail(folders: Folder[], current: Folder | null): Folder[] {
	if (!current) return []
	const byName = new Map(folders.map((folder) => [folder.name, folder]))
	const trail: Folder[] = []
	let node: Folder | undefined = current
	while (node && trail.length < 50) {
		trail.unshift(node)
		node = node.parent_folder ? byName.get(node.parent_folder) : undefined
	}
	return trail
}
