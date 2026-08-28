<template>
	<div class="flex items-center gap-3" data-testid="bucket-usage">
		<Skeleton v-if="usage.loading && !usage.data" class="h-4 w-32 rounded-4" />
		<p v-else-if="usage.error" class="max-w-xs text-right text-sm text-ink-gray-5">
			{{ serverMessage(usage.error) || 'Usage unavailable' }}
		</p>
		<div v-else-if="usage.data" class="text-right">
			<p class="text-base tabular-nums text-ink-gray-8">
				{{ formatBytes(usage.data.payload_size) }}
			</p>
			<p class="text-sm text-ink-gray-5">
				{{ usage.data.object_count.toLocaleString() }} objects ·
				{{ formatBytes(usage.data.metadata_size) }} metadata
			</p>
		</div>
		<Button
			icon="lucide-refresh-cw"
			variant="ghost"
			aria-label="Refresh bucket usage"
			:loading="usage.loading"
			@click="usage.reload()"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button, Skeleton, useCall } from 'frappe-ui'
import { formatBytes, serverMessage } from '@/lib/format'

interface BucketUsageResponse {
	payload_size: number
	object_count: number
	metadata_size: number
}

// Hits the Cloudflare API each time, so no cacheKey — a stale figure here
// would be more confusing than a short wait.
const usage = useCall<BucketUsageResponse>({
	url: '/api/v2/method/vms.api.get_bucket_usage',
	method: 'GET',
})
</script>
