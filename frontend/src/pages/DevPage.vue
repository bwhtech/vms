<template>
	<div class="mx-auto max-w-3xl space-y-10 px-3 py-5 pb-10 text-ink-gray-8 sm:px-5">
		<h1 class="text-xl font-semibold text-ink-gray-9">Dev sandbox</h1>

		<section class="space-y-3">
			<h2 class="text-base font-medium">Session and setup</h2>
			<pre class="overflow-x-auto rounded bg-surface-gray-1 p-3 text-xs text-ink-gray-7">{{
				stateJson
			}}</pre>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">Imperative dialogs and toasts</h2>
			<div class="flex flex-wrap gap-2">
				<Button label="dialog.confirm" @click="runConfirm" />
				<Button label="dialog.danger" theme="red" @click="runDanger" />
				<Button label="dialog.prompt" @click="runPrompt" />
				<Button label="toast.success" @click="toast.success('Saved')" />
				<Button label="toast.error" @click="toast.error('Something broke')" />
				<Button label="toast with Undo" @click="runUndoToast" />
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">SidePanel</h2>
			<Button
				label="Open side panel"
				icon-left="lucide-panel-right"
				@click="panelOpen = true"
			/>
			<SidePanel v-model:open="panelOpen" title="Versions">
				<template #actions>
					<Button variant="ghost" icon="lucide-upload" label="Upload" />
				</template>
				<div class="space-y-2 p-4 text-sm">
					<p v-for="n in 30" :key="n">Row {{ n }}</p>
				</div>
			</SidePanel>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">EmptyState</h2>
			<div class="rounded border border-outline-gray-1">
				<EmptyState
					icon="lucide-folder-open"
					title="No assets yet"
					description="Upload a file or create a folder to get started."
				>
					<template #actions>
						<Button variant="solid" label="Upload" icon-left="lucide-upload" />
						<Button label="New folder" />
					</template>
				</EmptyState>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">UserAvatar, RelativeTime, YoutubeIcon</h2>
			<div class="flex items-center gap-4">
				<UserAvatar :user="{ full_name: 'Ada Lovelace' }" size="sm" />
				<UserAvatar :user="{ full_name: 'Grace Hopper' }" size="lg" />
				<RelativeTime :date="tenMinutesAgo" />
				<YoutubeIcon class="size-5 text-ink-gray-7" />
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">StorageMeter</h2>
			<div class="w-60 rounded border border-outline-gray-1">
				<StorageMeter />
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">MediaPreviewDialog</h2>
			<Button label="Preview image" @click="previewOpen = true" />
			<MediaPreviewDialog
				v-model:open="previewOpen"
				url="/assets/vms/frontend/vms-logo.png"
				name="vms-logo.png"
				mime="image/png"
				download-url="/assets/vms/frontend/vms-logo.png"
			/>
		</section>

		<section class="space-y-3">
			<h2 class="text-base font-medium">AssetActions (fake asset)</h2>
			<div
				class="flex items-center gap-3 rounded border border-outline-gray-1 px-3 py-2 text-sm"
			>
				<span class="lucide-file-video size-4 text-ink-gray-5" aria-hidden="true" />
				<span class="flex-1 truncate">{{ fakeAsset.file_name }}</span>
				<AssetActions :asset="fakeAsset" @changed="changes++" />
			</div>
			<p class="text-xs text-ink-gray-5">`changed` emitted {{ changes }} times</p>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, dialog, toast } from 'frappe-ui'
import type { Asset } from '@/types'
import { useSession } from '@/composables/useSession'
import { useSetup } from '@/composables/useSetup'
import AssetActions from '@/components/assets/AssetActions.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MediaPreviewDialog from '@/components/common/MediaPreviewDialog.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import SidePanel from '@/components/common/SidePanel.vue'
import StorageMeter from '@/components/common/StorageMeter.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import YoutubeIcon from '@/components/common/YoutubeIcon.vue'

const session = useSession()
const setup = useSetup()

const stateJson = computed(() =>
	JSON.stringify(
		{
			session: {
				user: session.user.value,
				userId: session.userId.value,
				isSystemManager: session.isSystemManager.value,
				isGuest: session.isGuest.value,
				ready: session.ready.value,
			},
			setup: {
				status: setup.status.value,
				isSystemManager: setup.isSystemManager.value,
				ready: setup.ready.value,
			},
		},
		null,
		2,
	),
)

const panelOpen = ref(false)
const previewOpen = ref(false)
const changes = ref(0)

const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

const fakeAsset: Asset = {
	name: 'VMS-AST-00001',
	file_name: 'interview-raw.mkv',
	r2_key: 'dev/interview-raw.mkv',
	file_type: 'video/x-matroska',
	file_size: 1_234_567_890,
	status: 'Ready',
	category: 'Footage',
	uploaded_by: 'Administrator',
	tags: ['b-roll'],
	card_color: '',
	creation: tenMinutesAgo,
	modified: tenMinutesAgo,
}

function runConfirm() {
	dialog.confirm({
		title: 'Archive project?',
		message: 'You can unarchive it later.',
		onConfirm: () => {
			toast.success('Confirmed')
		},
	})
}

function runDanger() {
	dialog.danger({
		title: 'Delete asset?',
		message: 'This moves the asset to Trash.',
		onConfirm: () => {
			toast.success('Deleted')
		},
	})
}

function runPrompt() {
	dialog.prompt({
		title: 'Rename',
		fields: [{ name: 'title', label: 'Title', required: true, defaultValue: 'interview-raw' }],
		onConfirm: ({ values }) => {
			toast.info(`New title: ${values.title}`)
		},
	})
}

function runUndoToast() {
	toast.success('Asset moved to Trash', {
		action: { label: 'Undo', onClick: () => toast.info('Restored') },
	})
}
</script>
