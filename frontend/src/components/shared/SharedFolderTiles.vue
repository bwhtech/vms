<template>
	<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
		<button
			v-for="folder in folders"
			:key="folder.name"
			type="button"
			class="group flex items-center gap-3 rounded-5 border border-outline-gray-1 bg-surface-base p-3 text-left transition hover:border-outline-gray-2 hover:shadow-sm"
			data-testid="shared-folder-tile"
			@click="$emit('open', folder)"
		>
			<span
				class="lucide-folder grid size-10 shrink-0 place-items-center rounded-4 bg-surface-gray-2 text-xl text-ink-gray-6"
				aria-hidden="true"
			/>
			<p
				class="min-w-0 flex-1 truncate text-base text-ink-gray-8"
				:title="folder.folder_name"
			>
				{{ folder.folder_name }}
			</p>
		</button>
	</div>
</template>

<script setup lang="ts">
export interface SharedFolderTile {
	name: string
	folder_name: string
}

defineProps<{ folders: SharedFolderTile[] }>()
defineEmits<{ open: [folder: SharedFolderTile] }>()
</script>
