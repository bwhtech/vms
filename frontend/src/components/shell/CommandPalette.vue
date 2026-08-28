<template>
	<!-- Server search decides which assets and projects match, so the client
	     filter is off and the static commands are narrowed by hand. -->
	<CommandPalette
		v-model:open="commandPaletteOpen"
		v-model:query="query"
		:filterable="false"
		title="Search"
		@select="run"
	>
		<CommandPaletteInput :placeholder="placeholder" />

		<CommandPaletteList>
			<CommandPaletteGroup v-if="assetResults.length" :label="assetGroupLabel">
				<CommandPaletteItem
					v-for="asset in assetResults"
					:key="asset.name"
					:value="{ kind: 'asset', name: asset.name }"
					:data-value="`file-${asset.name}`"
					data-testid="palette-asset"
				>
					<template #prefix>
						<span :class="[fileIcon(asset.file_type), 'mr-2 size-4 text-ink-gray-5']" />
					</template>
					{{ asset.file_name }}
					<template #suffix>
						<span class="text-xs text-ink-gray-5">
							<template v-if="!currentProjectId && asset.project_name">
								in {{ asset.project_name }}
							</template>
							<template v-if="asset.category"> · {{ asset.category }}</template>
						</span>
					</template>
				</CommandPaletteItem>
			</CommandPaletteGroup>

			<CommandPaletteGroup v-if="projectResults.length" label="Projects">
				<CommandPaletteItem
					v-for="project in projectResults"
					:key="project.name"
					:value="{ kind: 'project', name: project.name }"
					:data-value="`project-${project.name}`"
					data-testid="palette-project"
				>
					<template #prefix>
						<span class="lucide-folder mr-2 size-4 text-ink-gray-5" />
					</template>
					{{ project.project_name }}
					<template v-if="project.status" #suffix>
						<span class="text-xs text-ink-gray-5">{{ project.status }}</span>
					</template>
				</CommandPaletteItem>
			</CommandPaletteGroup>

			<CommandPaletteGroup v-if="navigation.length" label="Navigation">
				<CommandPaletteItem
					v-for="command in navigation"
					:key="command.id"
					:value="command"
					:data-value="command.id"
				>
					<template #prefix>
						<span :class="[command.icon, 'mr-2 size-4 text-ink-gray-5']" />
					</template>
					{{ command.label }}
				</CommandPaletteItem>
			</CommandPaletteGroup>

			<CommandPaletteGroup v-if="actions.length" label="Actions">
				<CommandPaletteItem
					v-for="command in actions"
					:key="command.id"
					:value="command"
					:data-value="command.id"
				>
					<template #prefix>
						<span :class="[command.icon, 'mr-2 size-4 text-ink-gray-5']" />
					</template>
					{{ command.label }}
					<template v-if="command.combo" #suffix>
						<KeyboardShortcut :combo="command.combo" />
					</template>
				</CommandPaletteItem>
			</CommandPaletteGroup>
		</CommandPaletteList>

		<CommandPaletteEmpty>
			{{ searching ? 'Searching…' : 'No results found.' }}
		</CommandPaletteEmpty>

		<CommandPaletteFooter>
			<KeyboardShortcut combo="Enter" /> to run · <KeyboardShortcut combo="Escape" /> to close
		</CommandPaletteFooter>
	</CommandPalette>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KeyboardShortcut, useCall, type KeyboardShortcutCombo } from 'frappe-ui'
import {
	CommandPalette,
	CommandPaletteEmpty,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteList,
	type CommandPaletteValue,
} from 'frappe-ui/experimental'
import { useOverlays } from '@/composables/useOverlays'

interface AssetResult {
	name: string
	file_name: string
	project?: string
	project_name?: string
	category?: string
	file_type?: string
}

interface ProjectResult {
	name: string
	project_name: string
	status?: string
}

interface Command {
	kind: 'command'
	id: string
	label: string
	icon: string
	keywords: string[]
	combo?: KeyboardShortcutCombo
	run: () => void
}

type Pick = Command | { kind: 'asset' | 'project'; name: string }

const MIN_QUERY = 2
const DEBOUNCE_MS = 300

const route = useRoute()
const router = useRouter()
const { commandPaletteOpen, createProjectOpen, openSettings, openUpload } = useOverlays()

const query = ref('')
const debounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

/** `/projects/:id` and `/projects/:id/folder/:f` scope the asset search. */
const currentProjectId = computed(() => {
	const match = route.path.match(/^\/projects\/([^/]+)/)
	return match ? match[1] : null
})

const placeholder = computed(() =>
	currentProjectId.value ? 'Search in project or type a command…' : 'Type a command or search…',
)
const assetGroupLabel = computed(() => (currentProjectId.value ? 'Files in project' : 'Files'))

const assetSearch = useCall<
	{ results: AssetResult[] },
	{ query: string; project?: string; limit: number }
>({
	url: '/api/v2/method/vms.api.search_assets',
	method: 'GET',
	immediate: false,
})

const projectSearch = useCall<{ results: ProjectResult[] }, { query: string; limit: number }>({
	url: '/api/v2/method/vms.api.search_projects',
	method: 'GET',
	immediate: false,
})

const shouldSearch = computed(
	() => query.value.trim().length >= MIN_QUERY && debounced.value.length >= MIN_QUERY,
)
const searching = computed(
	() =>
		query.value.trim().length >= MIN_QUERY &&
		(debounced.value !== query.value.trim() || assetSearch.loading || projectSearch.loading),
)
const assetResults = computed(() => (shouldSearch.value ? (assetSearch.data?.results ?? []) : []))
const projectResults = computed(() =>
	shouldSearch.value && !currentProjectId.value ? (projectSearch.data?.results ?? []) : [],
)

const commands: Command[] = [
	nav('dashboard', 'Go to Dashboard', 'lucide-home', ['home', 'overview'], '/'),
	nav(
		'uncategorised',
		'Go to Uncategorised',
		'lucide-inbox',
		['inbox', 'uploads'],
		'/uncategorised',
	),
	nav('projects', 'Go to Projects', 'lucide-folder', ['folders', 'videos'], '/projects'),
	nav(
		'audit-logs',
		'Go to Audit Logs',
		'lucide-scroll-text',
		['history', 'activity'],
		'/audit-logs',
	),
	nav('trash', 'Go to Trash', 'lucide-trash-2', ['deleted', 'bin'], '/trash'),
	nav('tools', 'Go to Tools', 'lucide-wrench', ['compress'], '/tools'),
	action('upload', 'Upload Files', 'lucide-upload', ['add', 'import'], () => openUpload(), 'U'),
	action('new-project', 'New Project', 'lucide-folder-plus', ['create'], () => {
		createProjectOpen.value = true
	}),
	action(
		'settings',
		'Open Settings',
		'lucide-settings',
		['preferences', 'config'],
		() => openSettings('general'),
		'Mod+Comma',
	),
	action('invite', 'Invite User', 'lucide-user-plus', ['add user', 'team'], () =>
		openSettings('users'),
	),
	action('profile', 'Profile', 'lucide-circle-user', ['account', 'me'], () =>
		openSettings('profile'),
	),
]

const navigation = computed(() => matching(commands.filter((c) => c.id.startsWith('nav:'))))
const actions = computed(() => matching(commands.filter((c) => c.id.startsWith('action:'))))

watch(query, (value) => {
	clearTimeout(timer)
	const trimmed = value.trim()
	if (trimmed.length < MIN_QUERY) {
		debounced.value = ''
		return
	}
	timer = setTimeout(() => {
		debounced.value = trimmed
	}, DEBOUNCE_MS)
})

watch([debounced, currentProjectId], ([value, project]) => {
	if (value.length < MIN_QUERY) return
	void assetSearch.submit({ query: value, project: project ?? undefined, limit: 8 })
	if (!project) void projectSearch.submit({ query: value, limit: 5 })
})

onScopeDispose(() => clearTimeout(timer))

function matching(list: Command[]): Command[] {
	const needle = query.value.trim().toLowerCase()
	if (!needle) return list
	return list.filter(
		(c) => c.label.toLowerCase().includes(needle) || c.keywords.some((k) => k.includes(needle)),
	)
}

async function run(value: CommandPaletteValue) {
	const pick = value as Pick
	if (pick.kind === 'command') {
		pick.run()
		return
	}
	await router.push(pick.kind === 'asset' ? `/review/${pick.name}` : `/projects/${pick.name}`)
}

function fileIcon(fileType?: string): string {
	return fileType?.startsWith('image/') ? 'lucide-image' : 'lucide-film'
}

function nav(id: string, label: string, icon: string, keywords: string[], to: string): Command {
	return {
		kind: 'command',
		id: `nav:${id}`,
		label,
		icon,
		keywords,
		run: () => void router.push(to),
	}
}

function action(
	id: string,
	label: string,
	icon: string,
	keywords: string[],
	run: () => void,
	combo?: KeyboardShortcutCombo,
): Command {
	return { kind: 'command', id: `action:${id}`, label, icon, keywords, run, combo }
}
</script>
