<template>
	<PageHeader>
		<div class="flex min-w-0 items-center gap-1">
			<FolderBreadcrumbs
				v-if="project.doc"
				:project="projectId"
				:project-name="project.doc.project_name"
				:trail="trail"
				@drop-assets="moveAssets"
				@drop-folder="moveFolder"
			/>
			<PageHeaderTitle v-else><h1 class="truncate">Project</h1></PageHeaderTitle>
			<Dropdown v-if="project.doc" :options="projectActions" align="end">
				<Button variant="ghost" icon="lucide-ellipsis" aria-label="Project actions" />
			</Dropdown>
		</div>
		<div class="hidden shrink-0 items-center gap-2 sm:flex">
			<Dropdown v-if="currentFolderDoc" :options="folderActions" align="end">
				<Button variant="subtle" icon="lucide-folder-cog" label="Folder actions" />
			</Dropdown>
			<Button
				label="New folder"
				icon-left="lucide-folder-plus"
				variant="subtle"
				@click="createFolderOpen = true"
			/>
			<Button
				label="Upload"
				icon-left="lucide-upload"
				variant="solid"
				theme="gray"
				@click="openProjectUpload"
			/>
		</div>
		<Dropdown :options="mobileActions" align="end" class="sm:hidden">
			<Button
				variant="ghost"
				icon="lucide-ellipsis-vertical"
				aria-label="Project browser actions"
			/>
		</Dropdown>
	</PageHeader>

	<ProjectBrowserToolbar
		v-model:search="searchInput"
		v-model:tag="tag"
		v-model:category="category"
		v-model:sort="sort"
		v-model:view="view"
		:project="projectId"
		:folder="category ? null : currentFolder"
	/>

	<div class="px-3 py-5 pb-24 sm:px-5">
		<div v-if="project.loading && !project.doc" class="space-y-4">
			<LoadingText :lines="2" />
			<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
				<LoadingText v-for="index in 6" :key="index" :lines="3" />
			</div>
		</div>
		<ErrorMessage v-else-if="project.error" :message="project.error.message" />
		<EmptyState
			v-else-if="folderNotFound"
			icon="lucide-folder-x"
			title="Folder not found"
			description="This folder may have been moved or deleted."
		>
			<template #actions>
				<Button label="Back to project" :route="`/projects/${projectId}`" />
			</template>
		</EmptyState>
		<template v-else>
			<p
				v-if="project.doc?.description && !currentFolder"
				class="mb-5 max-w-[940px] text-p-sm text-ink-gray-6"
			>
				{{ plainDescription }}
			</p>
			<LoadingText v-if="assetsCall.loading && !assetsCall.data" :lines="5" />
			<ErrorMessage
				v-else-if="assetsCall.error && !assetsCall.data"
				:message="assetsCall.error.message"
			/>
			<template v-else-if="assets.length || visibleFolders.length">
				<template v-if="view === 'grid'">
					<List
						v-if="visibleFolders.length"
						:columns="['minmax(0,1fr)', '5rem']"
						:row-height="40"
						class="mb-6"
					>
						<ListGroup label="Folders">
							<FolderRow
								v-for="folder in visibleFolders"
								:key="folder.name"
								:folder="folder"
								:project="projectId"
								:item-count="folderCounts.get(folder.name) ?? 0"
								compact
								draggable
								@rename="openRenameFolder"
								@move="openMoveFolder"
								@delete="deleteFolder"
								@drop-assets="(names, target) => moveAssets(names, target)"
								@drop-folder="(name, target) => moveFolder(name, target)"
							/>
						</ListGroup>
					</List>
					<div v-if="assets.length" class="mb-3 text-sm-medium text-ink-gray-5">
						Files
					</div>
					<AssetGrid
						v-model:selection="selection"
						:assets="assets"
						:folder-paths="folderPaths"
						draggable
						@open="openAsset"
						@open-folder="openFolder"
						@changed="reloadAssets"
					/>
				</template>
				<AssetList
					v-else
					v-model:selection="selection"
					:assets="assets"
					:folders="visibleFolders"
					:project="projectId"
					:sort="sort"
					:folder-counts="folderCounts"
					:folder-paths="folderPaths"
					@update:sort="sort = $event"
					@open="openAsset"
					@open-folder="openFolder"
					@changed="reloadAssets"
					@rename-folder="openRenameFolder"
					@move-folder="openMoveFolder"
					@delete-folder="deleteFolder"
					@drop-assets="(names, target) => moveAssets(names, target)"
					@drop-folder="(name, target) => moveFolder(name, target)"
				/>
				<div v-if="hasMore" class="flex justify-center pt-6">
					<Button
						label="Load more"
						variant="ghost"
						:loading="assetsCall.loading"
						@click="loadMore"
					/>
				</div>
			</template>
			<EmptyState
				v-else
				:icon="searchInput || tag || category ? 'lucide-search-x' : 'lucide-folder-open'"
				:title="searchInput || tag || category ? 'No files found' : 'This folder is empty'"
				:description="
					searchInput || tag || category
						? 'Try changing the current filters.'
						: 'Upload a file or create a folder.'
				"
			>
				<template #actions>
					<Button
						label="New folder"
						icon-left="lucide-folder-plus"
						@click="createFolderOpen = true"
					/>
					<Button label="Upload" icon-left="lucide-upload" @click="openProjectUpload" />
				</template>
			</EmptyState>
		</template>
	</div>

	<BulkActionBar
		:assets="selectedAssets"
		@move="moveAssetsOpen = true"
		@clear="selection = []"
		@changed="reloadAssets"
	/>
	<CreateFolderDialog
		v-model:open="createFolderOpen"
		:project="projectId"
		:parent-folder="currentFolder"
		:parent-name="currentFolderDoc?.folder_name"
		@created="reloadAll"
	/>
	<RenameFolderDialog
		v-if="folderAction"
		v-model:open="renameFolderOpen"
		:folder="folderAction"
		@changed="reloadAll"
	/>
	<MoveFolderDialog
		v-if="folderAction"
		v-model:open="moveFolderOpen"
		:folder="folderAction"
		:source-project="projectId"
		@changed="handleFolderMoved"
	/>
	<MoveToFolderDialog
		v-model:open="moveAssetsOpen"
		:asset-names="selection"
		:folders="allFolders"
		:current-folder="currentFolder"
		@changed="handleAssetsMoved"
	/>
	<ShareProjectPanel
		v-if="project.doc"
		v-model:open="shareOpen"
		:project="project.doc"
		@changed="project.reload"
	/>
	<ProjectSettingsDialog
		v-if="project.doc"
		v-model:open="settingsOpen"
		:project="project.doc"
		@save="saveProject"
	/>
	<MediaPreviewDialog
		v-if="preview"
		:open="true"
		:url="preview.url"
		:name="preview.asset.file_name"
		:mime="preview.asset.file_type ?? 'image/*'"
		@update:open="preview = null"
	/>
</template>

<script setup lang="ts">
import {
	Button,
	Dropdown,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	usePageMeta,
} from 'frappe-ui'
import { List, ListGroup } from 'frappe-ui/list'
import AssetGrid from '@/components/assets/AssetGrid.vue'
import AssetList from '@/components/assets/AssetList.vue'
import BulkActionBar from '@/components/assets/BulkActionBar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MediaPreviewDialog from '@/components/common/MediaPreviewDialog.vue'
import CreateFolderDialog from '@/components/folders/CreateFolderDialog.vue'
import FolderBreadcrumbs from '@/components/folders/FolderBreadcrumbs.vue'
import FolderRow from '@/components/folders/FolderRow.vue'
import MoveFolderDialog from '@/components/folders/MoveFolderDialog.vue'
import MoveToFolderDialog from '@/components/folders/MoveToFolderDialog.vue'
import RenameFolderDialog from '@/components/folders/RenameFolderDialog.vue'
import ProjectBrowserToolbar from '@/components/projects/ProjectBrowserToolbar.vue'
import ProjectSettingsDialog from '@/components/projects/ProjectSettingsDialog.vue'
import ShareProjectPanel from '@/components/projects/ShareProjectPanel.vue'
import { useProjectBrowser } from '@/components/projects/useProjectBrowser'
import { useProjectPageActions } from '@/components/projects/useProjectPageActions'

const props = defineProps<{
	projectId: string
	folderId?: string
}>()

const browser = useProjectBrowser(
	() => props.projectId,
	() => props.folderId,
)
const {
	project,
	assetsCall,
	assets,
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
	openAsset,
	moveAssets,
	moveFolder,
	deleteFolder,
	reloadAssets,
	reloadAll,
	loadMore,
} = browser
const {
	createFolderOpen,
	renameFolderOpen,
	moveFolderOpen,
	moveAssetsOpen,
	shareOpen,
	settingsOpen,
	folderAction,
	plainDescription,
	projectActions,
	folderActions,
	mobileActions,
	openProjectUpload,
	openFolder,
	openRenameFolder,
	openMoveFolder,
	handleFolderMoved,
	handleAssetsMoved,
	saveProject,
} = useProjectPageActions(() => props.projectId, browser)

usePageMeta(() => ({ title: `${project.doc?.project_name ?? props.projectId} · VMS` }))
</script>
