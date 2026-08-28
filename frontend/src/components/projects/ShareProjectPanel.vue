<template>
	<SidePanel :open="open" title="Share project" @update:open="emit('update:open', $event)">
		<div class="space-y-6 p-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-base-medium text-ink-gray-8">Public share link</p>
					<p class="mt-1 text-p-sm text-ink-gray-5">
						Anyone with the link can browse and download this project's assets.
					</p>
				</div>
				<Switch v-model="enabled" aria-label="Public share link" :disabled="toggling" />
			</div>

			<div v-if="enabled && shareUrl" class="space-y-2">
				<FormControl :model-value="shareUrl" label="Share link" readonly />
				<Button label="Copy link" icon-left="lucide-copy" variant="subtle" @click="copy" />
			</div>

			<Alert v-if="enabled" title="Link access is enabled" variant="subtle" theme="green">
				Revoking the link immediately removes guest access.
			</Alert>
		</div>
	</SidePanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Alert, Button, FormControl, Switch, toast, useCall } from 'frappe-ui'
import type { Project } from '@/types'
import { serverMessage } from '@/lib/format'
import SidePanel from '@/components/common/SidePanel.vue'

const props = defineProps<{ open: boolean; project: Project }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const enabled = ref(Boolean(props.project.share_token))
const token = ref(props.project.share_token ?? '')
const toggling = ref(false)
let syncing = false

const shareUrl = computed(() =>
	token.value
		? `${window.location.origin}/vms/shared/${props.project.name}?token=${token.value}`
		: '',
)

const enableSharing = useCall<{ share_token: string; share_url: string }, { project: string }>({
	url: '/api/v2/method/vms.api.enable_project_sharing',
	method: 'POST',
	immediate: false,
})
const disableSharing = useCall<{ status: string }, { project: string }>({
	url: '/api/v2/method/vms.api.disable_project_sharing',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.project.share_token,
	(value) => {
		syncing = true
		token.value = value ?? ''
		enabled.value = Boolean(value)
		syncing = false
	},
)

watch(enabled, async (value, previous) => {
	if (syncing || value === previous) return
	toggling.value = true
	try {
		if (value) {
			const result = await enableSharing.submit({ project: props.project.name })
			token.value = result?.share_token ?? ''
			toast.success('Project sharing enabled')
		} else {
			await disableSharing.submit({ project: props.project.name })
			token.value = ''
			toast.success('Project sharing disabled')
		}
		emit('changed')
	} catch (error) {
		syncing = true
		enabled.value = !value
		syncing = false
		toast.error(serverMessage(error) || 'Could not update sharing')
	} finally {
		toggling.value = false
	}
})

async function copy() {
	try {
		await navigator.clipboard.writeText(shareUrl.value)
		toast.success('Share link copied')
	} catch {
		toast.error('Could not copy the link')
	}
}
</script>
