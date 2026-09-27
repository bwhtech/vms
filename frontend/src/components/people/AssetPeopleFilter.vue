<template>
	<Popover v-if="people.length || modelValue" v-model:open="open" align="start">
		<template #trigger>
			<Button
				:variant="selected ? 'subtle' : 'outline'"
				aria-label="Filter by person"
				data-testid="people-filter"
			>
				<template #prefix>
					<FaceAvatar
						v-if="selected"
						:thumbnail="selected.cover_thumbnail"
						:box="selected.cover_box"
						size="sm"
					/>
					<span v-else class="lucide-scan-face size-4" aria-hidden="true" />
				</template>
				{{ selected ? displayName(selected) : 'People' }}
			</Button>
		</template>
		<template #default="{ close }">
			<div class="w-72 p-2">
				<div class="flex items-center justify-between px-1 pb-2">
					<span class="text-sm-medium text-ink-gray-7">People in this project</span>
					<Button
						v-if="modelValue"
						variant="ghost"
						size="sm"
						label="Clear"
						@click="pick(null, close)"
					/>
				</div>
				<div class="max-h-80 space-y-0.5 overflow-y-auto">
					<div
						v-for="person in people"
						:key="person.name"
						class="group flex items-center gap-1 rounded-3 pr-1 hover:bg-surface-gray-2"
						:class="person.name === modelValue ? 'bg-surface-gray-2' : ''"
					>
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1.5 text-left"
							:aria-pressed="person.name === modelValue"
							data-testid="people-filter-option"
							@click="pick(person.name, close)"
						>
							<FaceAvatar
								:thumbnail="person.cover_thumbnail"
								:box="person.cover_box"
							/>
							<span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
								{{ displayName(person) }}
							</span>
							<span class="text-sm text-ink-gray-5">{{ person.count }}</span>
						</button>
						<Button
							variant="ghost"
							size="sm"
							icon="lucide-pencil"
							class="opacity-0 focus:opacity-100 group-hover:opacity-100"
							:aria-label="`Name ${displayName(person)}`"
							@click="startRename(person, close)"
						/>
					</div>
				</div>
			</div>
		</template>
	</Popover>
	<RenamePersonDialog
		v-if="renaming"
		v-model:open="renameOpen"
		:person="renaming"
		@renamed="onRenamed"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Popover, useCall } from 'frappe-ui'
import type { ProjectPerson } from '@/types'
import FaceAvatar from './FaceAvatar.vue'
import RenamePersonDialog from './RenamePersonDialog.vue'

const props = defineProps<{ project: string; folder?: string | null; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const open = ref(false)
const renameOpen = ref(false)
const renaming = ref<ProjectPerson | null>(null)

const peopleCall = useCall<{ people: ProjectPerson[] }, { project: string; folder?: string }>({
	url: '/api/v2/method/vms.faces.get_project_people',
	method: 'GET',
	params: () => ({ project: props.project, folder: props.folder || undefined }),
	refetch: true,
	cacheKey: ['project-people', () => props.project, () => props.folder ?? 'root'],
})

const people = computed(() => peopleCall.data?.people ?? [])
const selected = computed(() => people.value.find((person) => person.name === props.modelValue))

function displayName(person: ProjectPerson) {
	return person.person_name || 'Unnamed'
}

function pick(person: string | null, close: () => void) {
	emit('update:modelValue', person === props.modelValue ? null : person)
	close()
}

function startRename(person: ProjectPerson, close: () => void) {
	renaming.value = person
	renameOpen.value = true
	close()
}

async function onRenamed(person: string) {
	if (props.modelValue && props.modelValue === renaming.value?.name) {
		emit('update:modelValue', person)
	}
	await peopleCall.reload()
}
</script>
