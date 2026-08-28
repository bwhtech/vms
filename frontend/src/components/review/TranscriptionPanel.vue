<template>
	<SidePanel v-model:open="review.panels.transcription.value" title="Transcription">
		<template #actions>
			<Button
				v-if="status === 'Complete'"
				variant="ghost"
				icon="lucide-refresh-cw"
				aria-label="Refresh transcription"
				:loading="transcription.loading"
				@click="transcription.reload"
			/>
		</template>

		<div v-if="transcription.loading && !loaded" class="space-y-3 p-4" aria-busy="true">
			<div v-for="n in 5" :key="n" class="flex gap-3">
				<Skeleton class="h-3 w-10 shrink-0 rounded" />
				<Skeleton class="h-3 flex-1 rounded" />
			</div>
		</div>
		<EmptyState
			v-else-if="status === 'Processing'"
			title="Generating transcription"
			description="This can take a few minutes. The transcript refreshes automatically."
		>
			<template #icon>
				<span class="lucide-audio-lines size-6 text-ink-gray-5" aria-hidden="true" />
			</template>
		</EmptyState>
		<EmptyState
			v-else-if="status === 'Error'"
			title="Transcription failed"
			:description="content || undefined"
		>
			<template #icon>
				<span class="lucide-circle-alert size-6 text-ink-red-6" aria-hidden="true" />
			</template>
			<template #actions>
				<Button
					variant="solid"
					icon-left="lucide-refresh-cw"
					label="Retry"
					:loading="start.loading"
					@click="startTranscription"
				/>
			</template>
		</EmptyState>
		<div v-else-if="status === 'Complete'" class="space-y-4 p-4">
			<FormControl
				v-if="segments.length > 6"
				v-model="query"
				placeholder="Search transcription"
				:aria-label="'Search transcription'"
			>
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
			</FormControl>

			<div v-if="speakers.length" class="rounded border border-outline-gray-2 p-3">
				<p class="text-sm-medium text-ink-gray-7">Speakers</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<Button
						v-for="speaker in speakers"
						:key="speaker"
						variant="subtle"
						icon-right="lucide-pencil"
						:label="speakerLabel(speaker)"
						@click="renameSpeaker(speaker)"
					/>
				</div>
			</div>

			<List :columns="['minmax(0,1fr)']" divider="inset">
				<ListRow
					v-for="(segment, index) in visibleSegments"
					:key="`${segment.time}-${index}`"
					:value="`${segment.time}-${index}`"
				>
					<ListCell class="py-3">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<Button
									variant="subtle"
									theme="blue"
									:label="segment.timestamp"
									@click="review.seekTo(segment.time)"
								/>
								<button
									v-if="segment.speaker"
									class="truncate text-sm-medium text-ink-gray-7 hover:text-ink-gray-9"
									@click="renameSpeaker(segment.speaker)"
								>
									{{ speakerLabel(segment.speaker) }}
								</button>
							</div>
							<p class="mt-2 whitespace-pre-wrap text-p-sm leading-5 text-ink-gray-8">
								{{ segment.text }}
							</p>
						</div>
					</ListCell>
				</ListRow>
			</List>
			<p
				v-if="visibleSegments.length === 0"
				class="py-10 text-center text-p-sm text-ink-gray-5"
			>
				No matching transcript text.
			</p>
		</div>
		<EmptyState
			v-else
			icon="lucide-captions"
			title="No transcription yet"
			description="Generate a timestamped transcript for this asset."
		>
			<template #actions>
				<Button
					variant="solid"
					icon-left="lucide-wand-sparkles"
					label="Generate transcription"
					:loading="start.loading"
					@click="startTranscription"
				/>
			</template>
		</EmptyState>
	</SidePanel>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Button, FormControl, Skeleton, dialog, toast, useCall } from 'frappe-ui'
import { List, ListCell, ListRow } from 'frappe-ui/list'
import EmptyState from '@/components/common/EmptyState.vue'
import SidePanel from '@/components/common/SidePanel.vue'
import { useReview } from '@/composables/useReview'
import type { Transcription, TranscriptionStatus } from '@/types'

interface TranscriptSegment {
	timestamp: string
	time: number
	speaker: string
	text: string
}

const review = useReview()
const assetName = review.asset.value?.name ?? ''
const status = ref<TranscriptionStatus>(
	(review.asset.value?.transcription_status as TranscriptionStatus) || '',
)
const content = ref('')
const speakerNames = ref<Record<string, string>>({})
const loaded = ref(false)
const query = ref('')

const transcription = useCall<Transcription, { asset_name: string }>({
	url: '/api/v2/method/vms.transcription.get_transcription',
	method: 'GET',
	params: { asset_name: assetName },
	cacheKey: ['transcription', assetName],
	onSuccess: applyTranscription,
})
const start = useCall<unknown, { asset_name: string }>({
	url: '/api/v2/method/vms.transcription.start_transcription',
	method: 'POST',
	immediate: false,
})
const saveNames = useCall<unknown, { asset_name: string; speaker_names: string }>({
	url: '/api/v2/method/vms.transcription.save_speaker_names',
	method: 'POST',
	immediate: false,
})

const segments = computed(() => parseTranscription(content.value))
const speakers = computed(() =>
	[...new Set(segments.value.map((segment) => segment.speaker).filter(Boolean))].sort(
		(a, b) => Number(a) - Number(b),
	),
)
const visibleSegments = computed(() => {
	const needle = query.value.trim().toLocaleLowerCase()
	if (!needle) return segments.value
	return segments.value.filter(
		(segment) =>
			segment.text.toLocaleLowerCase().includes(needle) ||
			speakerLabel(segment.speaker).toLocaleLowerCase().includes(needle),
	)
})

let pollTimer: ReturnType<typeof setInterval> | null = null

watch(
	() => review.panels.transcription.value,
	(open) => {
		if (open) void transcription.reload()
		else query.value = ''
	},
)
watch(
	status,
	(value) => {
		if (value === 'Processing') startPolling()
		else stopPolling()
	},
	{ immediate: true },
)

async function startTranscription() {
	try {
		await start.submit({ asset_name: assetName })
		status.value = 'Processing'
		content.value = ''
		startPolling()
		review.reload()
		void transcription.reload()
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Could not start transcription')
	}
}

function renameSpeaker(speaker: string) {
	dialog.prompt({
		title: `Rename Speaker ${speaker}`,
		fields: [
			{
				name: 'name',
				label: 'Display name',
				defaultValue: speakerNames.value[speaker] ?? `Speaker ${speaker}`,
				placeholder: `Speaker ${speaker}`,
			},
		],
		confirmLabel: 'Save',
		onConfirm: async ({ values }) => {
			const previous = speakerNames.value
			const next = { ...previous }
			const name = String(values.name ?? '').trim()
			if (name && name !== `Speaker ${speaker}`) next[speaker] = name
			else delete next[speaker]
			speakerNames.value = next
			try {
				await saveNames.submit({
					asset_name: assetName,
					speaker_names: JSON.stringify(next),
				})
				toast.success('Speaker name saved')
			} catch (error) {
				speakerNames.value = previous
				throw error
			}
		},
	})
}

function applyTranscription(data: Transcription) {
	status.value = data.transcription_status
	content.value = data.transcription
	speakerNames.value = data.speaker_names ?? {}
	loaded.value = true
	if (data.transcription_status === 'Complete' || data.transcription_status === 'Error') {
		stopPolling()
		review.reload()
	}
}

function startPolling() {
	if (pollTimer) return
	pollTimer = setInterval(() => void transcription.reload(), 5000)
}

function stopPolling() {
	if (!pollTimer) return
	clearInterval(pollTimer)
	pollTimer = null
}

function speakerLabel(speaker: string): string {
	return speakerNames.value[speaker] || `Speaker ${speaker}`
}

function parseTranscription(markdown: string): TranscriptSegment[] {
	return markdown
		.split(/\n\s*\n/)
		.map((block) => {
			const match = block
				.trim()
				.match(/^\*\*\[([\d:]+)\]\*\*\s*(?:\*\*Speaker (\d+):\*\*\s*)?([\s\S]*)$/)
			if (!match) return null
			return {
				timestamp: match[1],
				time: timestampSeconds(match[1]),
				speaker: match[2] ?? '',
				text: match[3].trim(),
			}
		})
		.filter((segment): segment is TranscriptSegment => Boolean(segment))
}

function timestampSeconds(timestamp: string): number {
	return timestamp
		.split(':')
		.map(Number)
		.reduce((total, part) => total * 60 + part, 0)
}

onScopeDispose(stopPolling)
</script>
