<template>
	<SettingsPanel value="users">
		<SettingsHeader title="Users" description="Everyone with the Video Manager role.">
			<template #actions>
				<Button
					v-if="isSystemManager"
					variant="solid"
					label="Invite user"
					icon-left="lucide-user-plus"
					:loading="inviting"
					data-testid="invite-user"
					@click="promptInvite"
				/>
			</template>
		</SettingsHeader>
		<SettingsBody>
			<div class="space-y-11 pt-6">
				<section class="space-y-3">
					<div v-if="usersLoading" class="space-y-2">
						<LoadingText />
						<LoadingText />
					</div>
					<List
						v-else-if="users.length"
						:columns="['minmax(0,1fr)']"
						:row-height="56"
						data-testid="vms-users"
					>
						<ListRow v-for="user in users" :key="user.name" :value="user.name">
							<div class="flex w-full items-center gap-3">
								<UserAvatar :user="user" size="md" />
								<div class="min-w-0 flex-1">
									<p class="truncate text-base text-ink-gray-8">
										{{ user.full_name }}
									</p>
									<p class="truncate text-sm text-ink-gray-5">{{ user.email }}</p>
								</div>
								<span v-if="user.last_active" class="text-sm text-ink-gray-5">
									Active <RelativeTime :date="user.last_active" />
								</span>
							</div>
						</ListRow>
					</List>
					<EmptyState
						v-else
						icon="lucide-users"
						title="No users yet"
						description="Invite someone to give them the Video Manager role."
					/>
				</section>

				<section v-if="isSystemManager" class="space-y-3">
					<h3 class="text-lg-semibold text-ink-gray-8">Pending invitations</h3>
					<PendingInvitesList
						:invitations="pending"
						:loading="pendingLoading"
						@cancel="cancelInvitation"
					/>
				</section>
			</div>
		</SettingsBody>
	</SettingsPanel>
</template>

<script setup lang="ts">
import { Button, LoadingText, SettingsBody, SettingsHeader, SettingsPanel } from 'frappe-ui'
import { List, ListRow } from 'frappe-ui/list'
import { useSession } from '@/composables/useSession'
import EmptyState from '@/components/common/EmptyState.vue'
import RelativeTime from '@/components/common/RelativeTime.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import PendingInvitesList from './PendingInvitesList.vue'
import { useVmsUsers } from './useVmsUsers'

const { isSystemManager } = useSession()
const { users, usersLoading, pending, pendingLoading, inviting, promptInvite, cancelInvitation } =
	useVmsUsers()
</script>
