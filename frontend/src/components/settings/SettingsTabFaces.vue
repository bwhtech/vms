<template>
	<SettingsPanel value="faces">
		<SettingsHeader
			title="Face recognition"
			description="Find faces in photos and group them into people you can filter by."
		>
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
				<SkeletonLines :lines="3" />
			</div>
			<div v-else class="divide-y divide-outline-gray-1 pt-6">
				<SettingsRow
					title="Detect faces in photos"
					description="Runs on this server; photos never leave it. Models download on first use."
				>
					<Switch v-model="enabled" aria-label="Detect faces in photos" />
				</SettingsRow>
				<SettingsRow
					title="Existing photos"
					description="New uploads are scanned automatically. Scan photos uploaded before this was on."
				>
					<Button
						label="Scan photos"
						icon-left="lucide-scan-face"
						:loading="scan.loading"
						:disabled="!savedEnabled"
						@click="scanExisting"
					/>
				</SettingsRow>
			</div>
		</SettingsBody>
	</SettingsPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	SettingsBody,
	SettingsHeader,
	SettingsPanel,
	SettingsRow,
	Switch,
	toast,
	useCall,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import { changedFields, useVmsSettings, type VmsSettingsDoc } from './useVmsSettings'
import SkeletonLines from '@/components/common/SkeletonLines.vue'

const { doc, save: saveSettings } = useVmsSettings()

const enabled = ref(false)
const savedEnabled = computed(() => Boolean(doc.doc?.face_recognition_enabled))

watch(
	() => doc.doc,
	(value) => {
		if (value) enabled.value = Boolean(value.face_recognition_enabled)
	},
	{ immediate: true },
)

const form = computed<Partial<VmsSettingsDoc>>(() => ({
	face_recognition_enabled: enabled.value ? 1 : 0,
}))
const changes = computed(() => changedFields(doc.doc, form.value))
const isDirty = computed(() => Object.keys(changes.value).length > 0)
const saving = computed(() => doc.setValue.loading)

const scan = useCall<{ pending: number }>({
	url: '/api/v2/method/vms.faces.scan_existing_photos',
	method: 'POST',
	immediate: false,
})

async function save() {
	try {
		await saveSettings(changes.value)
		toast.success('Face recognition settings saved')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to save settings')
	}
}

async function scanExisting() {
	try {
		const pending = (await scan.submit())?.pending ?? 0
		toast.success(
			pending
				? `Scanning ${pending} photo${pending === 1 ? '' : 's'} in the background`
				: 'All photos are already scanned',
		)
	} catch (error) {
		toast.error(serverMessage(error) || 'Could not start the scan')
	}
}
</script>
