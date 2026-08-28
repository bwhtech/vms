import { computed } from 'vue'
import { useCall, useList } from 'frappe-ui'
import type { Notification } from '@/types'
import { onRealtime, useDocRealtime } from '@/composables/useRealtime'

/**
 * The current user's `Notification Log` rows, shared by the sidebar (unread
 * dot) and the notifications panel (list + mark read). Module-level so both
 * read one list and a mark-read in the panel clears the dot at once.
 */
export interface NotificationRow extends Notification {
	from_user_name?: string
	from_user_image?: string | null
}

const list = useList<NotificationRow>({
	doctype: 'Notification Log',
	fields: [
		'name',
		'subject',
		'email_content',
		'type',
		'read',
		'from_user',
		'document_type',
		'document_name',
		'link',
		'creation',
		'from_user.full_name as from_user_name',
		'from_user.user_image as from_user_image',
	],
	orderBy: 'creation desc',
	limit: 50,
	cacheKey: 'notification-logs',
	staleOnError: true,
})

const markReadCall = useCall<unknown, { docname: string }>({
	url: '/api/v2/method/frappe.desk.doctype.notification_log.notification_log.mark_as_read',
	method: 'POST',
	immediate: false,
})

const markAllReadCall = useCall<unknown, Record<string, never>>({
	url: '/api/v2/method/frappe.desk.doctype.notification_log.notification_log.mark_all_as_read',
	method: 'POST',
	immediate: false,
})

const notifications = computed(() => list.data ?? [])
const unread = computed(() => notifications.value.filter((row) => !row.read))
const unreadCount = computed(() => unread.value.length)

async function markRead(name: string): Promise<void> {
	await markReadCall.submit({ docname: name })
	await list.reload()
}

async function markAllRead(): Promise<void> {
	await markAllReadCall.submit({})
	await list.reload()
}

export function useNotifications() {
	// Frappe emits `notification` to the target user on insert; `doc_update`
	// covers edits (read flags set from the desk, deletions).
	onRealtime('notification', () => void list.reload())
	useDocRealtime('Notification Log', () => void list.reload())

	return {
		list,
		notifications,
		unread,
		unreadCount,
		loading: computed(() => list.loading),
		markRead,
		markAllRead,
		markingAll: computed(() => markAllReadCall.loading),
		reload: () => list.reload(),
	}
}
