<template>
	<div v-if="loading" class="space-y-2">
		<SkeletonLines :lines="2" />
	</div>
	<List
		v-else-if="invitations.length"
		:columns="['minmax(0,1fr)']"
		:row-height="52"
		data-testid="pending-invitations"
	>
		<ListRow v-for="invitation in invitations" :key="invitation.name" :value="invitation.name">
			<div class="flex w-full items-center gap-3">
				<Avatar :label="invitation.email" size="sm" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-base text-ink-gray-8">{{ invitation.email }}</p>
					<p class="text-sm text-ink-gray-5">Invitation pending</p>
				</div>
				<Badge label="Pending" theme="amber" variant="subtle" />
				<Button
					icon="lucide-x"
					variant="ghost"
					:aria-label="`Cancel invitation to ${invitation.email}`"
					@click="emit('cancel', invitation)"
				/>
			</div>
		</ListRow>
	</List>
	<p v-else class="text-base text-ink-gray-5">No pending invitations.</p>
</template>

<script setup lang="ts">
import { Avatar, Badge, Button } from 'frappe-ui'
import { List, ListRow } from 'frappe-ui/list'
import type { PendingInvitation } from './useVmsUsers'
import SkeletonLines from '@/components/common/SkeletonLines.vue'

defineProps<{ invitations: PendingInvitation[]; loading: boolean }>()
const emit = defineEmits<{ cancel: [invitation: PendingInvitation] }>()
</script>
