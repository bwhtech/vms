import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { call, useCall, useDoc } from 'frappe-ui'
import type { SessionUser } from '@/types'
import { useSetup } from '@/composables/useSetup'

/**
 * The logged-in user and their User doc. A module singleton: every caller
 * shares one set of requests. `isSystemManager` comes from `useSetup()`, whose
 * `get_setup_status` response already carries the flag.
 */
let session: ReturnType<typeof createSession> | null = null

function createSession() {
	const loggedUser = useCall<string>({
		url: '/api/v2/method/frappe.auth.get_logged_user',
		method: 'GET',
		cacheKey: 'logged-user',
	})

	const userId = computed(() => {
		const value = loggedUser.data
		return value && value !== 'Guest' ? value : ''
	})

	const userDoc = useDoc<SessionUser & { name: string }>({
		doctype: 'User',
		name: userId,
	})

	const { isSystemManager } = useSetup()

	const user = computed<SessionUser | null>(() => userDoc.doc ?? null)

	/** True once we know whether there is a user, and have their doc if so. */
	const ready = computed(
		() => loggedUser.isFinished && (!userId.value || userDoc.isFinished || Boolean(userDoc.error)),
	)
	const isGuest = computed(() => loggedUser.isFinished && !userId.value)

	async function logout() {
		try {
			await call('logout')
		} finally {
			window.location.href = '/login'
		}
	}

	return {
		user,
		userId,
		isSystemManager,
		isGuest,
		ready,
		logout,
		reload: () => {
			void userDoc.reload()
		},
	}
}

export function useSession() {
	if (!session) session = createSession()
	return session
}

/** Resolve the session once — used by the router guard. `''` means Guest. */
export function resolveLoggedUser(): Promise<string> {
	const { userId, ready } = useSession()
	return whenTrue(ready).then(() => userId.value)
}

function whenTrue(source: ComputedRef<boolean> | Ref<boolean>): Promise<void> {
	if (source.value) return Promise.resolve()
	return new Promise((resolve) => {
		const stop = watch(source, (value) => {
			if (!value) return
			stop()
			resolve()
		})
	})
}
