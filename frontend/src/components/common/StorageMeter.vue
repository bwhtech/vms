<template>
	<div class="space-y-1.5 px-2 py-2" data-testid="storage-meter">
		<div class="flex items-center gap-1.5 text-xs text-ink-gray-6">
			<span class="lucide-hard-drive size-3.5" aria-hidden="true" />
			<span>Storage</span>
		</div>
		<LoadingText v-if="counts.loading && !counts.data" class="w-full" />
		<template v-else>
			<Progress v-if="counts.data" :value="percent" size="sm" />
			<p class="text-xs text-ink-gray-5">{{ usageText }}</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LoadingText, Progress, useCall } from 'frappe-ui'
import { formatBytes } from '@/lib/format'

interface SidebarCounts {
	uncategorised: number
	unread_notifications: number
	storage: { used: number; total: number }
}

const counts = useCall<SidebarCounts>({
	url: '/api/v2/method/vms.api.get_sidebar_counts',
	method: 'GET',
	cacheKey: 'sidebar-counts',
})

const storage = computed(() => counts.data?.storage ?? { used: 0, total: 0 })

// R2 buckets have no quota, so `total` is 0 when unknown.
const percent = computed(() => {
	const { used, total } = storage.value
	if (!total) return 0
	return Math.min(100, Math.round((used / total) * 100))
})

const usageText = computed(() => {
	if (counts.error) return 'Usage unavailable'
	const { used, total } = storage.value
	return total
		? `${formatBytes(used)} of ${formatBytes(total)} used`
		: `${formatBytes(used)} used`
})
</script>
