<template>
	<SidePanel v-model:open="notificationsOpen" title="Notifications">
		<template #actions>
			<Button
				v-if="unreadCount"
				variant="ghost"
				icon-left="lucide-list-checks"
				label="Mark all read"
				:loading="markingAll"
				data-testid="notifications-mark-all"
				@click="markAll"
			/>
		</template>

		<div class="flex h-full flex-col" data-testid="notifications-panel">
			<div class="shrink-0 border-b border-outline-gray-1 px-4 py-2">
				<TabButtons v-model="tab" :options="tabOptions" />
			</div>

			<div v-if="loading && !notifications.length" class="grid flex-1 place-items-center">
				<Spinner class="size-5 text-ink-gray-5" />
			</div>

			<EmptyState
				v-else-if="!visible.length"
				icon="lucide-bell"
				:title="tab === 'unread' ? 'All caught up' : 'No notifications'"
				:description="
					tab === 'unread'
						? 'No unread notifications.'
						: 'Notifications will appear here.'
				"
			/>

			<ul v-else class="min-h-0 flex-1">
				<li
					v-for="group in groupByDay(visible, (row) => row.creation)"
					:key="group.date"
					class="border-b border-outline-gray-1 last:border-b-0"
				>
					<p class="px-4 pb-1 pt-3 text-xs font-medium uppercase text-ink-gray-5">
						{{ group.label }}
					</p>
					<button
						v-for="row in group.items"
						:key="row.name"
						type="button"
						class="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-gray-2"
						:class="row.read ? '' : 'bg-surface-gray-1'"
						data-testid="notification-item"
						@click="open(row)"
					>
						<UserAvatar
							class="mt-0.5 shrink-0"
							:user="{
								full_name: row.from_user_name || row.from_user,
								user_image: row.from_user_image,
							}"
						/>
						<div class="min-w-0 flex-1">
							<div class="flex items-start gap-2">
								<!-- eslint-disable vue/no-v-html -- server-rendered Frappe HTML -->
								<p
									class="notification-subject flex-1 text-sm leading-snug"
									:class="
										row.read ? 'text-ink-gray-6' : 'font-medium text-ink-gray-9'
									"
									v-html="row.subject"
								/>
								<!-- eslint-enable vue/no-v-html -->
								<span
									v-if="!row.read"
									class="mt-1.5 size-2 shrink-0 rounded-full bg-surface-red-6"
									aria-label="Unread"
								/>
							</div>
							<p class="mt-0.5 text-xs text-ink-gray-5">
								{{ fromNow(row.creation) }}
							</p>
						</div>
					</button>
				</li>
			</ul>
		</div>
	</SidePanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Spinner, TabButtons, toast } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import SidePanel from '@/components/common/SidePanel.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useNotifications, type NotificationRow } from '@/composables/useNotifications'
import { useOverlays } from '@/composables/useOverlays'
import { fromNow, groupByDay } from '@/lib/dates'
import { serverMessage } from '@/lib/format'

const router = useRouter()
const { notificationsOpen } = useOverlays()
const { notifications, unread, unreadCount, loading, markRead, markAllRead, markingAll } =
	useNotifications()

const tab = ref<'unread' | 'all'>('unread')

const tabOptions = computed(() => [
	{ value: 'unread', label: unreadCount.value ? `Unread (${unreadCount.value})` : 'Unread' },
	{ value: 'all', label: 'All' },
])

const visible = computed(() => (tab.value === 'unread' ? unread.value : notifications.value))

async function markAll() {
	try {
		await markAllRead()
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not mark notifications as read')
	}
}

/** Mark read, then follow the link. Links inside the app stay client-side. */
async function open(row: NotificationRow) {
	if (!row.read) void markRead(row.name).catch(() => undefined)
	const target = linkFor(row)
	if (!target) return
	notificationsOpen.value = false
	if (target.startsWith('/vms/')) {
		await router.push(target.slice('/vms'.length))
		return
	}
	window.location.href = target
}

function linkFor(row: NotificationRow): string | null {
	if (row.link) return row.link
	if (row.document_type === 'VMS Asset' && row.document_name) {
		return `/vms/review/${row.document_name}`
	}
	if (row.document_type === 'VMS Project' && row.document_name) {
		return `/vms/projects/${row.document_name}`
	}
	if (row.document_type && row.document_name) {
		const slug = row.document_type.toLowerCase().replace(/ /g, '-')
		return `/app/${slug}/${row.document_name}`
	}
	return null
}
</script>

<style scoped>
/* Frappe wraps the actor in <b>; keep it readable without a full prose reset. */
.notification-subject :deep(b),
.notification-subject :deep(strong) {
	font-weight: 600;
}
</style>
