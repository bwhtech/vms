import { computed } from 'vue'
import { useCall } from 'frappe-ui'

interface SetupStatusResponse {
	setup_complete: boolean
	is_system_manager: boolean
}

export type SetupStatus = 'unknown' | 'pending' | 'done'

/**
 * One `get_setup_status` request shared by the router guard, the shell and
 * `useSession`. A module singleton: created on first use, never re-created.
 */
let setup: ReturnType<typeof createSetup> | null = null

function createSetup() {
	const request = useCall<SetupStatusResponse>({
		url: '/api/v2/method/vms.api.get_setup_status',
		method: 'GET',
		cacheKey: 'setup-status',
	})

	const status = computed<SetupStatus>(() => {
		const data = request.data
		if (!data) return 'unknown'
		return data.setup_complete ? 'done' : 'pending'
	})
	const isSystemManager = computed(() => Boolean(request.data?.is_system_manager))
	/** True once the request has settled — successfully or not. */
	const ready = computed(() => request.isFinished || Boolean(request.error))

	return {
		status,
		isSystemManager,
		ready,
		refresh: () => {
			void request.reload()
		},
	}
}

export function useSetup() {
	if (!setup) setup = createSetup()
	return setup
}
