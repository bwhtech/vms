<template>
	<PageHeader>
		<PageHeaderTitle>
			<h1 class="truncate">Audit log</h1>
		</PageHeaderTitle>
	</PageHeader>

	<div class="space-y-4 px-3 py-5 pb-10 sm:px-5" data-testid="audit-log">
		<div class="flex flex-wrap items-center gap-2">
			<TextInput v-model="search" placeholder="Search file name" class="w-56">
				<template #prefix><span class="lucide-search size-4" aria-hidden="true" /></template>
			</TextInput>
			<Select v-model="action" :options="actionOptions" placeholder="All actions" class="w-36" />
			<Select v-model="user" :options="userOptions" placeholder="All users" class="w-44" />
			<Select v-model="project" :options="projectOptions" placeholder="All projects" class="w-44" />
			<DateRangePicker v-model="dateRange" placeholder="Any date" />
			<Button v-if="hasFilters" variant="ghost" label="Clear" icon-left="lucide-x" @click="clearFilters" />
			<span class="ml-auto text-sm text-ink-gray-5">{{ total }} entries</span>
		</div>

		<LoadingText v-if="logs.loading && !rows.length" :lines="5" />
		<ErrorMessage v-else-if="logs.error" :message="logs.error" />
		<EmptyState
			v-else-if="!rows.length"
			icon="lucide-clipboard-list"
			title="No audit entries"
			description="Downloads, deletions, restores, and renames will appear here."
		/>
		<List v-else :columns="COLUMNS" class="-mx-3 list-row-px-3" data-testid="audit-list">
			<ListHeader>
				<ListHeaderCell>Action</ListHeaderCell>
				<ListHeaderCellSort
					label="File name"
					:direction="sortDirection('file_name')"
					@click="toggleSort('file_name')"
				/>
				<ListHeaderCell>Project</ListHeaderCell>
				<ListHeaderCell>User</ListHeaderCell>
				<ListHeaderCellSort
					label="Time"
					:direction="sortDirection('timestamp')"
					@click="toggleSort('timestamp')"
				/>
				<ListHeaderCellSort
					label="Size"
					class="justify-end"
					:direction="sortDirection('file_size')"
					@click="toggleSort('file_size')"
				/>
			</ListHeader>
			<ListRows v-slot="{ item, value }" :items="sortedRows">
				<ListRow :value="value" class="h-12" data-testid="audit-row">
					<ListCell><Badge :label="item.action" :theme="actionTheme(item.action)" /></ListCell>
					<ListCell><span class="truncate text-base-medium text-ink-gray-8">{{ item.file_name || item.asset_name }}</span></ListCell>
					<ListCell><span class="truncate text-sm text-ink-gray-6">{{ item.project_name || '—' }}</span></ListCell>
					<ListCell>
						<div class="flex min-w-0 items-center gap-2">
							<UserAvatar :user="{ full_name: item.user_full_name, user_image: item.user_image }" />
							<span class="truncate text-sm text-ink-gray-7">{{ item.user_full_name }}</span>
						</div>
					</ListCell>
					<ListCell><span class="text-sm text-ink-gray-5">{{ formatDateTime(item.timestamp) }}</span></ListCell>
					<ListCell class="justify-end"><span class="text-sm tabular-nums text-ink-gray-6">{{ item.file_size ? formatBytes(item.file_size) : '—' }}</span></ListCell>
				</ListRow>
			</ListRows>
		</List>

		<div v-if="rows.length < total" class="flex justify-center">
			<Button label="Load more" :loading="logs.loading" @click="limit += PAGE_SIZE" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
	Badge,
	Button,
	DateRangePicker,
	ErrorMessage,
	LoadingText,
	PageHeader,
	PageHeaderTitle,
	Select,
	TextInput,
	useCall,
	usePageMeta,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListHeaderCellSort,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import type { AuditAction, AuditLog } from '@/types'
import { formatDateTime } from '@/lib/dates'
import { formatBytes } from '@/lib/format'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

usePageMeta(() => ({ title: 'Audit log · VMS' }))

const PAGE_SIZE = 20
const COLUMNS = ['7rem', 'minmax(10rem,1fr)', '10rem', '11rem', '11rem', '6rem']
const action = ref('')
const user = ref('')
const project = ref('')
const search = ref('')
const dateRange = ref<string[]>([])
const limit = ref(PAGE_SIZE)
const sort = ref<{ field: 'file_name' | 'timestamp' | 'file_size'; direction: 'asc' | 'desc' }>({
	field: 'timestamp',
	direction: 'desc',
})

interface AuditResponse {
	logs: AuditLog[]
	total: number
}
interface AuditParams {
	action?: string
	user?: string
	project?: string
	search?: string
	from_date?: string
	to_date?: string
	page: number
	page_size: number
}
interface FilterResponse {
	users: { value: string; label: string }[]
	projects: { value: string; label: string }[]
}

const filters = useCall<FilterResponse>({
	url: '/api/v2/method/vms.api.get_audit_log_filters',
	method: 'GET',
	cacheKey: 'audit-log-filters',
})
const logs = useCall<AuditResponse, AuditParams>({
	url: '/api/v2/method/vms.api.get_audit_logs',
	method: 'GET',
	params: () => ({
		action: action.value || undefined,
		user: user.value || undefined,
		project: project.value || undefined,
		search: search.value || undefined,
		from_date: dateRange.value[0] || undefined,
		to_date: dateRange.value[1] || undefined,
		page: 1,
		page_size: limit.value,
	}),
	refetch: true,
	cacheKey: ['audit-logs', action, user, project, search, dateRange, limit],
})

const rows = computed(() => logs.data?.logs ?? [])
const total = computed(() => logs.data?.total ?? 0)
const actionOptions = [
	{ label: 'All actions', value: '' },
	...['Download', 'Delete', 'Permanent Delete', 'Rename', 'Restore'].map((value) => ({ label: value, value })),
]
const userOptions = computed(() => [{ label: 'All users', value: '' }, ...(filters.data?.users ?? [])])
const projectOptions = computed(() => [{ label: 'All projects', value: '' }, ...(filters.data?.projects ?? [])])
const hasFilters = computed(() => Boolean(action.value || user.value || project.value || search.value || dateRange.value.length))
const sortedRows = computed(() => [...rows.value].sort(compareRows))

function compareRows(a: AuditLog, b: AuditLog) {
	const left = a[sort.value.field] ?? ''
	const right = b[sort.value.field] ?? ''
	const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
	return sort.value.direction === 'asc' ? order : -order
}

function toggleSort(field: typeof sort.value.field) {
	if (sort.value.field === field) sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
	else sort.value = { field, direction: 'asc' }
}

function sortDirection(field: typeof sort.value.field) {
	return sort.value.field === field ? sort.value.direction : undefined
}

function clearFilters() {
	action.value = ''
	user.value = ''
	project.value = ''
	search.value = ''
	dateRange.value = []
	limit.value = PAGE_SIZE
}

function actionTheme(value: AuditAction) {
	if (value === 'Delete' || value === 'Permanent Delete') return 'red'
	if (value === 'Restore') return 'green'
	if (value === 'Download') return 'blue'
	return 'gray'
}
</script>
