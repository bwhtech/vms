<template>
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-base-medium text-ink-gray-8">Max File Size</span>
			<span class="text-base tabular-nums text-ink-gray-7">{{
				formatFileSizeLimit(bytes)
			}}</span>
		</div>
		<Slider
			:model-value="[sliderGb]"
			aria-label="Max file size in GB"
			:min="2"
			:max="40"
			:step="2"
			@update:model-value="onSlide"
		/>
		<div class="flex items-center gap-2">
			<span class="whitespace-nowrap text-sm text-ink-gray-5">or exactly</span>
			<TextInput
				:model-value="customMb"
				type="number"
				class="w-28"
				aria-label="Max file size in MB"
				min="1"
				@update:model-value="onCustom"
			/>
			<span class="text-sm text-ink-gray-5">MB</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Slider, TextInput } from 'frappe-ui'
import { formatFileSizeLimit, GB, MB } from './useVmsSettings'

/** Upload size limit in bytes. Slider steps 2–40 GB; the input accepts any MB value. */
const bytes = defineModel<number>({ required: true })

const sliderGb = computed(() => Math.min(40, Math.max(2, Math.round(bytes.value / GB / 2) * 2)))
const customMb = computed(() => String(Math.round(bytes.value / MB)))

function onSlide(value: number[] | undefined) {
	const gb = value?.[0]
	if (gb) bytes.value = gb * GB
}

function onCustom(value: string | number) {
	const mb = Number(value)
	if (Number.isFinite(mb) && mb > 0) bytes.value = Math.round(mb) * MB
}
</script>
