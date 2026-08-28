<template>
	<!-- frappe-ui's dialog lists every shortcut registered through
	     `useKeyboardShortcut` on the current page. The video player keys live
	     in `useVideoPlayer` on the review page, outside the shell, so they are
	     appended here as a static group. -->
	<FrappeKeyboardShortcutsDialog v-model:open="shortcutsOpen">
		<template #default="{ groups }">
			<div
				class="grid max-h-[70vh] grid-cols-1 gap-8 gap-x-6 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3"
				data-slot="groups"
				data-testid="shortcuts-groups"
			>
				<div
					v-for="group in withPlayerGroup(groups)"
					:key="group.name"
					class="space-y-1"
					data-slot="group"
				>
					<h3
						class="mb-3 text-base-medium tracking-wide text-ink-gray-8"
						data-slot="group-title"
					>
						{{ group.name }}
					</h3>
					<div
						v-for="shortcut in group.shortcuts"
						:key="shortcut.description"
						class="grid grid-cols-[1fr_auto] items-start gap-3 rounded-4 py-0.5"
						data-slot="shortcut"
					>
						<span class="text-p-base text-ink-gray-6" data-slot="description">
							{{ shortcut.description }}
						</span>
						<div class="flex shrink-0 items-center gap-1.5" data-slot="shortcut-keys">
							<KeyboardShortcut
								:combo="shortcut.combo"
								:alt-combos="shortcut.altCombos"
								bg
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
	</FrappeKeyboardShortcutsDialog>
</template>

<script setup lang="ts">
import {
	KeyboardShortcut,
	KeyboardShortcutsDialog as FrappeKeyboardShortcutsDialog,
	type KeyboardShortcutGroup,
} from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'

const { shortcutsOpen } = useOverlays()

const PLAYER_GROUP: KeyboardShortcutGroup = {
	name: 'Video player',
	shortcuts: [
		{ combo: 'Space', altCombos: ['K'], description: 'Play / pause', group: 'Video player' },
		{ combo: 'ArrowLeft', altCombos: ['J'], description: 'Seek back', group: 'Video player' },
		{
			combo: 'ArrowRight',
			altCombos: ['L'],
			description: 'Seek forward',
			group: 'Video player',
		},
		{ combo: 'F', altCombos: [], description: 'Toggle fullscreen', group: 'Video player' },
		{ combo: 'M', altCombos: [], description: 'Mute / unmute', group: 'Video player' },
		{
			combo: 'C',
			altCombos: [],
			description: 'Add comment at current time',
			group: 'Video player',
		},
	],
}

/** Registered groups first, the static player group last, once. */
function withPlayerGroup(groups: KeyboardShortcutGroup[]): KeyboardShortcutGroup[] {
	return [...groups.filter((group) => group.name !== PLAYER_GROUP.name), PLAYER_GROUP]
}
</script>
