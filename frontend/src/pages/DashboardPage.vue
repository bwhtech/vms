<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">Home</h1>
		</PageHeaderTitle>
		<div class="flex items-center gap-2">
			<Button
				label="New project"
				icon-left="lucide-plus"
				data-testid="dashboard-new-project"
				@click="createProjectOpen = true"
			/>
			<Button
				variant="solid"
				label="Upload"
				icon-left="lucide-upload"
				data-testid="dashboard-upload"
				@click="openUpload()"
			/>
		</div>
	</PageHeader>

	<div class="mx-auto max-w-4xl space-y-6 px-3 py-5 pb-10 sm:px-5" data-testid="dashboard">
		<!-- Number cards -->
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="dashboard-kpis">
			<component
				:is="kpi.to ? RouterLink : 'div'"
				v-for="kpi in kpis"
				:key="kpi.label"
				:to="kpi.to"
				:class="[
					'flex flex-col gap-1 rounded-5 border border-outline-gray-1 bg-surface-base p-4',
					kpi.to && 'transition hover:border-outline-gray-2 hover:bg-surface-gray-1',
				]"
			>
				<dt class="flex items-center gap-1.5 text-sm text-ink-gray-5">
					<span :class="[kpi.icon, 'size-4']" aria-hidden="true" />
					{{ kpi.label }}
				</dt>
				<dd class="text-2xl-semibold text-ink-gray-9">
					<Skeleton v-if="kpi.value === null" class="mt-1 h-6 w-12 rounded-4" />
					<template v-else>{{ kpi.value }}</template>
				</dd>
				<p v-if="kpi.hint" class="text-xs text-ink-gray-5">{{ kpi.hint }}</p>
			</component>
		</dl>

		<EmptyState
			v-if="showEmptyState"
			icon="lucide-folder-open"
			title="No projects yet"
			description="Create a project to organise your footage, or upload files to the inbox."
			data-testid="dashboard-empty"
		>
			<template #actions>
				<Button
					variant="solid"
					label="Create project"
					icon-left="lucide-plus"
					@click="createProjectOpen = true"
				/>
				<Button label="Upload" icon-left="lucide-upload" @click="openUpload()" />
			</template>
		</EmptyState>

		<template v-else>
			<section class="space-y-3" data-testid="dashboard-recent-projects">
				<div class="flex items-center justify-between">
					<h2 class="text-lg-semibold text-ink-gray-8">Recent projects</h2>
					<Button
						variant="ghost"
						label="View all"
						icon-right="lucide-arrow-right"
						route="/projects"
					/>
				</div>
				<SkeletonCards
					v-if="projects.loading && !recentProjects.length"
					:count="4"
					grid-class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
				/>
				<ErrorMessage v-else-if="projects.error" :message="projects.error" />
				<p v-else-if="!recentProjects.length" class="text-sm text-ink-gray-5">
					No projects yet.
				</p>
				<div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<RouterLink
						v-for="project in recentProjects"
						:key="project.name"
						:to="`/projects/${project.name}`"
						class="flex flex-col gap-2 rounded-5 border border-outline-gray-1 bg-surface-base p-3 transition hover:border-outline-gray-2 hover:bg-surface-gray-1"
						data-testid="dashboard-project-card"
					>
						<div class="flex items-start justify-between gap-2">
							<span
								class="lucide-folder size-4 shrink-0 text-ink-gray-5"
								aria-hidden="true"
							/>
							<Badge
								:label="project.status"
								:theme="projectStatusTheme(project.status)"
							/>
						</div>
						<p class="truncate text-base-medium text-ink-gray-8">
							{{ project.project_name }}
						</p>
						<p class="text-sm text-ink-gray-5">
							Updated <RelativeTime :date="project.modified" />
						</p>
					</RouterLink>
				</div>
			</section>

			<section class="space-y-3" data-testid="dashboard-recent-uploads">
				<div class="flex items-center justify-between">
					<h2 class="text-lg-semibold text-ink-gray-8">Recent uploads</h2>
					<Button
						variant="ghost"
						label="Inbox"
						icon-right="lucide-arrow-right"
						route="/uncategorised"
					/>
				</div>
				<SkeletonRows v-if="assets.loading && !recentAssets.length" :rows="3" />
				<ErrorMessage v-else-if="assets.error" :message="assets.error" />
				<p v-else-if="!recentAssets.length" class="text-sm text-ink-gray-5">
					No uploads yet.
				</p>
				<List v-else class="-mx-3 list-row-px-3">
					<ListRows v-slot="{ item, value }" :items="recentAssets">
						<ListRow
							:value="value"
							:to="item.status === 'Ready' ? `/review/${item.name}` : undefined"
							class="h-15"
							data-testid="dashboard-upload-row"
						>
							<ListCell>
								<FileTypeIcon
									:file-type="item.file_type"
									:thumbnail-url="item.thumbnail_url"
									:alt="item.file_name"
								/>
							</ListCell>
							<ListCell>
								<div class="min-w-0">
									<p class="truncate text-base text-ink-gray-8">
										{{ item.file_name }}
									</p>
									<p class="mt-1 truncate text-sm text-ink-gray-5">
										{{ item.project_name || 'Uncategorised' }} ·
										<RelativeTime :date="item.creation" />
									</p>
								</div>
							</ListCell>
							<ListCell class="w-20 justify-end">
								<Badge
									:label="item.status"
									:theme="assetStatusTheme(item.status)"
								/>
							</ListCell>
						</ListRow>
					</ListRows>
				</List>
			</section>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
	Badge,
	Button,
	ErrorMessage,
	PageHeader,
	PageHeaderTitle,
	Skeleton,
	useCall,
	useList,
	usePageMeta,
} from 'frappe-ui'
import { List, ListCell, ListRow, ListRows } from 'frappe-ui/list'
import type { Asset, Project, ProjectStatus } from '@/types'
import { formatBytes } from '@/lib/format'
import { assetStatusTheme, type BadgeTheme } from '@/lib/status'
import { useOverlays } from '@/composables/useOverlays'
import { useUploadTarget } from '@/composables/usePasteUpload'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import FileTypeIcon from '@/components/common/FileTypeIcon.vue'
import SkeletonRows from '@/components/common/SkeletonRows.vue'
import SkeletonCards from '@/components/common/SkeletonCards.vue'

usePageMeta(() => ({ title: 'Home · VMS' }))

const { openUpload, createProjectOpen } = useOverlays()
useUploadTarget(() => ({ onDone: () => void assets.reload() }))

type RecentProject = Pick<Project, 'name' | 'project_name' | 'status' | 'modified'>
type RecentAsset = Pick<
	Asset,
	'name' | 'file_name' | 'status' | 'file_type' | 'thumbnail_url' | 'project' | 'creation'
> & { project_name?: string }

const projects = useList<RecentProject>({
	doctype: 'VMS Project',
	fields: ['name', 'project_name', 'status', 'modified'],
	orderBy: 'modified desc',
	limit: 4,
	cacheKey: 'dashboard-recent-projects',
})

const assets = useList<RecentAsset>({
	doctype: 'VMS Asset',
	fields: [
		'name',
		'file_name',
		'status',
		'file_type',
		'thumbnail_url',
		'project',
		'project.project_name as project_name',
		'creation',
	],
	filters: { status: ['!=', 'Uploading'], deleted_at: ['is', 'not set'] },
	orderBy: 'creation desc',
	limit: 8,
	cacheKey: 'dashboard-recent-assets',
})

const recentProjects = computed(() => projects.data ?? [])
const recentAssets = computed(() => assets.data ?? [])
const showEmptyState = computed(
	() => projects.isFinished && !projects.error && !recentProjects.value.length,
)

interface CountParams {
	doctype: string
	filters: string
}

function useCount(doctype: string, filters: Record<string, unknown>, key: string) {
	return useCall<number, CountParams>({
		url: '/api/v2/method/frappe.client.get_count',
		method: 'GET',
		params: { doctype, filters: JSON.stringify(filters) },
		cacheKey: ['dashboard-count', key],
	})
}

const assetCount = useCount(
	'VMS Asset',
	{ status: ['!=', 'Uploading'], deleted_at: ['is', 'not set'] },
	'assets',
)
const projectCount = useCount('VMS Project', {}, 'projects')
const uncategorisedCount = useCount(
	'VMS Asset',
	{ project: ['is', 'not set'], status: ['!=', 'Uploading'], deleted_at: ['is', 'not set'] },
	'uncategorised',
)

interface BucketUsage {
	payload_size: number
	object_count: number
	metadata_size: number
}

// Throws when Cloudflare is not configured; the card then shows a dash. R2
// buckets have no quota, so the card carries the object count, not a bar.
const bucketUsage = useCall<BucketUsage>({
	url: '/api/v2/method/vms.api.get_bucket_usage',
	method: 'GET',
	cacheKey: 'dashboard-bucket-usage',
})

const storageValue = computed(() => {
	if (bucketUsage.data) return formatBytes(bucketUsage.data.payload_size)
	if (bucketUsage.error) return '—'
	return null
})

const countValue = (resource: { data: number | null; error: unknown }) =>
	resource.error ? '—' : (resource.data ?? null)

interface Kpi {
	label: string
	icon: string
	value: string | number | null
	to?: string
	hint?: string
}

const kpis = computed<Kpi[]>(() => [
	{ label: 'Assets', icon: 'lucide-film', value: countValue(assetCount) },
	{ label: 'Projects', icon: 'lucide-folder', value: countValue(projectCount), to: '/projects' },
	{
		label: 'Uncategorised',
		icon: 'lucide-inbox',
		value: countValue(uncategorisedCount),
		to: '/uncategorised',
	},
	{
		label: 'Storage used',
		icon: 'lucide-hard-drive',
		value: storageValue.value,
		hint: bucketUsage.data
			? `${bucketUsage.data.object_count.toLocaleString()} objects`
			: bucketUsage.error
				? 'Usage unavailable'
				: '',
	},
])

const PROJECT_STATUS_THEME: Record<ProjectStatus, BadgeTheme> = {
	Open: 'gray',
	'In Progress': 'blue',
	'In Review': 'amber',
	Completed: 'green',
	Archived: 'gray',
}

function projectStatusTheme(status: ProjectStatus): BadgeTheme {
	return PROJECT_STATUS_THEME[status] ?? 'gray'
}
</script>
