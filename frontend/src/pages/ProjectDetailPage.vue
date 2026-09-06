<template>
	<PageHeader>
		<div class="flex min-w-0 items-center gap-2">
			<!-- The project's own mark leads the header and doubles as the
			     identity picker's trigger. -->
			<IdentityPicker
				v-if="project.doc"
				:icon="project.doc.icon ?? ''"
				:color="identityColor"
				:avatar="storedAvatarValue(project.doc)"
				@update:icon="saveIdentity({ icon: $event })"
				@update:color="saveIdentity({ color: $event })"
				@update:avatar="saveIdentity({ avatar: $event })"
			>
				<button
					type="button"
					class="flex shrink-0 rounded-[6px] ring-outline-gray-3 hover:ring-2"
					aria-label="Project icon and color"
					data-testid="project-icon-trigger"
				>
					<IdentityAvatar
						:name="project.doc.name"
						:icon="project.doc.icon"
						:color="project.doc.color"
						:avatar="project.doc.avatar"
						size="lg"
						hide-tooltip
					/>
				</button>
			</IdentityPicker>
			<FolderBreadcrumbs
				v-if="project.doc"
				:project="projectId"
				:project-name="project.doc.project_name"
				:trail="trail"
				@drop-assets="moveAssets"
				@drop-folder="moveFolder"
			/>
			<PageHeaderTitle v-else><h1 class="truncate">Project</h1></PageHeaderTitle>
			<Dropdown
				v-if="project.doc"
				:options="currentFolderDoc ? folderActions : projectActions"
				align="end"
			>
				<Button
					variant="ghost"
					icon="lucide-ellipsis"
					:aria-label="currentFolderDoc ? 'Folder actions' : 'Project actions'"
				/>
			</Dropdown>
		</div>
		<!-- One right-hand group: `Dropdown` declares `inheritAttrs: false`, so a
		     `sm:hidden` on the component itself never reaches the DOM and the
		     mobile trigger used to sit apart from the actions at every width. -->
		<div class="flex shrink-0 items-center gap-2">
			<div class="hidden items-center gap-2 sm:flex">
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
			<div class="sm:hidden">
				<Dropdown :options="mobileActions" align="end">
					<Button
						variant="ghost"
						icon="lucide-ellipsis-vertical"
						aria-label="Project browser actions"
					/>
				</Dropdown>
			</div>
		</div>
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
			<SkeletonLines :lines="2" />
			<SkeletonCards :count="6" media />
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
			<SkeletonCards v-if="assetsCall.loading && !assets.length" :count="6" media />
			<ErrorMessage
				v-else-if="assetsCall.error && !assets.length"
				:message="assetsCall.error.message"
			/>
			<template v-else-if="assets.length || visibleFolders.length">
				<template v-if="view === 'grid'">
					<template v-if="visibleFolders.length">
						<div class="mb-3 text-sm-medium text-ink-gray-5">Folders</div>
						<div
							class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
						>
							<FolderCard
								v-for="folder in visibleFolders"
								:key="folder.name"
								:folder="folder"
								:project="projectId"
								:item-count="folderCounts.get(folder.name) ?? 0"
								draggable
								@rename="openRenameFolder"
								@move="openMoveFolder"
								@share="openShareFolder"
								@delete="deleteFolder"
								@drop-assets="(names, target) => moveAssets(names, target)"
								@drop-folder="(name, target) => moveFolder(name, target)"
							/>
						</div>
					</template>
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
					@share-folder="openShareFolder"
					@delete-folder="deleteFolder"
					@drop-assets="(names, target) => moveAssets(names, target)"
					@drop-folder="(name, target) => moveFolder(name, target)"
				/>
				<div v-if="hasMore" ref="sentinel" class="pt-3">
					<SkeletonCards v-if="loadingMore && view === 'grid'" :count="4" media />
					<SkeletonLines v-else-if="loadingMore" :lines="3" />
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
	<ShareFolderPanel
		v-if="shareFolderTarget"
		v-model:open="shareFolderOpen"
		:folder="shareFolderTarget"
		@changed="reloadAll"
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
		:has-previous="hasPreviousPreview"
		:has-next="hasNextPreview"
		@previous="showPreviousPreview"
		@next="showNextPreview"
		@update:open="preview = null"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
	Button,
	Dropdown,
	ErrorMessage,
	PageHeader,
	PageHeaderTitle,
	toast,
	usePageMeta,
} from 'frappe-ui'
import AssetGrid from '@/components/assets/AssetGrid.vue'
import AssetList from '@/components/assets/AssetList.vue'
import BulkActionBar from '@/components/assets/BulkActionBar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MediaPreviewDialog from '@/components/common/MediaPreviewDialog.vue'
import CreateFolderDialog from '@/components/folders/CreateFolderDialog.vue'
import FolderBreadcrumbs from '@/components/folders/FolderBreadcrumbs.vue'
import FolderCard from '@/components/folders/FolderCard.vue'
import MoveFolderDialog from '@/components/folders/MoveFolderDialog.vue'
import MoveToFolderDialog from '@/components/folders/MoveToFolderDialog.vue'
import RenameFolderDialog from '@/components/folders/RenameFolderDialog.vue'
import ShareFolderPanel from '@/components/folders/ShareFolderPanel.vue'
import ProjectBrowserToolbar from '@/components/projects/ProjectBrowserToolbar.vue'
import ProjectSettingsDialog from '@/components/projects/ProjectSettingsDialog.vue'
import IdentityAvatar from '@/components/common/IdentityAvatar.vue'
import IdentityPicker from '@/components/common/IdentityPicker.vue'
import type { ProjectAvatarValue } from '@/lib/dicebear'
import { identityPatch, storedAvatarValue, type ProjectColor } from '@/lib/project'
import { serverMessage } from '@/lib/format'
import ShareProjectPanel from '@/components/projects/ShareProjectPanel.vue'
import { useProjectBrowser } from '@/components/projects/useProjectBrowser'
import { useProjectPageActions } from '@/components/projects/useProjectPageActions'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useUploadTarget } from '@/composables/usePasteUpload'
import SkeletonLines from '@/components/common/SkeletonLines.vue'
import SkeletonCards from '@/components/common/SkeletonCards.vue'

const props = defineProps<{
	projectId: string
	folderId?: string
}>()

const browser = useProjectBrowser(
	() => props.projectId,
	() => props.folderId,
)
// A paste on this page lands in the project and folder being browsed.
useUploadTarget(() => ({
	project: props.projectId,
	folder: props.folderId,
	onDone: () => void browser.reloadAssets(),
}))
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
	loadingMore,
	searchInput,
	category,
	tag,
	sort,
	selection,
	view,
	preview,
	hasPreviousPreview,
	hasNextPreview,
	showPreviousPreview,
	showNextPreview,
	openAsset,
	moveAssets,
	moveFolder,
	deleteFolder,
	reloadAssets,
	reloadAll,
	loadMore,
} = browser

const sentinel = ref<HTMLElement | null>(null)
useInfiniteScroll(sentinel, loadingMore, () => hasMore.value, loadMore)
const {
	createFolderOpen,
	renameFolderOpen,
	moveFolderOpen,
	moveAssetsOpen,
	shareOpen,
	shareFolderOpen,
	settingsOpen,
	folderAction,
	shareFolderTarget,
	plainDescription,
	projectActions,
	folderActions,
	mobileActions,
	openProjectUpload,
	openFolder,
	openRenameFolder,
	openMoveFolder,
	openShareFolder,
	handleFolderMoved,
	handleAssetsMoved,
	saveProject,
} = useProjectPageActions(() => props.projectId, browser)

/**
 * An identity is six fields that must move together: switching to an icon has
 * to clear the avatar, and an avatar has to carry its style, seed and options
 * or it can never be rolled again — so every change writes the full patch.
 */
const identityColor = computed<ProjectColor | ''>(
	() => (project.doc?.color ?? '') as ProjectColor | '',
)

function saveIdentity(change: {
	icon?: string
	color?: ProjectColor | ''
	avatar?: ProjectAvatarValue | null
}) {
	if (!project.doc) return
	const current = storedAvatarValue(project.doc)
	const patch = identityPatch(
		change.icon ?? project.doc.icon ?? '',
		change.color ?? identityColor.value,
		'avatar' in change ? (change.avatar ?? null) : current,
	)
	// No success toast: the mark updates in place, and a colour swatch or an
	// avatar shuffle is a repeated tweak — one toast per click is noise.
	project.setValue.submit(patch).catch((error: unknown) => {
		toast.error(serverMessage(error) || 'Could not update project')
	})
}

usePageMeta(() => ({ title: `${project.doc?.project_name ?? props.projectId} · VMS` }))
</script>
