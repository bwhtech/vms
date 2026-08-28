<template>
	<PageHeader>
		<PageHeaderTitle>
			<div class="min-w-0">
				<h1 class="truncate">Audit log</h1>
				<p class="text-sm text-ink-gray-5">
					{{ total }} {{ total === 1 ? 'entry' : 'entries' }}
				</p>
			</div>
		</PageHeaderTitle>
	</PageHeader>

	<div class="px-3 py-5 pb-10 sm:px-5" data-testid="audit-log">
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<TextInput
				v-model="search"
				placeholder="Search file name"
				class="w-full sm:w-56"
				data-testid="audit-search"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" />
				</template>
			</TextInput>
			<Select
				v-model="action"
				:options="actionOptions"
				class="w-40"
				data-testid="audit-filter-action"
			/>
			<Select
				v-model="user"
				:options="userOptions"
				class="w-44"
				data-testid="audit-filter-user"
			/>
			<Select
				v-model="project"
				:options="projectOptions"
				class="w-44"
				data-testid="audit-filter-project"
			/>
			<Button
				v-if="hasFilters"
				variant="ghost"
				label="Clear"
				icon-left="lucide-x"
				@click="clearFilters"
			/>
		</div>

		<LoadingText v-if="logs.loading && !rows.length" :lines="5" />
		<ErrorMessage v-else-if="logs.error && !rows.length" :message="logs.error" />
		<EmptyState
			v-else-if="!rows.length"
			icon="lucide-clipboard-list"
			:title="hasFilters ? 'No matching entries' : 'No activity yet'"
			:description="
				hasFilters
					? 'Try a different filter.'
					: 'Downloads, deletions, restores and renames show up here.'
			"
		>
			<template v-if="hasFilters" #actions>
				<Button label="Clear filters" @click="clearFilters" />
			</template>
		</EmptyState>

		<template v-else>
			<List
				:columns="COLUMNS"
				class="-mx-3 list-row-px-3 sm:-mx-5 sm:list-row-px-5 max-sm:[--list-columns:minmax(0,1fr)_auto]"
				data-testid="audit-list"
			>
				<ListHeader class="max-sm:!hidden">
					<ListHeaderCell>Time</ListHeaderCell>
					<ListHeaderCell>User</ListHeaderCell>
					<ListHeaderCell>Action</ListHeaderCell>
					<ListHeaderCell>Target</ListHeaderCell>
					<ListHeaderCell>Details</ListHeaderCell>
				</ListHeader>
				<ListRows v-slot="{ item: groupRow }" :items="groupedRows">
					<ListGroup v-if="groupRow.dayGroup" :label="groupRow.dayGroup.label">
						<ListRow
							v-for="log in groupRow.dayGroup.items"
							:key="log.name"
							:value="log.name"
							class="min-h-12"
							data-testid="audit-row"
						>
							<ListCell class="text-sm text-ink-gray-7 tabular-nums max-sm:hidden">
								{{ formatDate(log.timestamp, 'HH:mm') }}
							</ListCell>
							<ListCell class="max-sm:hidden">
								<div class="flex min-w-0 items-center gap-2">
									<UserAvatar
										:user="{
											full_name: log.user_full_name,
											user_image: log.user_image,
										}"
									/>
									<span class="truncate text-sm text-ink-gray-7">{{
										log.user_full_name || log.user
									}}</span>
								</div>
							</ListCell>
							<ListCell class="max-sm:hidden">
								<Badge :label="log.action" :theme="actionTheme(log.action)" />
							</ListCell>
							<ListCell>
								<div class="min-w-0">
									<p class="truncate text-base text-ink-gray-8">
										{{ log.file_name || log.asset_name }}
									</p>
									<p
										class="mt-0.5 truncate text-sm text-ink-gray-5 max-sm:hidden"
									>
										{{ log.project_name || 'No project' }}
									</p>
									<p class="mt-0.5 truncate text-sm text-ink-gray-5 sm:hidden">
										{{ mobileMeta(log) }}
									</p>
								</div>
							</ListCell>
							<ListCell class="text-sm text-ink-gray-7 tabular-nums">
								{{ details(log) }}
							</ListCell>
						</ListRow>
					</ListGroup>
				</ListRows>
			</List>

			<div
				v-if="rows.length < total"
				class="mt-4 flex flex-wrap items-center justify-center gap-3"
				data-testid="audit-load-more"
			>
				<span class="text-sm text-ink-gray-5">{{ rows.length }} of {{ total }}</span>
				<ErrorMessage v-if="logs.error" :message="logs.error" />
				<Button
					:label="logs.error ? 'Try again' : 'Load more'"
					:loading="logs.loading"
					@click="loadMore"
				/>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Badge,
	Button,
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
	ListGroup,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import type { AuditAction, AuditLog } from '@/types'
import { formatDate, groupByDay } from '@/lib/dates'
import { formatBytes } from '@/lib/format'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

usePageMeta(() => ({ title: 'Audit log · VMS' }))

const PAGE_SIZE = 20
const COLUMNS = ['6rem', '11rem', '8rem', 'minmax(10rem,1fr)', '8rem']
const ACTIONS: AuditAction[] = ['Download', 'Delete', 'Permanent Delete', 'Rename', 'Restore']

const action = ref('')
const user = ref('')
const project = ref('')
const search = ref('')
const start = ref(0)
const rows = ref<AuditLog[]>([])
const total = ref(0)

interface AuditResponse {
	logs: AuditLog[]
	total: number
}
interface AuditParams {
	action?: string
	user?: string
	project?: string
	search?: string
	start: number
	page_length: number
}
interface FilterOption {
	value: string
	label: string
}
interface FilterResponse {
	users: FilterOption[]
	projects: FilterOption[]
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
		search: search.value.trim() || undefined,
		start: start.value,
		page_length: PAGE_SIZE,
	}),
	cacheKey: 'audit-logs',
	onSuccess: (data) => {
		total.value = data.total
		rows.value = start.value === 0 ? data.logs : [...rows.value, ...data.logs]
	},
})

const actionOptions = [
	{ label: 'All actions', value: '' },
	...ACTIONS.map((value) => ({ label: value, value })),
]
const userOptions = computed(() => [
	{ label: 'All users', value: '' },
	...(filters.data?.users ?? []),
])
const projectOptions = computed(() => [
	{ label: 'All projects', value: '' },
	...(filters.data?.projects ?? []),
])
const hasFilters = computed(() =>
	Boolean(action.value || user.value || project.value || search.value),
)

const groups = computed(() => groupByDay(rows.value, (log) => log.timestamp))
const groupedRows = computed(() => {
	const groupStarts = new Map(groups.value.map((group) => [group.items[0]?.name, group]))
	return rows.value.map((log) => ({ ...log, dayGroup: groupStarts.get(log.name) }))
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch([action, user, project], reload)
watch(search, () => {
	clearTimeout(searchTimer)
	searchTimer = setTimeout(reload, 300)
})

function reload() {
	start.value = 0
	void logs.reload()
}

function loadMore() {
	start.value = rows.value.length
	void logs.reload()
}

function clearFilters() {
	action.value = ''
	user.value = ''
	project.value = ''
	search.value = ''
}

function mobileMeta(log: AuditLog) {
	return `${log.user_full_name || log.user} · ${log.action} · ${log.project_name || 'No project'}`
}

function details(log: AuditLog) {
	const parts = [log.file_size ? formatBytes(log.file_size) : '', log.file_type || '']
	return parts.filter(Boolean).join(' · ') || '—'
}

function actionTheme(value: AuditAction) {
	if (value === 'Delete' || value === 'Permanent Delete') return 'red'
	if (value === 'Restore') return 'green'
	if (value === 'Download') return 'blue'
	return 'gray'
}
</script>
