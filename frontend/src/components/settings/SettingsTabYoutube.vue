<template>
	<SettingsPanel value="youtube">
		<SettingsHeader title="YouTube" description="Publish assets straight to your channels.">
			<template #actions>
				<Button
					v-if="channels.length && hasCredentials && !editingCredentials"
					label="Add channel"
					icon-left="lucide-plus"
					:loading="connecting"
					@click="startConnect()"
				/>
			</template>
		</SettingsHeader>
		<SettingsBody>
			<div v-if="loading || finalizing" class="space-y-3 pt-6">
				<SkeletonLines :lines="3" />
				<p v-if="finalizing" class="text-base text-ink-gray-5">Finishing the connection…</p>
			</div>
			<div v-else class="space-y-11 pt-6">
				<section v-if="channels.length">
					<h3 class="text-lg-semibold text-ink-gray-8">Connected channels</h3>
					<div class="divide-y divide-outline-gray-1" data-testid="youtube-channels">
						<SettingsRow
							v-for="channel in channels"
							:key="channel.name"
							:title="channel.channel_name"
							:description="channelDescription(channel)"
						>
							<div class="flex items-center gap-3">
								<Badge
									v-if="channel.is_default"
									label="Default"
									theme="blue"
									variant="subtle"
								/>
								<Button v-else label="Make default" @click="setDefault(channel)" />
								<Button
									icon="lucide-trash-2"
									variant="ghost"
									theme="red"
									:aria-label="`Remove ${channel.channel_name}`"
									@click="confirmRemoveChannel(channel)"
								/>
							</div>
						</SettingsRow>
					</div>
				</section>

				<section v-if="showCredentialsForm" class="space-y-4">
					<div>
						<h3 class="text-lg-semibold text-ink-gray-8">
							{{ channels.length ? 'Replace credentials' : 'Connect a channel' }}
						</h3>
						<p class="mt-1 text-base text-ink-gray-6">
							Create an OAuth client in Google Cloud Console with the redirect URI
							below, then paste its credentials here.
						</p>
					</div>
					<FormControl
						:model-value="redirectUri"
						label="Redirect URI"
						description="Add this to the OAuth client's authorised redirect URIs."
						readonly
					>
						<template #suffix>
							<button
								type="button"
								class="text-ink-gray-5 hover:text-ink-gray-8"
								aria-label="Copy redirect URI"
								@click="copyRedirect"
							>
								<span class="lucide-copy size-4" aria-hidden="true" />
							</button>
						</template>
					</FormControl>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormControl v-model="clientId" label="Client ID" required />
						<FormControl
							v-model="clientSecret"
							type="password"
							label="Client Secret"
							required
						/>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="solid"
							label="Connect YouTube"
							icon-left="lucide-external-link"
							:loading="connecting"
							:disabled="!clientId.trim() || !clientSecret.trim()"
							@click="
								startConnect({
									client_id: clientId.trim(),
									client_secret: clientSecret.trim(),
								})
							"
						/>
						<Button
							v-if="editingCredentials"
							label="Cancel"
							@click="editingCredentials = false"
						/>
					</div>
				</section>

				<section v-else-if="!channels.length" class="space-y-4">
					<div>
						<h3 class="text-lg-semibold text-ink-gray-8">Connect a channel</h3>
						<p class="mt-1 text-base text-ink-gray-6">
							Credentials are already saved — sign in with Google to pick the channel.
						</p>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="solid"
							label="Connect YouTube"
							icon-left="lucide-external-link"
							:loading="connecting"
							@click="startConnect()"
						/>
						<Button
							label="Use different credentials"
							@click="editingCredentials = true"
						/>
					</div>
				</section>

				<section v-if="channels.length">
					<h3 class="text-lg-semibold text-ink-gray-8">Danger zone</h3>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							v-if="!editingCredentials"
							title="Replace credentials"
							description="Point VMS at a different Google Cloud OAuth client."
						>
							<Button label="Edit credentials" @click="editingCredentials = true" />
						</SettingsRow>
						<SettingsRow
							title="Disconnect YouTube"
							description="Removes every channel and the saved credentials."
						>
							<Button theme="red" label="Disconnect" @click="confirmDisconnectAll" />
						</SettingsRow>
					</div>
				</section>
			</div>
		</SettingsBody>
	</SettingsPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
	Badge,
	Button,
	FormControl,
	SettingsBody,
	SettingsHeader,
	SettingsPanel,
	SettingsRow,
	toast,
} from 'frappe-ui'
import { useYoutube, type YoutubeChannel } from './useYoutube'
import SkeletonLines from '@/components/common/SkeletonLines.vue'

const route = useRoute()
const router = useRouter()

const {
	channels,
	hasCredentials,
	loading,
	redirectUri,
	connecting,
	finalizing,
	startConnect,
	finalize,
	confirmRemoveChannel,
	confirmDisconnectAll,
	setDefault,
} = useYoutube()

const clientId = ref('')
const clientSecret = ref('')
const editingCredentials = ref(false)

const showCredentialsForm = computed(
	() => editingCredentials.value || (!channels.value.length && !hasCredentials.value),
)

function channelDescription(channel: YoutubeChannel) {
	const assets = `${channel.asset_count} ${channel.asset_count === 1 ? 'asset' : 'assets'}`
	return `${assets} · connected by ${channel.connected_by}`
}

async function copyRedirect() {
	try {
		await navigator.clipboard.writeText(redirectUri.value)
		toast.success('Redirect URI copied')
	} catch {
		toast.error('Could not copy the redirect URI')
	}
}

// Google sends the browser back with `?youtube_connected=1` (the shell has
// already consumed `?settings=youtube`). Strip it so a reload cannot finalize twice.
onMounted(() => {
	if (route.query.youtube_connected !== '1') return
	const query = { ...route.query }
	delete query.youtube_connected
	void router.replace({ query })
	void finalize()
})
</script>
