<template>
	<div class="flex items-center gap-1 px-2 py-1.5 text-ink-gray-7">
		<Button
			variant="ghost"
			icon="lucide-rotate-ccw"
			aria-label="Skip back 10 seconds"
			@click="$emit('skip-backward')"
		/>
		<Button
			variant="ghost"
			:icon="isPlaying ? 'lucide-pause' : 'lucide-play'"
			:aria-label="isPlaying ? 'Pause' : 'Play'"
			@click="$emit('toggle-play')"
		/>
		<Button
			variant="ghost"
			icon="lucide-rotate-cw"
			aria-label="Skip forward 10 seconds"
			@click="$emit('skip-forward')"
		/>

		<div class="hidden items-center gap-2 md:flex">
			<Button
				variant="ghost"
				:icon="volumeIcon"
				:aria-label="isMuted ? 'Unmute' : 'Mute'"
				@click="$emit('toggle-mute')"
			/>
			<Slider
				v-model="volumeModel"
				bare
				:min="0"
				:max="100"
				:step="1"
				class="w-20"
				aria-label="Volume"
			/>
		</div>

		<span class="mx-1 select-none font-mono text-xs text-ink-gray-5">
			{{ formatTimecode(currentTime) }} / {{ formatTimecode(duration) }}
		</span>

		<div class="ml-auto flex items-center gap-1">
			<Dropdown :options="speedOptions">
				<Button
					variant="ghost"
					:label="`${playbackRate}x`"
					class="hidden font-mono md:inline-flex"
				/>
			</Dropdown>
			<Button
				variant="ghost"
				icon="lucide-repeat"
				aria-label="Toggle loop"
				:class="isLooping ? 'text-ink-gray-9' : 'text-ink-gray-5'"
				class="hidden md:inline-flex"
				@click="$emit('toggle-loop')"
			/>
			<Button
				variant="ghost"
				:icon="isFullscreen ? 'lucide-minimize' : 'lucide-maximize'"
				:aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
				@click="$emit('toggle-fullscreen')"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Dropdown, Slider } from 'frappe-ui'
import { formatTimecode } from '@/composables/useVideoPlayer'

const props = defineProps<{
	isPlaying: boolean
	currentTime: number
	duration: number
	volume: number
	isMuted: boolean
	playbackRate: number
	isLooping: boolean
	isFullscreen: boolean
}>()

const emit = defineEmits<{
	'toggle-play': []
	'toggle-mute': []
	'volume-change': [volume: number]
	'playback-rate-change': [rate: number]
	'toggle-loop': []
	'toggle-fullscreen': []
	'skip-backward': []
	'skip-forward': []
}>()

const volumeModel = computed<number[]>({
	get: () => [props.isMuted ? 0 : Math.round(props.volume * 100)],
	set: ([value]) => emit('volume-change', (value ?? 0) / 100),
})

const volumeIcon = computed(() => {
	if (props.isMuted || props.volume === 0) return 'lucide-volume-x'
	return props.volume < 0.5 ? 'lucide-volume-1' : 'lucide-volume-2'
})

const speedOptions = [0.5, 1, 1.5, 2].map((rate) => ({
	label: `${rate}x`,
	icon: rate === props.playbackRate ? 'lucide-check' : undefined,
	onClick: () => emit('playback-rate-change', rate),
}))
</script>
