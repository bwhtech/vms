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
		<!-- KPI strip -->
		<dl class="grid grid-cols-2 sm:grid-cols-4" data-testid="dashboard-kpis">
			<div
				v-for="(kpi, index) in kpis"
				:key="kpi.label"
				:class="[
					'px-3 py-3 first:pl-0 sm:px-4 sm:py-2',
					index % 2 === 1 && 'border-l border-outline-gray-2',
					index > 0 && 'sm:border-l sm:border-outline-gray-2',
				]"
			>
				<dt class="text-sm text-ink-gray-5">{{ kpi.label }}</dt>
				<dd class="mt-1">
					<LoadingText v-if="kpi.value === null" class="w-12" />
					<RouterLink
						v-else-if="kpi.to"
						:to="kpi.to"
						class="text-2xl text-ink-gray-9 hover:underline"
					>
						{{ kpi.value }}
					</RouterLink>
					<span v-else class="text-2xl text-ink-gray-9">{{ kpi.value }}</span>
				</dd>
				<Progress v-if="kpi.progress !== undefined" :value="kpi.progress" class="mt-2" />
				<p v-if="kpi.hint" class="mt-0.5 text-xs text-ink-gray-5">{{ kpi.hint }}</p>
			</div>
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
				<LoadingText v-if="projects.loading && !recentProjects.length" :lines="2" />
				<ErrorMessage v-else-if="projects.error" :message="projects.error" />
				<p v-else-if="!recentProjects.length" class="text-sm text-ink-gray-5">
					No projects yet.
				</p>
				<div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<RouterLink
						v-for="project in recentProjects"
						:key="project.name"
						:to="`/projects/${project.name}`"
						class="flex flex-col gap-2 rounded border border-outline-gray-1 p-3 transition-colors hover:bg-surface-gray-1"
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
				<LoadingText v-if="assets.loading && !recentAssets.length" :lines="3" />
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
								<div
									class="flex h-6 w-10 items-center justify-center overflow-hidden rounded bg-surface-gray-2"
								>
									<img
										v-if="item.thumbnail_url"
										:src="item.thumbnail_url"
										:alt="item.file_name"
										class="size-full object-cover"
									/>
									<span
										v-else
										:class="[
											fileIcon(item.file_type),
											'size-3.5 text-ink-gray-5',
										]"
										aria-hidden="true"
									/>
								</div>
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
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	Progress,
	useCall,
	useList,
	usePageMeta,
} from 'frappe-ui'
import { List, ListCell, ListRow, ListRows } from 'frappe-ui/list'
import type { Asset, Project, ProjectStatus } from '@/types'
import { formatBytes } from '@/lib/format'
import { assetStatusTheme, type BadgeTheme } from '@/lib/status'
import { useOverlays } from '@/composables/useOverlays'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'

usePageMeta(() => ({ title: 'Home · VMS' }))

const { openUpload, createProjectOpen } = useOverlays()

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

// Throws when Cloudflare is not configured; the tile then shows a dash. R2
// buckets have no quota, so the tile carries the object count, not a bar.
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

const kpis = computed(() => [
	{ label: 'Assets', value: countValue(assetCount) },
	{ label: 'Projects', value: countValue(projectCount), to: '/projects' },
	{ label: 'Uncategorised', value: countValue(uncategorisedCount), to: '/uncategorised' },
	{
		label: 'Storage used',
		value: storageValue.value,
		progress: 0,
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

function fileIcon(fileType?: string): string {
	if (fileType?.startsWith('video/')) return 'lucide-film'
	if (fileType?.startsWith('image/')) return 'lucide-image'
	if (fileType?.startsWith('audio/')) return 'lucide-music'
	return 'lucide-file'
}
</script>
