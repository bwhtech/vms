<template>
	<SettingsPanel value="profile">
		<SettingsHeader title="Profile" description="How you appear to your team.">
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
			<div v-if="!profile.doc" class="space-y-3 pt-6">
				<LoadingText />
			</div>
			<div v-else class="space-y-11 pt-6">
				<section class="flex items-center gap-4">
					<Avatar
						:image="profile.doc.user_image || undefined"
						:label="profile.doc.full_name"
						size="3xl"
					/>
					<div class="flex flex-wrap items-center gap-2">
						<FileUploader
							file-types="image/*"
							:private="false"
							doctype="User"
							:docname="userId"
							fieldname="user_image"
							@success="onImageUploaded"
							@failure="onImageFailed"
						>
							<template #default="{ openFileSelector, uploading }">
								<Button
									label="Upload photo"
									icon-left="lucide-camera"
									:loading="uploading"
									@click="openFileSelector"
								/>
							</template>
						</FileUploader>
						<Button
							v-if="profile.doc.user_image"
							label="Remove"
							variant="ghost"
							@click="setImage('')"
						/>
					</div>
				</section>

				<section class="space-y-4">
					<h3 class="text-lg-semibold text-ink-gray-8">Name</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormControl v-model="firstName" label="First name" required />
						<FormControl v-model="lastName" label="Last name" />
					</div>
					<FormControl :model-value="profile.doc.email" label="Email" readonly />
				</section>

				<section>
					<h3 class="text-lg-semibold text-ink-gray-8">Appearance</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							title="Theme"
							description="Follows your device unless you pick one."
						>
							<Select
								:model-value="colorScheme"
								:options="THEMES"
								class="w-40"
								aria-label="Theme"
								@update:model-value="setColorScheme($event as ColorScheme)"
							/>
						</SettingsRow>
					</div>
				</section>

				<section>
					<h3 class="text-lg-semibold text-ink-gray-8">Session</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow title="Log out" :description="`Signed in as ${userId}`">
							<Button
								label="Log out"
								icon-left="lucide-log-out"
								theme="red"
								@click="logout"
							/>
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
	Avatar,
	Button,
	FileUploader,
	FormControl,
	LoadingText,
	Select,
	SettingsBody,
	SettingsHeader,
	SettingsPanel,
	SettingsRow,
	toast,
	useColorScheme,
	useDoc,
	type ColorScheme,
	type UploadedFile,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import { useSession } from '@/composables/useSession'

interface UserProfile {
	name: string
	email: string
	first_name: string
	last_name: string
	full_name: string
	user_image: string | null
}

const THEMES = [
	{ label: 'Light', value: 'light' },
	{ label: 'Dark', value: 'dark' },
	{ label: 'System', value: 'system' },
]

const { userId, logout } = useSession()
const { colorScheme, setColorScheme } = useColorScheme()

// Same doctype + name as the session's doc, so both read one store entry and
// a save here updates the sidebar avatar too.
const profile = useDoc<UserProfile>({ doctype: 'User', name: userId })

const firstName = ref('')
const lastName = ref('')

watch(
	() => profile.doc,
	(value) => {
		if (!value) return
		firstName.value = value.first_name || ''
		lastName.value = value.last_name || ''
	},
	{ immediate: true },
)

const isDirty = computed(
	() =>
		firstName.value !== (profile.doc?.first_name || '') ||
		lastName.value !== (profile.doc?.last_name || ''),
)
const saving = computed(() => profile.setValue.loading)

async function save() {
	try {
		await profile.setValue.submit({ first_name: firstName.value, last_name: lastName.value })
		toast.success('Profile updated')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to update profile')
	}
}

async function setImage(url: string) {
	try {
		await profile.setValue.submit({ user_image: url })
		toast.success(url ? 'Profile photo updated' : 'Profile photo removed')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to update profile photo')
	}
}

function onImageUploaded(file: UploadedFile) {
	void setImage(file.file_url)
}

function onImageFailed(error: unknown) {
	toast.error(serverMessage(error) || 'Failed to upload image')
}
</script>
