<template>
	<div class="min-h-screen bg-surface-base">
		<PageHeaderBase class="flex min-h-12 items-center border-b px-3 sm:px-5">
			<PageHeaderTitle>
				<h1 class="truncate">Set up your workspace</h1>
			</PageHeaderTitle>
		</PageHeaderBase>

		<div class="mx-auto max-w-2xl px-3 py-6 pb-10 sm:px-5">
			<p class="text-p-base text-ink-gray-6">
				Let's get VMS configured in a few quick steps.
			</p>

			<!-- Stepper: plain buttons so a finished step can be revisited. -->
			<nav class="mt-5 flex flex-wrap items-center gap-1" aria-label="Setup steps">
				<template v-for="(item, index) in STEPS" :key="item.id">
					<Button
						:label="item.label"
						:variant="index === step ? 'subtle' : 'ghost'"
						:icon-left="index < step ? 'lucide-check' : undefined"
						:disabled="index > step"
						:aria-current="index === step ? 'step' : undefined"
						@click="step = index"
					/>
					<span
						v-if="index < STEPS.length - 1"
						class="lucide-chevron-right size-4 text-ink-gray-4"
						aria-hidden="true"
					/>
				</template>
			</nav>

			<div v-if="!doc.doc" class="space-y-3 pt-8">
				<LoadingText />
				<LoadingText />
			</div>

			<form v-else class="space-y-4 pt-8" @submit.prevent="saveAndNext">
				<template v-if="current.id === 'storage'">
					<h2 class="text-lg-semibold text-ink-gray-8">Cloudflare R2 Credentials</h2>
					<p class="text-p-base text-ink-gray-6">
						Videos are stored in your own R2 bucket. Find these under R2 › Manage API
						tokens.
					</p>
					<R2CredentialsForm v-model="r2" />
				</template>

				<template v-else-if="current.id === 'team'">
					<h2 class="text-lg-semibold text-ink-gray-8">Invite Your Team</h2>
					<p class="text-p-base text-ink-gray-6">
						Each person gets an email with a link to join as a Video Manager. You can do
						this later from Settings › Users.
					</p>
					<div class="flex items-end gap-2">
						<FormControl
							v-model="inviteEmail"
							type="email"
							label="Email"
							placeholder="email@example.com"
							class="flex-1"
							@keydown.enter.prevent="sendInvite"
						/>
						<Button
							label="Invite"
							icon-left="lucide-send"
							:loading="inviting"
							:disabled="!inviteEmail.trim()"
							@click="sendInvite"
						/>
					</div>
					<PendingInvitesList
						:invitations="pending"
						:loading="pendingLoading"
						@cancel="cancelInvitation"
					/>
				</template>

				<template v-else-if="current.id === 'uploads'">
					<h2 class="text-lg-semibold text-ink-gray-8">Upload Settings</h2>
					<p class="text-p-base text-ink-gray-6">
						The largest single file anyone can upload.
					</p>
					<MaxFileSizeField v-model="maxFileSize" />
				</template>

				<template v-else>
					<h2 class="text-lg-semibold text-ink-gray-8">Allowed File Formats</h2>
					<p class="text-p-base text-ink-gray-6">
						Uploads with any other extension are rejected.
					</p>
					<ExtensionsField v-model="extensions" />
				</template>

				<div class="flex items-center justify-between gap-2 pt-4">
					<Button label="Back" :disabled="step === 0" @click="step -= 1" />
					<div class="flex items-center gap-2">
						<Button
							v-if="current.id === 'team'"
							label="Skip"
							variant="ghost"
							@click="step += 1"
						/>
						<Button
							variant="solid"
							type="submit"
							:label="isLast ? 'Finish Setup' : 'Continue'"
							:loading="saving"
						/>
					</div>
				</div>
			</form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
	Button,
	FormControl,
	LoadingText,
	PageHeaderBase,
	PageHeaderTitle,
	toast,
	useCall,
	usePageMeta,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import ExtensionsField from '@/components/settings/ExtensionsField.vue'
import MaxFileSizeField from '@/components/settings/MaxFileSizeField.vue'
import PendingInvitesList from '@/components/settings/PendingInvitesList.vue'
import R2CredentialsForm from '@/components/settings/R2CredentialsForm.vue'
import {
	changedFields,
	DEFAULT_EXTENSIONS,
	DEFAULT_MAX_FILE_SIZE,
	r2FormFrom,
	useVmsSettings,
	type VmsSettingsDoc,
} from '@/components/settings/useVmsSettings'
import { useVmsUsers } from '@/components/settings/useVmsUsers'

usePageMeta(() => ({ title: 'Setup · VMS' }))

const STEPS = [
	{ id: 'storage', label: 'Storage' },
	{ id: 'team', label: 'Team' },
	{ id: 'uploads', label: 'Uploads' },
	{ id: 'formats', label: 'Formats' },
] as const

const step = ref(0)
const current = computed(() => STEPS[step.value] ?? STEPS[0])
const isLast = computed(() => step.value === STEPS.length - 1)

const { doc, save } = useVmsSettings()

const r2 = ref(r2FormFrom(null))
const maxFileSize = ref(DEFAULT_MAX_FILE_SIZE)
const extensions = ref<string[]>([])

watch(
	() => doc.doc,
	(value) => {
		if (!value) return
		r2.value = r2FormFrom(value)
		maxFileSize.value = value.max_file_size || DEFAULT_MAX_FILE_SIZE
		extensions.value = (value.allowed_extensions || DEFAULT_EXTENSIONS)
			.split(',')
			.map((e) => e.trim())
			.filter(Boolean)
	},
	{ immediate: true },
)

// Team step: the user list is not needed here, only invitations.
const { pending, pendingLoading, inviting, inviteByEmail, cancelInvitation } = useVmsUsers({
	withUsers: false,
})
const inviteEmail = ref('')

async function sendInvite() {
	if (await inviteByEmail(inviteEmail.value)) inviteEmail.value = ''
}

const completeSetup = useCall<{ status: string }>({
	url: '/api/v2/method/vms.api.complete_setup',
	method: 'POST',
	immediate: false,
})
const saving = computed(() => doc.setValue.loading || completeSetup.loading)

/** What the current step writes to VMS Settings. */
function stepValues(): Partial<VmsSettingsDoc> {
	switch (current.value.id) {
		case 'storage':
			return { ...r2.value }
		case 'uploads':
			return { max_file_size: maxFileSize.value }
		case 'formats':
			return { allowed_extensions: extensions.value.join(',') }
		default:
			return {}
	}
}

async function saveAndNext() {
	try {
		const changes = changedFields(doc.doc, stepValues())
		if (Object.keys(changes).length) await save(changes)
		if (!isLast.value) {
			step.value += 1
			return
		}
		await completeSetup.submit()
		toast.success('Setup complete!')
		// The router guard reads a cached setup status; a full load refetches it.
		window.location.assign('/vms')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to save')
	}
}
</script>
