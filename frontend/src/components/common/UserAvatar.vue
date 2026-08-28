<template>
	<Avatar :size="size" :image="user.user_image ?? undefined" :label="user.full_name" />
</template>

<script setup lang="ts">
import { Avatar, type AvatarProps } from 'frappe-ui'

withDefaults(
	defineProps<{
		user: { full_name: string; user_image?: string | null }
		size?: AvatarProps['size']
	}>(),
	{ size: 'sm' },
)
</script>
