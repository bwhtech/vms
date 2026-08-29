<template>
	<Dialog :open="uploadOpen" size="lg" :show-close-button="false" @update:open="handleOpenChange">
		<template #title>
			<div class="flex min-w-0 items-start justify-between gap-3">
				<div class="min-w-0">
					<h3
						class="text-2xl-semibold leading-6 text-ink-gray-8"
						data-testid="upload-title"
					>
						{{ isVersionMode ? 'Upload New Version' : 'Upload Assets' }}
					</h3>
					<p class="mt-1.5 text-p-sm text-ink-gray-5">{{ description }}</p>
				</div>
				<Button
					variant="ghost"
					:icon="active > 0 ? 'lucide-minus' : 'lucide-x'"
					:aria-label="active > 0 ? 'Minimize uploads' : 'Close upload dialog'"
					@click="requestClose"
				/>
			</div>
		</template>

		<div class="space-y-4">
			<div
				v-if="isVersionMode"
				class="flex items-center gap-3 rounded-4 border border-outline-gray-2 bg-surface-gray-1 p-3"
			>
				<div class="grid size-10 shrink-0 place-items-center rounded-4 bg-surface-gray-2">
					<span class="lucide-file-video size-5 text-ink-gray-5" aria-hidden="true" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-base-medium text-ink-gray-8">
						{{ versionAsset.doc?.file_name || versionTarget }}
					</p>
					<p class="mt-1 text-sm text-ink-gray-5">
						v{{ versionAsset.doc?.version || 1 }} → v{{
							(versionAsset.doc?.version || 1) + 1
						}}
					</p>
				</div>
			</div>

			<UploadLocationFields
				v-else
				v-model:project="selectedProject"
				v-model:folder="selectedFolder"
				v-model:category="category"
				:has-queued-files="items.length > 0"
			/>

			<UploadDropArea
				:singular="isVersionMode"
				:disabled="isVersionMode && versionQueued"
				@files="queueFiles"
			/>

			<List
				v-if="items.length > 0"
				class="space-y-2"
				:columns="['minmax(0,1fr)']"
				divider="none"
				aria-live="polite"
			>
				<ListRow v-for="item in items" :key="item.id" :value="item.id">
					<UploadFileRow :item="item" @cancel="cancel" @retry="retry" />
				</ListRow>
			</List>

			<div
				v-if="reportMessage"
				class="flex items-center gap-2 rounded-4 bg-surface-gray-1 px-3 py-2 text-p-sm text-ink-gray-6"
			>
				<span class="size-4" :class="reportIcon" aria-hidden="true" />
				<span>{{ reportMessage }}</span>
			</div>
		</div>

		<template #actions>
			<div class="flex w-full justify-between gap-2">
				<p class="self-center text-sm text-ink-gray-5">{{ summary }}</p>
				<Button
					v-if="active > 0"
					variant="solid"
					label="Run in background"
					@click="minimize"
				/>
				<Button v-else-if="items.length > 0" variant="solid" label="Done" @click="finish" />
				<Button v-else label="Cancel" @click="requestClose" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, useDoc } from 'frappe-ui'
import { List, ListRow } from 'frappe-ui/list'

import UploadDropArea from '@/components/upload/UploadDropArea.vue'
import UploadFileRow from '@/components/upload/UploadFileRow.vue'
import UploadLocationFields from '@/components/upload/UploadLocationFields.vue'
import { useOverlays } from '@/composables/useOverlays'
import { useUploadQueue } from '@/composables/useUploadQueue'
import type { Asset, UploadContext } from '@/types'

const { uploadOpen, uploadContext } = useOverlays()
const { items, add, cancel, retry, clearDone, active, counts, reportStatus } = useUploadQueue()

const selectedProject = ref('')
const selectedFolder = ref('')
const category = ref('Footage')
const versionQueued = ref(false)

const versionTarget = computed(() => uploadContext.value.versionOf ?? '')
const isVersionMode = computed(() => Boolean(versionTarget.value))

const versionAsset = useDoc<Pick<Asset, 'name' | 'file_name' | 'version'>>({
	doctype: 'VMS Asset',
	name: versionTarget,
})

const description = computed(() => {
	if (isVersionMode.value) return 'Replace the current file with a new version.'
	return selectedProject.value
		? 'Upload files to this project.'
		: 'Upload files without a project.'
})

const summary = computed(() => {
	if (items.value.length === 0) return 'No files selected'
	if (active.value > 0) return `${counts.value.done} of ${counts.value.total} uploaded`
	const failed = counts.value.error ? ` · ${counts.value.error} failed` : ''
	const cancelled = counts.value.cancelled ? ` · ${counts.value.cancelled} cancelled` : ''
	return `${counts.value.done} uploaded${failed}${cancelled}`
})

const reportMessage = computed(() => {
	if (counts.value.total < 2) return ''
	if (reportStatus.value === 'sending') return 'Sending your upload report…'
	if (reportStatus.value === 'sent') return 'An upload report was emailed to you.'
	if (reportStatus.value === 'error')
		return 'The files finished, but the upload report could not be sent.'
	return ''
})

const reportIcon = computed(() =>
	reportStatus.value === 'error'
		? 'lucide-circle-alert text-ink-red-6'
		: 'lucide-mail-check text-ink-gray-5',
)

watch(
	uploadContext,
	(context) => {
		selectedProject.value = context.project ?? ''
		selectedFolder.value = context.folder ?? ''
		category.value = context.category ?? 'Footage'
		versionQueued.value = false
		// Pasted files arrive with the context, so they queue without a trip
		// through the drop area.
		if (context.files?.length) queueFiles(context.files)
	},
	{ immediate: true },
)

watch(
	selectedProject,
	() => {
		selectedFolder.value = ''
	},
	{ flush: 'sync' },
)

function queueFiles(files: File[]): void {
	if (files.length === 0 || (isVersionMode.value && versionQueued.value)) return
	const context: UploadContext = {
		project: selectedProject.value || undefined,
		folder: selectedFolder.value || undefined,
		category: category.value,
		versionOf: versionTarget.value || undefined,
		onDone: uploadContext.value.onDone,
	}
	add(isVersionMode.value ? files.slice(0, 1) : files, context)
	if (isVersionMode.value) versionQueued.value = true
}

function handleOpenChange(open: boolean): void {
	if (open) uploadOpen.value = true
	else requestClose()
}

function requestClose(): void {
	if (active.value > 0) {
		minimize()
		return
	}
	finish()
}

function minimize(): void {
	uploadOpen.value = false
}

function finish(): void {
	clearDone()
	uploadOpen.value = false
	uploadContext.value = {}
	versionQueued.value = false
}
</script>
