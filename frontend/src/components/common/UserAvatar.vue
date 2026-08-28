<template>
	<Avatar :size="size" :image="user.user_image ?? undefined" :label="label" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, type AvatarProps } from 'frappe-ui'

const props = withDefaults(
	defineProps<{
		user: {
			full_name?: string
			user_full_name?: string
			user?: string
			user_image?: string | null
		}
		size?: AvatarProps['size']
	}>(),
	{ size: 'sm' },
)

const label = computed(
	() => props.user.full_name || props.user.user_full_name || props.user.user || '',
)
</script>
