<template>
	<SettingsPanel value="general">
		<SettingsHeader title="General" description="Storage, upload limits and housekeeping.">
			<template #actions>
				<Button
					variant="solid"
					label="Save"
					:loading="saving"
					:disabled="!isDirty"
					data-testid="settings-save"
					@click="save"
				/>
			</template>
		</SettingsHeader>
		<SettingsBody>
			<p v-if="doc.error" class="pt-6 text-base text-ink-gray-6">
				You don't have permission to view these settings.
			</p>
			<div v-else-if="!doc.doc" class="space-y-3 pt-6">
				<SkeletonLines :lines="6" />
			</div>
			<div v-else class="space-y-11 pt-6">
				<section class="space-y-4">
					<h3 class="text-lg-semibold text-ink-gray-8">Cloudflare R2</h3>
					<R2CredentialsForm v-model="r2" />
				</section>

				<section>
					<h3 class="text-lg-semibold text-ink-gray-8">Storage</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							title="Bucket usage"
							description="Read from the Cloudflare API via the token above."
						>
							<BucketUsage />
						</SettingsRow>
					</div>
				</section>

				<section class="space-y-4">
					<h3 class="text-lg-semibold text-ink-gray-8">Uploads</h3>
					<MaxFileSizeField v-model="maxFileSize" />
					<FormControl
						v-model="presignedExpiry"
						type="number"
						label="Presigned URL expiry (seconds)"
						description="How long a browser upload link stays valid."
					/>
					<div class="space-y-1.5">
						<span class="text-base-medium text-ink-gray-8">Allowed formats</span>
						<ExtensionsField v-model="extensions" />
					</div>
				</section>

				<section>
					<h3 class="text-lg-semibold text-ink-gray-8">Housekeeping</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							title="Empty trash"
							description="Permanently delete trashed assets after"
						>
							<Select
								v-model="trashRetention"
								:options="RETENTION_OPTIONS"
								class="w-32"
							/>
						</SettingsRow>
						<SettingsRow
							title="Clear tool outputs"
							description="Delete compressed and split files after"
						>
							<Select
								v-model="toolsRetention"
								:options="RETENTION_OPTIONS"
								class="w-32"
							/>
						</SettingsRow>
					</div>
				</section>

				<section v-if="isSystemManager">
					<h3 class="text-lg-semibold text-ink-gray-8">Setup</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							title="Run the setup wizard again"
							description="Reopens the first-run wizard on the next load. Nothing is deleted."
						>
							<Button theme="red" label="Reset setup" @click="confirmReset" />
						</SettingsRow>
					</div>
				</section>
			</div>
		</SettingsBody>
	</SettingsPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	FormControl,
	Select,
	SettingsBody,
	SettingsHeader,
	SettingsPanel,
	SettingsRow,
	dialog,
	toast,
	useCall,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import { useSession } from '@/composables/useSession'
import BucketUsage from './BucketUsage.vue'
import ExtensionsField from './ExtensionsField.vue'
import MaxFileSizeField from './MaxFileSizeField.vue'
import R2CredentialsForm from './R2CredentialsForm.vue'
import {
	changedFields,
	DEFAULT_EXTENSIONS,
	DEFAULT_MAX_FILE_SIZE,
	r2FormFrom,
	RETENTION_OPTIONS,
	useVmsSettings,
	type VmsSettingsDoc,
} from './useVmsSettings'
import SkeletonLines from '@/components/common/SkeletonLines.vue'

const { doc, save: saveSettings } = useVmsSettings()
const { isSystemManager } = useSession()

const r2 = ref(r2FormFrom(null))
const maxFileSize = ref(DEFAULT_MAX_FILE_SIZE)
const presignedExpiry = ref(3600)
const extensions = ref<string[]>([])
const trashRetention = ref('0')
const toolsRetention = ref('0')

function splitExtensions(value: string | null | undefined): string[] {
	return (value || DEFAULT_EXTENSIONS)
		.split(',')
		.map((e) => e.trim())
		.filter(Boolean)
}

// Re-seed from the doc whenever it (re)loads, so a save elsewhere shows here.
watch(
	() => doc.doc,
	(value) => {
		if (!value) return
		r2.value = r2FormFrom(value)
		maxFileSize.value = value.max_file_size || DEFAULT_MAX_FILE_SIZE
		presignedExpiry.value = value.presigned_url_expiry || 3600
		extensions.value = splitExtensions(value.allowed_extensions)
		trashRetention.value = String(value.trash_retention_days ?? '0')
		toolsRetention.value = String(value.tools_retention_days ?? '0')
	},
	{ immediate: true },
)

const form = computed<Partial<VmsSettingsDoc>>(() => ({
	...r2.value,
	max_file_size: maxFileSize.value,
	presigned_url_expiry: Number(presignedExpiry.value) || 3600,
	allowed_extensions: extensions.value.join(','),
	trash_retention_days: trashRetention.value,
	tools_retention_days: toolsRetention.value,
}))
const changes = computed(() => changedFields(doc.doc, form.value))
const isDirty = computed(() => Object.keys(changes.value).length > 0)
const saving = computed(() => doc.setValue.loading)

async function save() {
	try {
		await saveSettings(changes.value)
		toast.success('Settings saved')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to save settings')
	}
}

const resetSetup = useCall<{ status: string }>({
	url: '/api/v2/method/vms.api.reset_setup',
	method: 'POST',
	immediate: false,
})

function confirmReset() {
	dialog.danger({
		title: 'Reset setup?',
		message:
			'The setup wizard opens again on reload. Your settings and assets stay as they are.',
		confirmLabel: 'Reset setup',
		onConfirm: async () => {
			try {
				await resetSetup.submit()
				toast.success('Setup reset. Reloading…')
				setTimeout(() => window.location.reload(), 500)
			} catch (error) {
				toast.error(serverMessage(error) || 'Failed to reset setup')
			}
		},
	})
}
</script>
