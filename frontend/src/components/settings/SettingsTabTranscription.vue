<template>
	<SettingsPanel value="transcription">
		<SettingsHeader title="Transcription" description="AI transcription for video assets.">
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
				<LoadingText />
			</div>
			<div v-else class="space-y-11 pt-6">
				<section>
					<div class="divide-y divide-outline-gray-1">
						<SettingsRow
							title="Provider"
							description="Which service turns speech into text."
						>
							<Select v-model="provider" :options="PROVIDERS" class="w-56" />
						</SettingsRow>
						<SettingsRow
							v-if="provider === 'whisper.cpp'"
							title="Whisper model"
							description="Larger models are slower but more accurate. Downloaded on first use."
						>
							<Select v-model="whisperModel" :options="WHISPER_MODELS" class="w-56" />
						</SettingsRow>
					</div>
				</section>

				<section v-if="provider === 'OpenAI Whisper'" class="space-y-4">
					<h3 class="text-lg-semibold text-ink-gray-8">OpenAI</h3>
					<FormControl
						v-model="openaiKey"
						type="password"
						label="API key"
						placeholder="sk-…"
					/>
				</section>
				<section v-else-if="provider === 'Deepgram'" class="space-y-4">
					<h3 class="text-lg-semibold text-ink-gray-8">Deepgram</h3>
					<FormControl
						v-model="deepgramKey"
						type="password"
						label="API key"
						description="Deepgram adds speaker labels to the transcript."
					/>
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
	LoadingText,
	Select,
	SettingsBody,
	SettingsHeader,
	SettingsPanel,
	SettingsRow,
	toast,
} from 'frappe-ui'
import { serverMessage } from '@/lib/format'
import { changedFields, useVmsSettings, type VmsSettingsDoc } from './useVmsSettings'

const PROVIDERS = [
	{ label: 'OpenAI Whisper', value: 'OpenAI Whisper' },
	{ label: 'Deepgram (speaker diarization)', value: 'Deepgram' },
	{ label: 'whisper.cpp (local)', value: 'whisper.cpp' },
]

const WHISPER_MODELS = ['ggml-small.en', 'ggml-base.en', 'ggml-medium.en', 'ggml-large'].map(
	(value) => ({ label: value, value }),
)

const { doc, save: saveSettings } = useVmsSettings()

const provider = ref('OpenAI Whisper')
const whisperModel = ref('ggml-small.en')
const openaiKey = ref('')
const deepgramKey = ref('')

watch(
	() => doc.doc,
	(value) => {
		if (!value) return
		provider.value = value.transcription_provider || 'OpenAI Whisper'
		whisperModel.value = value.whisper_model || 'ggml-small.en'
		openaiKey.value = value.openai_api_key || ''
		deepgramKey.value = value.deepgram_api_key || ''
	},
	{ immediate: true },
)

const form = computed<Partial<VmsSettingsDoc>>(() => ({
	transcription_provider: provider.value,
	whisper_model: whisperModel.value,
	openai_api_key: openaiKey.value,
	deepgram_api_key: deepgramKey.value,
}))
const changes = computed(() => changedFields(doc.doc, form.value))
const isDirty = computed(() => Object.keys(changes.value).length > 0)
const saving = computed(() => doc.setValue.loading)

async function save() {
	try {
		await saveSettings(changes.value)
		toast.success('Transcription settings saved')
	} catch (error) {
		toast.error(serverMessage(error) || 'Failed to save settings')
	}
}
</script>
