<template>
	<FrappeUIProvider>
		<router-view />
	</FrappeUIProvider>
</template>

<script setup lang="ts">
import { FrappeUIProvider, useColorScheme } from 'frappe-ui'

// Applies the stored theme before anything paints. Lives here, not in
// AppShell, so the guest pages rendered outside the shell get it too.
useColorScheme()
</script>
