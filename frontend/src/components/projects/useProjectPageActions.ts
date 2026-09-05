import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'
import { useRouter } from 'vue-router'
import { dialog, toast } from 'frappe-ui'
import type { Folder, Project } from '@/types'
import { serverMessage } from '@/lib/format'
import { useOverlays } from '@/composables/useOverlays'
import type { useProjectBrowser } from '@/components/projects/useProjectBrowser'

type ProjectBrowser = ReturnType<typeof useProjectBrowser>

export function useProjectPageActions(
	projectId: MaybeRefOrGetter<string>,
	browser: ProjectBrowser,
) {
	const router = useRouter()
	const { openUpload } = useOverlays()
	const createFolderOpen = ref(false)
	const renameFolderOpen = ref(false)
	const moveFolderOpen = ref(false)
	const moveAssetsOpen = ref(false)
	const shareOpen = ref(false)
	const shareFolderOpen = ref(false)
	const settingsOpen = ref(false)
	const folderAction = ref<Folder | null>(null)
	const shareFolderTarget = ref<Folder | null>(null)

	const plainDescription = computed(() =>
		(browser.project.doc?.description ?? '')
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim(),
	)
	const projectActions = computed(() => [
		{ label: 'Share', icon: 'lucide-share-2', onClick: () => (shareOpen.value = true) },
		{ label: 'Rename', icon: 'lucide-pencil', onClick: renameProject },
		{ label: 'Settings', icon: 'lucide-settings', onClick: () => (settingsOpen.value = true) },
		{
			label: 'Delete',
			icon: 'lucide-trash-2',
			theme: 'red' as const,
			onClick: deleteProject,
		},
	])
	const folderActions = computed(() => [
		{
			label: 'Rename',
			icon: 'lucide-pencil',
			onClick: () =>
				browser.currentFolderDoc.value && openRenameFolder(browser.currentFolderDoc.value),
		},
		{
			label: 'Move',
			icon: 'lucide-folder-input',
			onClick: () =>
				browser.currentFolderDoc.value && openMoveFolder(browser.currentFolderDoc.value),
		},
		{
			label: 'Share',
			icon: 'lucide-share-2',
			onClick: () =>
				browser.currentFolderDoc.value && openShareFolder(browser.currentFolderDoc.value),
		},
		{
			label: 'Delete',
			icon: 'lucide-trash-2',
			theme: 'red' as const,
			onClick: () =>
				browser.currentFolderDoc.value && browser.deleteFolder(browser.currentFolderDoc.value),
		},
	])
	const mobileActions = computed(() => [
		{ label: 'Upload', icon: 'lucide-upload', onClick: openProjectUpload },
		{
			label: 'New folder',
			icon: 'lucide-folder-plus',
			onClick: () => (createFolderOpen.value = true),
		},
		...(browser.currentFolderDoc.value ? folderActions.value : []),
	])

	function openProjectUpload() {
		openUpload({
			project: toValue(projectId),
			folder: browser.currentFolder.value ?? undefined,
			onDone: () => void browser.reloadAssets(),
		})
	}

	function openFolder(name: string) {
		void router.push(`/projects/${toValue(projectId)}/folder/${name}`)
	}

	function openRenameFolder(folder: Folder) {
		folderAction.value = folder
		renameFolderOpen.value = true
	}

	function openMoveFolder(folder: Folder) {
		folderAction.value = folder
		moveFolderOpen.value = true
	}

	function openShareFolder(folder: Folder) {
		shareFolderTarget.value = folder
		shareFolderOpen.value = true
	}

	async function handleFolderMoved(targetProject: string) {
		if (
			folderAction.value?.name === browser.currentFolder.value &&
			targetProject !== toValue(projectId)
		) {
			await router.push(`/projects/${targetProject}/folder/${folderAction.value.name}`)
		} else {
			await browser.reloadAll()
		}
		folderAction.value = null
	}

	async function handleAssetsMoved() {
		browser.selection.value = []
		await browser.reloadAssets()
	}

	function renameProject() {
		if (!browser.project.doc) return
		dialog.prompt({
			title: 'Rename project',
			fields: [
				{
					name: 'name',
					label: 'Project name',
					required: true,
					defaultValue: browser.project.doc.project_name,
				},
			],
			confirmLabel: 'Rename',
			onConfirm: async ({ values }) => {
				await browser.project.setValue.submit({ project_name: String(values.name).trim() })
				toast.success('Project renamed')
			},
		})
	}

	async function saveProject(values: Partial<Project>, close: () => void) {
		try {
			await browser.project.setValue.submit(values)
			toast.success('Project updated')
			close()
		} catch (error) {
			toast.error(serverMessage(error) || 'Could not update project')
		}
	}

	function deleteProject() {
		if (!browser.project.doc) return
		dialog.danger({
			title: 'Delete project?',
			message: `“${browser.project.doc.project_name}” can only be deleted when it contains no assets or folders.`,
			confirmLabel: 'Delete project',
			onConfirm: async () => {
				try {
					await browser.project.delete.submit()
					toast.success('Project deleted')
					await router.push('/projects')
				} catch (error) {
					toast.error(serverMessage(error) || 'Empty the project before deleting it')
				}
			},
		})
	}

	return {
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
	}
}
