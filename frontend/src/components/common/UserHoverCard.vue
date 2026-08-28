<template>
	<HoverCard>
		<template #trigger>
			<button type="button" class="rounded-full" :aria-label="name">
				<UserAvatar :user="user" :size="size" />
			</button>
		</template>
		<div class="flex items-center gap-3 p-3">
			<UserAvatar :user="user" size="xl" />
			<div class="min-w-0">
				<p class="truncate text-base-medium text-ink-gray-8">{{ name }}</p>
				<p v-if="user.user && user.user !== name" class="truncate text-sm text-ink-gray-5">
					{{ user.user }}
				</p>
			</div>
		</div>
	</HoverCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HoverCard, type AvatarProps } from 'frappe-ui'
import UserAvatar from '@/components/common/UserAvatar.vue'

const props = withDefaults(
	defineProps<{
		user: {
			user?: string
			user_full_name?: string
			full_name?: string
			user_image?: string | null
		}
		size?: AvatarProps['size']
	}>(),
	{ size: 'sm' },
)

const name = computed(
	() => props.user.user_full_name || props.user.full_name || props.user.user || '',
)
</script>
