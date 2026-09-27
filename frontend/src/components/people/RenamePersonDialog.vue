<template>
	<Dialog
		:open="open"
		title="Name this person"
		size="sm"
		:actions="[{ label: 'Save', variant: 'solid', onClick: submit }, { label: 'Cancel' }]"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<div class="flex justify-center">
				<FaceAvatar :thumbnail="person.cover_thumbnail" :box="person.cover_box" size="lg" />
			</div>
			<FormControl
				v-model="personName"
				label="Name"
				description="Using a name that's already taken merges the two people."
				autofocus
				:error="rename.error?.message"
				@keydown.enter="submit({ close: closeDialog })"
			/>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, FormControl, toast, useCall } from 'frappe-ui'
import type { ProjectPerson } from '@/types'
import FaceAvatar from './FaceAvatar.vue'

const props = defineProps<{ open: boolean; person: ProjectPerson }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; renamed: [person: string] }>()

const personName = ref(props.person.person_name ?? '')

watch(
	() => props.open,
	(open) => {
		if (open) personName.value = props.person.person_name ?? ''
	},
)

const rename = useCall<
	{ person: string; merged: boolean },
	{ person: string; person_name: string }
>({
	url: '/api/v2/method/vms.faces.rename_person',
	method: 'POST',
	immediate: false,
})

function closeDialog() {
	emit('update:open', false)
}

async function submit({ close }: { close: () => void }) {
	const value = personName.value.trim()
	if (value === (props.person.person_name ?? '')) return close()
	const result = await rename.submit({ person: props.person.name, person_name: value })
	toast.success(result?.merged ? `Merged into “${value}”` : 'Name saved')
	emit('renamed', result?.person ?? props.person.name)
	close()
}
</script>
