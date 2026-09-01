<template>
	<MobileNav>
		<MobileNavItem label="Home" icon="lucide-home" to="/" />
		<MobileNavItem label="Projects" icon="lucide-folder" to="/projects" />
		<MobileNavItem label="Inbox" icon="lucide-inbox" to="/uncategorised" />
		<MobileNavItem label="You" @click="sheetOpen = true">
			<Avatar
				size="sm"
				:image="user?.user_image ?? undefined"
				:label="user?.full_name ?? ''"
			/>
		</MobileNavItem>
	</MobileNav>

	<BottomSheet v-model:open="sheetOpen" title="You">
		<div class="flex flex-col gap-1 pb-4">
			<button
				v-for="item in menu"
				:key="item.label"
				class="flex items-center gap-3 rounded-4 px-3 py-2.5 text-left text-base text-ink-gray-8 hover:bg-surface-gray-2"
				@click="run(item.onClick)"
			>
				<span :class="[item.icon, 'size-4 text-ink-gray-6']" aria-hidden="true" />
				{{ item.label }}
			</button>
		</div>
	</BottomSheet>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, BottomSheet, MobileNav, MobileNavItem } from 'frappe-ui'
import { useOverlays } from '@/composables/useOverlays'
import { useSession } from '@/composables/useSession'

const router = useRouter()
const { user, logout } = useSession()
const { notificationsOpen, openSettings } = useOverlays()

const sheetOpen = ref(false)

interface SheetItem {
	label: string
	icon: string
	onClick: () => void
}

// Everything the desktop sidebar keeps under "More" and in the header menu.
const menu: SheetItem[] = [
	{
		label: 'Notifications',
		icon: 'lucide-bell',
		onClick: () => {
			notificationsOpen.value = true
		},
	},
	{ label: 'Trash', icon: 'lucide-trash-2', onClick: () => router.push('/trash') },
	{ label: 'Audit log', icon: 'lucide-scroll-text', onClick: () => router.push('/audit-logs') },
	{ label: 'Settings', icon: 'lucide-settings', onClick: () => openSettings('profile') },
	{ label: 'Log out', icon: 'lucide-log-out', onClick: () => logout() },
]

function run(action: () => void) {
	sheetOpen.value = false
	action()
}
</script>
