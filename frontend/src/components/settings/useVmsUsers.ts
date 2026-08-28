import { computed } from 'vue'
import { dialog, toast, useCall } from 'frappe-ui'
import { serverMessage } from '@/lib/format'

export interface VmsUser {
	name: string
	email: string
	full_name: string
	user_image: string | null
	last_active: string | null
}

export interface PendingInvitation {
	name: string
	email: string
	roles: string[]
}

const APP_NAME = 'vms'

/**
 * Video Manager users plus Frappe's user-invitation flow. Shared by the Users
 * settings tab and the wizard's Team step. `get_pending_invitations` is
 * GET-only and System Manager-only, so callers gate on `isSystemManager`.
 */
export function useVmsUsers(options: { withUsers?: boolean } = {}) {
	const users = useCall<VmsUser[]>({
		url: '/api/v2/method/vms.api.get_vms_users',
		method: 'GET',
		cacheKey: 'vms-users',
		immediate: options.withUsers !== false,
	})

	const invitations = useCall<PendingInvitation[], { app_name: string }>({
		url: '/api/v2/method/frappe.core.api.user_invitation.get_pending_invitations',
		method: 'GET',
		params: { app_name: APP_NAME },
		cacheKey: 'vms-pending-invitations',
	})

	const invite = useCall<
		unknown,
		{ emails: string; roles: string[]; redirect_to_path: string; app_name: string }
	>({
		url: '/api/v2/method/frappe.core.api.user_invitation.invite_by_email',
		method: 'POST',
		immediate: false,
	})

	const cancel = useCall<unknown, { name: string; app_name: string }>({
		url: '/api/v2/method/frappe.core.api.user_invitation.cancel_invitation',
		method: 'POST',
		immediate: false,
	})

	const userList = computed(() => users.data ?? [])
	const pending = computed(() => invitations.data ?? [])

	function refresh() {
		if (options.withUsers !== false) void users.reload()
		void invitations.reload()
	}

	async function inviteByEmail(email: string): Promise<boolean> {
		const trimmed = email.trim()
		if (!trimmed) return false
		try {
			await invite.submit({
				emails: trimmed,
				roles: ['Video Manager'],
				redirect_to_path: '/vms',
				app_name: APP_NAME,
			})
			toast.success(`Invitation sent to ${trimmed}`)
			refresh()
			return true
		} catch (error) {
			toast.error(serverMessage(error) || 'Failed to send invitation')
			return false
		}
	}

	/** `dialog.prompt` for an address, then invite it. */
	function promptInvite() {
		dialog.prompt({
			title: 'Invite user',
			message: 'They get an email with a link to join as a Video Manager.',
			confirmLabel: 'Send invite',
			fields: [{ name: 'email', label: 'Email', placeholder: 'email@example.com', required: true }],
			onConfirm: async ({ values, close, setError }) => {
				const ok = await inviteByEmail(String(values.email ?? ''))
				if (ok) close()
				else setError('Could not send the invitation')
			},
		})
	}

	async function cancelInvitation(invitation: PendingInvitation) {
		try {
			await cancel.submit({ name: invitation.name, app_name: APP_NAME })
			toast.success(`Invitation to ${invitation.email} cancelled`)
			refresh()
		} catch (error) {
			toast.error(serverMessage(error) || 'Failed to cancel invitation')
		}
	}

	return {
		users: userList,
		usersLoading: computed(() => users.loading && !users.data),
		pending,
		pendingLoading: computed(() => invitations.loading && !invitations.data),
		inviting: computed(() => invite.loading),
		inviteByEmail,
		promptInvite,
		cancelInvitation,
		refresh,
	}
}
