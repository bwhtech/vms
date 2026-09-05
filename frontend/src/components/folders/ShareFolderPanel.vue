<template>
	<SidePanel :open="open" title="Share folder" @update:open="emit('update:open', $event)">
		<div class="space-y-6 p-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-base-medium text-ink-gray-8">Public share link</p>
					<p class="mt-1 text-p-sm text-ink-gray-5">
						Anyone with the link can browse and download the files in this folder.
						Subfolders are not included.
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
import type { Folder } from '@/types'
import { serverMessage } from '@/lib/format'
import SidePanel from '@/components/common/SidePanel.vue'

const props = defineProps<{ open: boolean; folder: Folder }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: [] }>()

const enabled = ref(Boolean(props.folder.share_token))
const token = ref(props.folder.share_token ?? '')
const toggling = ref(false)
let syncing = false

const shareUrl = computed(() =>
	token.value
		? `${window.location.origin}/vms/shared/folder/${props.folder.name}?token=${token.value}`
		: '',
)

const enableSharing = useCall<{ share_token: string; share_url: string }, { folder: string }>({
	url: '/api/v2/method/vms.api.enable_folder_sharing',
	method: 'POST',
	immediate: false,
})
const disableSharing = useCall<{ status: string }, { folder: string }>({
	url: '/api/v2/method/vms.api.disable_folder_sharing',
	method: 'POST',
	immediate: false,
})

watch(
	() => props.folder,
	(value) => {
		syncing = true
		token.value = value.share_token ?? ''
		enabled.value = Boolean(value.share_token)
		syncing = false
	},
)

watch(enabled, async (value, previous) => {
	if (syncing || value === previous) return
	toggling.value = true
	try {
		if (value) {
			const result = await enableSharing.submit({ folder: props.folder.name })
			token.value = result?.share_token ?? ''
			toast.success('Folder sharing enabled')
		} else {
			await disableSharing.submit({ folder: props.folder.name })
			token.value = ''
			toast.success('Folder sharing disabled')
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
