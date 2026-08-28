<template>
	<SidePanel v-model:open="review.panels.versions.value" title="Version history">
		<div class="space-y-4 p-4">
			<Button
				class="w-full"
				variant="outline"
				icon-left="lucide-upload"
				label="Upload new version"
				:loading="uploading"
				:disabled="restoringVersion !== null"
				@click="uploadVersion"
			/>
			<Progress v-if="uploading" :value="progress" size="md" hint />

			<div v-if="versions.loading" class="grid place-items-center py-12">
				<LoadingIndicator class="text-ink-gray-5" />
			</div>
			<div
				v-else-if="versions.error"
				class="rounded bg-surface-red-1 p-3 text-p-sm text-ink-red-6"
			>
				<p>Version history could not be loaded.</p>
				<Button class="mt-2" label="Try again" @click="versions.reload" />
			</div>
			<p v-else-if="allVersions.length === 0" class="py-10 text-center text-p-sm text-ink-gray-5">
				No versions found.
			</p>
			<template v-else>
				<p class="text-p-sm text-ink-gray-5">
					{{ totalVersions }} {{ totalVersions === 1 ? 'version' : 'versions' }}
				</p>
				<List :columns="['minmax(0,1fr)']" divider="none" class="space-y-2">
					<ListRow
						v-for="version in allVersions"
						:key="`${version.version_number}-${version.is_current ? 'current' : 'history'}`"
						:value="String(version.version_number)"
						class="rounded border border-outline-gray-2"
					>
						<ListCell class="p-3">
							<div class="flex min-w-0 flex-1 items-start gap-3">
								<img
									v-if="version.thumbnail_url"
									:src="version.thumbnail_url"
									alt=""
									class="size-10 shrink-0 rounded object-cover"
								/>
								<div v-else class="grid size-10 shrink-0 place-items-center rounded bg-surface-gray-2">
									<span class="lucide-file size-4 text-ink-gray-5" aria-hidden="true" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="text-base-medium text-ink-gray-8">v{{ version.version_number }}</span>
										<Badge v-if="version.is_current" label="Current" theme="green" />
									</div>
									<p class="mt-1 truncate text-sm text-ink-gray-6">{{ version.file_name }}</p>
									<p class="mt-1 text-p-xs text-ink-gray-5">
										{{ version.uploader_name || version.uploaded_by }}
										<span v-if="version.file_size"> · {{ formatBytes(version.file_size) }}</span>
									</p>
									<p v-if="version.uploaded_at" class="mt-1 text-p-xs text-ink-gray-5">
										{{ formatDate(version.uploaded_at) }}
									</p>
								</div>
								<div class="flex shrink-0 gap-1">
									<Button
										variant="ghost"
										icon="lucide-download"
										:aria-label="`Download v${version.version_number}`"
										:loading="downloadingVersion === version.version_number"
										@click="downloadVersion(version)"
									/>
									<Button
										v-if="!version.is_current"
										variant="ghost"
										icon="lucide-rotate-ccw"
										:aria-label="`Restore v${version.version_number}`"
										:loading="restoringVersion === version.version_number"
										@click="confirmRestore(version)"
									/>
								</div>
							</div>
						</ListCell>
					</ListRow>
				</List>
			</template>
		</div>
	</SidePanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Badge, Button, LoadingIndicator, Progress, dialog, toast, useCall } from 'frappe-ui'
import { List, ListCell, ListRow } from 'frappe-ui/list'
import SidePanel from '@/components/common/SidePanel.vue'
import { useReview } from '@/composables/useReview'
import { useVersionUpload } from '@/composables/useVersionUpload'
import { formatBytes } from '@/lib/format'
import type { AssetVersion, AssetVersionsResponse, ViewUrlResponse } from '@/types'

const review = useReview()
const assetName = review.asset.value?.name ?? ''
const { uploadNewVersion, uploading, progress } = useVersionUpload()
const downloadingVersion = ref<number | null>(null)
const restoringVersion = ref<number | null>(null)

const versions = useCall<AssetVersionsResponse, { asset_name: string }>({
	url: '/api/v2/method/vms.api.get_asset_versions',
	method: 'GET',
	params: { asset_name: assetName },
	cacheKey: ['asset-versions', assetName],
})
const download = useCall<ViewUrlResponse, { asset_name: string; version_number: number }>({
	url: '/api/v2/method/vms.api.get_version_download_url',
	method: 'POST',
	immediate: false,
})
const restore = useCall<unknown, { asset_name: string; version_number: number }>({
	url: '/api/v2/method/vms.api.restore_version',
	method: 'POST',
	immediate: false,
})

const allVersions = computed(() => {
	if (!versions.data) return []
	return [versions.data.current, ...versions.data.versions]
})
const totalVersions = computed(() => versions.data?.total_versions ?? allVersions.value.length)

watch(
	() => review.panels.versions.value,
	(open) => {
		if (open) void versions.reload()
	},
)

async function uploadVersion() {
	try {
		await uploadNewVersion(assetName)
		await versions.reload()
		review.reload()
		toast.success('New version uploaded')
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not upload the new version')
	}
}

async function downloadVersion(version: AssetVersion) {
	downloadingVersion.value = version.version_number
	try {
		const result = await download.submit({
			asset_name: assetName,
			version_number: version.version_number,
		})
		if (!result?.url) throw new Error('A download link was not returned')
		const link = document.createElement('a')
		link.href = result.url
		link.download = version.file_name
		document.body.appendChild(link)
		link.click()
		link.remove()
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not download this version')
	} finally {
		downloadingVersion.value = null
	}
}

function confirmRestore(version: AssetVersion) {
	dialog.confirm({
		title: `Restore v${version.version_number}?`,
		message: `${version.file_name} will become the current file. The current file stays in version history.`,
		confirmLabel: 'Restore',
		onConfirm: async () => {
			restoringVersion.value = version.version_number
			try {
				await restore.submit({ asset_name: assetName, version_number: version.version_number })
				await versions.reload()
				review.reload()
				toast.success(`Restored v${version.version_number}`)
			} finally {
				restoringVersion.value = null
			}
		},
	})
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}
</script>
