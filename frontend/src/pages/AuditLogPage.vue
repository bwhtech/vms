<template>
	<PageHeader>
		<PageHeaderTitle>
			<div class="min-w-0 py-1">
				<h1 class="truncate">Audit log</h1>
				<p class="mt-1.5 text-sm text-ink-gray-5">
					{{ total }} {{ total === 1 ? 'entry' : 'entries' }}
				</p>
			</div>
		</PageHeaderTitle>
	</PageHeader>

	<div class="flex min-h-0 flex-1 flex-col" data-testid="audit-log">
		<div class="mx-auto w-full max-w-4xl shrink-0 px-3 pb-4 pt-5 sm:px-5">
			<div class="flex flex-wrap items-center gap-2">
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
		</div>

		<component :is="isDesktop ? ScrollArea : 'div'" :class="isDesktop && 'min-h-0 flex-1'">
			<div class="mx-auto w-full max-w-4xl px-3 pb-10 sm:px-5">
				<SkeletonRows v-if="logs.loading && !rows.length" :thumbnail="false" />
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
						class="max-sm:[--list-columns:minmax(0,1fr)_auto]"
						data-testid="audit-list"
					>
						<ListHeader class="sticky top-0 z-10 bg-surface-base max-sm:!hidden">
							<ListHeaderCell>Time</ListHeaderCell>
							<ListHeaderCell>User</ListHeaderCell>
							<ListHeaderCell>Action</ListHeaderCell>
							<ListHeaderCell>File</ListHeaderCell>
							<ListHeaderCell>Project</ListHeaderCell>
							<ListHeaderCell class="justify-end">Size</ListHeaderCell>
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
									<ListCell class="max-sm:hidden">
										<Tooltip :text="formatDateTime(log.timestamp)">
											<span class="text-sm text-ink-gray-7 tabular-nums">
												{{ formatDate(log.timestamp, 'h:mm A') }}
											</span>
										</Tooltip>
									</ListCell>
									<ListCell class="max-sm:hidden">
										<UserHoverCard :user="log" />
									</ListCell>
									<ListCell class="max-sm:hidden">
										<Badge
											:label="log.action"
											:theme="actionTheme(log.action)"
										/>
									</ListCell>
									<ListCell>
										<div class="flex min-w-0 items-center gap-3">
											<UserAvatar :user="log" class="sm:hidden" />
											<div class="min-w-0">
												<p class="truncate text-base text-ink-gray-8">
													{{ log.file_name || log.asset_name }}
												</p>
												<p
													class="mt-0.5 truncate text-sm text-ink-gray-5 sm:hidden"
												>
													{{ mobileMeta(log) }}
												</p>
											</div>
										</div>
									</ListCell>
									<ListCell class="max-sm:hidden">
										<span class="truncate text-sm text-ink-gray-7">
											{{ log.project_name || '—' }}
										</span>
									</ListCell>
									<ListCell
										class="justify-end text-sm text-ink-gray-5 tabular-nums"
									>
										{{ log.file_size ? formatBytes(log.file_size) : '—' }}
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
						<span class="text-sm text-ink-gray-5"
							>{{ rows.length }} of {{ total }}</span
						>
						<ErrorMessage v-if="logs.error" :message="logs.error" />
						<Button
							:label="logs.error ? 'Try again' : 'Load more'"
							:loading="logs.loading"
							@click="loadMore"
						/>
					</div>
				</template>
			</div>
		</component>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Badge,
	Button,
	ErrorMessage,
	PageHeader,
	PageHeaderTitle,
	ScrollArea,
	Select,
	TextInput,
	Tooltip,
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
import { formatDate, formatDateTime, groupByDay } from '@/lib/dates'
import { formatBytes } from '@/lib/format'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import UserHoverCard from '@/components/common/UserHoverCard.vue'
import SkeletonRows from '@/components/common/SkeletonRows.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'

usePageMeta(() => ({ title: 'Audit log · VMS' }))

const { isDesktop } = useBreakpoint()

const PAGE_SIZE = 20
const COLUMNS = ['5.5rem', '3rem', '9rem', 'minmax(10rem,1fr)', '11rem', '5rem']
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
	const parts = [
		formatDate(log.timestamp, 'h:mm A'),
		log.action,
		log.project_name || 'No project',
	]
	return parts.join(' · ')
}

function actionTheme(value: AuditAction) {
	if (value === 'Delete' || value === 'Permanent Delete') return 'red'
	if (value === 'Restore') return 'green'
	if (value === 'Download') return 'blue'
	return 'gray'
}
</script>
