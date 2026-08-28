# VMS frontend rewrite — React → Vue 3 + frappe-ui

Same playbook as the Hive rewrite (`apps/bwh_hive/plans/frappe-ui-rewrite.md`):
lock decisions first, freeze shared contracts, then run page streams in
parallel worktrees with no shared files, then integrate and delete React.

Appendix: [`frappe-ui-rewrite/react-inventory.md`](frappe-ui-rewrite/react-inventory.md)
— every page, component, hook, API call and dependency of the current app,
marked KEEP / PORT / DROP.

Reference material each stream must read before writing code:

- `/frappe-ui` skill: `SKILL.md`, `DESIGN.md`, `COMPONENTS.md`, `TOKENS.md`.
- Recipes: `FilesDesktop.vue` / `FilesMobile.vue` (project browser, trash,
  inbox), `DiscussionsDesktop.vue` (feeds, sidebar, comment threads),
  `ComposeDesktop.vue` (editor), Settings archetype in `DESIGN.md`.
- Hive as a worked example: `apps/bwh_hive/frontend/src/{main.ts,router.ts,
  composables/useSession.ts,composables/useOverlays.ts,components/shell/}`.

---

## 1. Goals and non-goals

Goals

- Replace React 19 + shadcn/base-ui + Tailwind v4 + frappe-react-sdk (26.4k
  LOC) with Vue 3 + frappe-ui, at feature parity for everything on the KEEP
  list, using the frappe-ui design language (gray-first, ink ladder, one
  primary action per screen, `DesktopShell` / `MobileShell`).
- Fix the information hierarchy while we are in there (§7). The current app
  has a 6-item flat sidebar, a 1.8k-LOC project page and a review header with
  eight top-level buttons. The rewrite is the cheapest moment to fix that.
- Keep the backend untouched except for the small list in §9. Every
  whitelisted method keeps its name, params and response shape.
- Keep the `e2e/` Playwright suite as the acceptance bar; update selectors
  only.

Non-goals

- No new features beyond the IA changes in §7. Parity first.
- No backend refactor, no DocType changes, no R2 / upload protocol changes.
- No mobile-first redesign. Mobile is the systematic desktop → mobile
  translation from `DESIGN.md`, nothing bespoke.

---

## 2. Decisions (locked)

| Topic | Decision |
|---|---|
| Location | `git mv frontend frontend-react`, scaffold the new app in `frontend/`. Same output `vms/public/frontend/`, same `vms/www/vms.html`, same `website_route_rules` (`/vms/<path:app_path>`). `frontend-react/` deleted in the last PR. |
| Stack | Vue 3.5 + TypeScript, `vue-router@4`, `frappe-ui@1.0.0-beta.55` (pin exact, same as Hive), Tailwind **v3** (the preset is v3-only), Vite 7 + `@vitejs/plugin-vue@6`, `frappe-ui/vite` plugin with `buildConfig` + `jinjaBootData` + `lucideIcons`. `vite-plugin-pwa` kept. Copy Hive's `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` (`#components/*` path maps) and `optimizeDeps` block verbatim, then rename. |
| Build | `frappe-ui/vite` `buildConfig.indexHtmlPath: '../vms/www/vms.html'` writes the entry. Delete `copy-html-entry`. Keep `copy-service-worker` only if the SW filename stays `sw.min.js` (it does — `cleanup-legacy-sw.ts` logic is ported so old SWs are unregistered). |
| Boot | `vms/www/vms.py` already matches Hive (`get_boot`, `get_context_for_dev`). `main.ts` copies Hive's `loadDevBootData()` + `setConfig('systemTimezone')`. |
| Data layer | `useCall` for every `vms.*` method, `useList` for VMS Project / VMS Folder / Notification Log lists, `useDoc` for a single project. Always `cacheKey`. No `createResource`, no `fetch`/`axios`. Writes: `immediate: false` + `submit()`. |
| Realtime | Keep. `composables/useRealtime.ts` wraps `initSocket()` from frappe-ui (namespace from `window.site_name`, same as today's `main.tsx`). API: `onRealtime(event, handler)` that unsubscribes on unmount. Every consumer keeps its 5 s poll fallback (`useCall` + `setInterval` gated on an "active job" flag), exactly like the React app. Events: `asset_conversion_progress`, `proxy_generation_progress`, `youtube_upload_progress`, `compress_progress`, `doc_update` for Notification Log. |
| Uploads | `hooks/useUpload.ts` (440 LOC, XHR + presigned R2 + multipart) is framework-agnostic. Port it as `composables/useUpload.ts` with the same exported functions; only the React state hooks become `ref`s. Do **not** rewrite the protocol. `contexts/UploadContext.tsx` → `composables/useUploadQueue.ts` module singleton. `FileUploader` from frappe-ui is **not** used (it uploads through Frappe, we upload to R2). |
| Theme | `useColorScheme()` from frappe-ui. Drop `next-themes`, `theme-provider.tsx`, `mode-toggle.tsx`. Gray-first per `DESIGN.md`; no oklch palette. |
| Shell | `DesktopShell` + `Sidebar` family; `MobileShell` + `MobileNav` + `BottomSheet`. Review and Shared pages render **outside** the shell (own `h-screen` root). |
| Lists / tables | `frappe-ui/list` everywhere (`List`, `ListRow`, `ListCell`, `ListHeaderCellSort`, `ListGroup`). Sort/filter/paginate in app code. Drop `@tanstack/react-table`. Asset **grid** view is app markup (`grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))]`), asset **list** view is the Files recipe table. |
| Rich text | `frappe-ui/editor` — `Editor` + `CommentKit` (mentions, images, links, lists) for review comments. Mentions fed by `review_api.get_mentionable_users`; images via `review_api.upload_comment_image` through `uploadFunction`. Drop the vendored `minimal-tiptap/` tree, `@tiptap/*`, `tippy.js`. Comment HTML format unchanged (`<span class="mention" data-id>`), so existing comments render. |
| Annotations | `fabric` stays (only heavy dep kept). `hooks/useFabricCanvas.ts` → `composables/useFabricCanvas.ts`, same normalized JSON (`_normalized`, `_canvasWidth`, `_canvasHeight`) so old annotations replay. Toolbar rebuilt with frappe-ui `Button`s + `TabButtons`. |
| Video player | No frappe-ui player. Port `useVideoPlayer.ts` + `VideoPlayer` / `VideoControls` / `VideoTimeline` as app components using `Slider`, `Button`, `Dropdown` (rate), `Tooltip`. Timeline comment markers stay app markup. |
| Command palette | `CommandPalette*` from `frappe-ui/experimental` inside `Dialog bare`. `Mod+K` via `useKeyboardShortcut`. Drop `cmdk`. |
| Dialogs / toasts | `<Dialog v-model:open>` for forms; `dialog.confirm` / `dialog.danger` / `dialog.prompt` for one-shots (delete asset, empty trash, disconnect YouTube, rename). `toast.*` with `action: { label: 'Undo' }` after soft deletes. Drop `sonner`, `vaul`. |
| Side sheets | frappe-ui has no Sheet. Versions / Transcription / Notifications become a right `Dialog` variant: `<Dialog v-model:open :options="{ position: 'right' }">` if the pinned beta supports it, else one shared `components/common/SidePanel.vue` (fixed right, `w-[24rem]`, `bg-surface-base border-l`, `Transition`). Decide in W0, freeze the component. |
| Settings | `SettingsDialog` family. Tabs: Profile, General (R2), Transcription, YouTube, Users. `Mod+,` and `?settings=<tab>` deep link kept. |
| Shortcuts | `useKeyboardShortcut` + `KeyboardShortcutsDialog`. Keep `Mod+K`, `u` (upload), `Mod+,`, `?`; player keys (space, ←/→, j/k/l, f, m, c) stay inside `useVideoPlayer`. |
| Icons | `lucide-*` CSS classes (`<span class="lucide-upload size-4" />`). Drop `lucide-react`, `@hugeicons/*`, `icons/YoutubeIcon.tsx` (inline SVG component kept as `YoutubeIcon.vue`, only non-lucide icon). |
| Routes | Unchanged: `/`, `/uncategorised`, `/projects`, `/projects/:projectId`, `/projects/:projectId/folder/:folderId`, `/audit-logs`, `/trash`, `/tools`, `/review/:assetId`, `/shared/:projectId`. `createWebHistory('/vms')`. |
| Auth guard | Router `beforeEach` on non-guest routes only: `resolveLoggedUser()` from `useSession`; Guest → `/login?redirect-to=/vms<path>`. `/review/:id` and `/shared/:id` skip the guard and read `?token=`. `SetupGate` becomes a second guard: `get_setup_status` once, System Manager + not set up → render `SetupWizard` route. |
| Storage keys | Keep `vms_guest_name`. New: `theme` (frappe-ui). |
| Tests | `e2e/` Playwright suite (11 specs, ~106 tests) is the acceptance bar. Add `data-testid` while porting; write `e2e/helpers/ui.ts` with frappe-ui locators in W0. |

### Cut list

Dropped, not ported. Revisit only if someone asks.

| Item | Reason |
|---|---|
| `pages/SettingsPage.tsx` | Dead code, not routed. |
| `src/context/` + `src/contexts/` split | One `composables/` dir. |
| `open-settings` `CustomEvent` bus | `useOverlays().openSettings(tab)`. |
| `components/ui/*` (36 shadcn primitives, 4.6k LOC) + `minimal-tiptap/` | frappe-ui covers all of it. |
| `yet-another-react-lightbox`, `react-medium-image-zoom`, `MediaPlayerDialog` | One `MediaPreviewDialog.vue` (`Dialog bare`, `<video>` / `<img>`), no zoom lib. |
| `emblor` tag input | `MultiSelect` with `allowCreate`-style query, or `TextInput` + chips. |
| `@tanstack/react-table` | `frappe-ui/list`. |
| `date-fns` | frappe-ui `dayjs` export + `lib/dates.ts`. |
| Header search box | Search is a sidebar row + `Mod+K`; no page header search except the project browser's filter input. |
| `AssetCardColor` custom color picker popover | Kept as a feature, rebuilt as a 6-swatch `Dropdown` — no popover. |

Kept as is: R2 upload protocol, guest review links, share links, folder
drag-and-drop, bulk select, tags, card colors, MP4 convert, proxy
generation, versions, transcription + speaker names, YouTube upload, split,
compression tool, trash, audit logs, notifications, PWA.

---

## 3. Target project layout

```
frontend/
  package.json  vite.config.ts  tailwind.config.js  postcss.config.js  tsconfig.json
  index.html    public/{manifest.webmanifest,pwa-*.png,vms-logo.png}
  src/
    main.ts  App.vue  router.ts  style.css  types.ts  env.d.ts  shims.d.ts
    pages/
      DashboardPage.vue  InboxPage.vue  ProjectsPage.vue  ProjectDetailPage.vue
      AuditLogPage.vue   TrashPage.vue  ToolsPage.vue     SetupWizardPage.vue
      ReviewPage.vue     SharedProjectPage.vue
    components/
      shell/     AppShell.vue AppSidebar.vue SidebarProjects.vue MobileShellNav.vue
                 CommandPalette.vue NotificationsPanel.vue KeyboardShortcutsDialog.vue
      common/    SidePanel.vue EmptyState.vue UserAvatar.vue RelativeTime.vue
                 MediaPreviewDialog.vue StorageMeter.vue YoutubeIcon.vue
      assets/    AssetGrid.vue AssetCard.vue AssetList.vue AssetActions.vue (Dropdown options)
                 AssetTags.vue AssetTagFilter.vue AssetSortMenu.vue CategoryBadge.vue
                 RenameAssetDialog.vue MoveAssetDialog.vue BulkActionBar.vue
      folders/   FolderRow.vue CreateFolderDialog.vue RenameFolderDialog.vue
                 MoveFolderDialog.vue MoveToFolderDialog.vue FolderBreadcrumbs.vue
      upload/    UploadDialog.vue UploadQueuePanel.vue DropZoneOverlay.vue
      projects/  ProjectCard.vue CreateProjectDialog.vue ShareProjectPanel.vue
      review/    ReviewHeader.vue VideoPlayer.vue VideoControls.vue VideoTimeline.vue
                 ImageViewer.vue CommentPanel.vue CommentItem.vue CommentEditor.vue
                 AnnotationCanvas.vue AnnotationToolbar.vue
                 VersionPanel.vue TranscriptionPanel.vue YouTubeUploadDialog.vue SplitVideoDialog.vue
      settings/  VmsSettingsDialog.vue ProfileSection.vue GeneralSection.vue
                 TranscriptionSection.vue YouTubeSection.vue UsersSection.vue
    composables/
      useSession.ts useOverlays.ts useRealtime.ts useUpload.ts useUploadQueue.ts
      useReview.ts useReviewComments.ts useVideoPlayer.ts useFabricCanvas.ts
      useFullscreen.ts useDownload.ts useSelection.ts useBreakpoint.ts useSetup.ts
    lib/  dates.ts format.ts (bytes, duration) folderPaths.ts status.ts (badge themes) sw-cleanup.ts
```

Flat. Ten pages, everything else is a component. No `ui/` dir — if you
think you need one, you are hand-rolling a frappe-ui component.

---

## 4. Component mapping (React/shadcn → frappe-ui)

| React / shadcn | frappe-ui |
|---|---|
| `Button` (+ variants) | `Button` `variant` × `theme` |
| `Dialog`, `AlertDialog` | `Dialog v-model:open`; `dialog.confirm` / `dialog.danger` |
| `Sheet` (side) | `SidePanel.vue` (W0) |
| `DropdownMenu`, `ContextMenu` | `Dropdown :options` (grouped) |
| `Popover` | `Popover` (`#target` / `#body`) |
| `Tooltip` | `Tooltip` |
| `Input`, `Textarea`, `Label` | `FormControl` (`label` / `error` / `required`) |
| `Select` (base-ui) | `Select` / `FormControl type="select"` |
| `Combobox` | `Combobox` (`v-model` + `v-model:query`) |
| `Checkbox`, `Switch` | `Checkbox`, `Switch` |
| `Tabs` | `Tabs` / `TabButtons` |
| `Badge` | `Badge :theme` |
| `Avatar` | `Avatar` |
| `Progress` | `Progress` |
| `Skeleton` | `LoadingText` / `LoadingIndicator` |
| `Breadcrumb` | `Breadcrumbs :items` |
| `Command` (cmdk) | `CommandPalette*` (experimental) in `Dialog bare` |
| `Table` + TanStack | `List` table mode |
| `Card` | none — `bg-surface-base rounded border border-outline-gray-1` or no box at all |
| `Sidebar` (shadcn) | `Sidebar` / `SidebarHeader` / `SidebarGroup` / `SidebarItem` / `SidebarLabel` |
| `sonner` | `toast.*` |
| `minimal-tiptap` | `Editor` + `CommentKit` (`frappe-ui/editor`) |
| `ScrollArea` | `ScrollArea` |
| `Slider` | `Slider` |
| `theme-provider` | `useColorScheme` |

---

## 5. Shared contracts (Phase 0 deliverables, frozen before parallel work)

Every stream imports these. W0 ships them with types and a `/dev` sandbox
page that renders each one, so streams do not drift.

```ts
// composables/useSession.ts  (copy of Hive's, minus Hive Member)
export function useSession(): {
  user: ComputedRef<{ name: string; full_name: string; user_image?: string } | null>
  userId: ComputedRef<string>
  isSystemManager: ComputedRef<boolean>      // from useSetup(): get_setup_status returns is_system_manager
  isGuest: ComputedRef<boolean>
  ready: ComputedRef<boolean>
  logout(): Promise<void>
  reload(): void
}
export function resolveLoggedUser(): Promise<string>   // '' = Guest

// composables/useSetup.ts
export function useSetup(): { status: ComputedRef<'unknown'|'pending'|'done'>; isSystemManager: ComputedRef<boolean>; ready: ComputedRef<boolean>; refresh(): void }
// one useCall('vms.api.get_setup_status', { cacheKey: 'setup-status' }) shared by the guard, the shell and useSession

// composables/useOverlays.ts  (module-level refs)
export type SettingsTab = 'profile' | 'general' | 'transcription' | 'youtube' | 'users'
export function useOverlays(): {
  commandPaletteOpen: Ref<boolean>
  notificationsOpen: Ref<boolean>
  shortcutsOpen: Ref<boolean>
  settingsOpen: Ref<boolean>; settingsTab: Ref<SettingsTab>; openSettings(tab?: SettingsTab): void
  uploadOpen: Ref<boolean>; uploadContext: Ref<UploadContext>; openUpload(ctx?: UploadContext): void
  createProjectOpen: Ref<boolean>
}
export interface UploadContext { project?: string; folder?: string; versionOf?: string; onDone?: () => void }

// composables/useRealtime.ts
export function onRealtime<T = unknown>(event: string, handler: (payload: T) => void): void  // auto-off on unmount
export function useDocRealtime(doctype: string, handler: (payload: { name: string }) => void): void

// composables/useUpload.ts  — same surface as hooks/useUpload.ts
export interface UploadItem { id: string; file: File; status: 'queued'|'uploading'|'confirming'|'done'|'error'|'cancelled'; progress: number; assetName?: string; error?: string }
export function uploadFile(file: File, ctx: UploadContext, onProgress: (p: number) => void, signal: AbortSignal): Promise<{ assetName: string }>

// composables/useUploadQueue.ts  (singleton; replaces UploadContext.tsx)
export function useUploadQueue(): { items: Ref<UploadItem[]>; add(files: File[], ctx: UploadContext): void; cancel(id: string): void; clearDone(): void; active: ComputedRef<number> }

// composables/useReview.ts  (replaces ReviewContext.tsx; provided by ReviewPage, injected by review/*)
export function provideReview(opts: { assetId: string; token: string | null }): ReviewApi
export function useReview(): ReviewApi
export interface ReviewApi {
  asset: ComputedRef<ReviewAsset | null>; loading: Ref<boolean>; reload(): void
  isGuest: ComputedRef<boolean>; token: string | null; guestName: Ref<string>   // localStorage vms_guest_name
  currentTime: Ref<number>; duration: Ref<number>; seekTo(t: number): void; player: Ref<HTMLVideoElement | null>
  comments: ReturnType<typeof useReviewComments>
  annotation: { mode: Ref<'off'|'edit'|'view'>; data: Ref<AnnotationJson | null>; start(): void; view(json: AnnotationJson, t: number): void; capture(): AnnotationJson | null; clear(): void }
  panels: { versions: Ref<boolean>; transcription: Ref<boolean>; youtube: Ref<boolean>; split: Ref<boolean> }
}

// composables/useReviewComments.ts — same calls as today
export function useReviewComments(assetId: string, token: string | null, version: Ref<number>): {
  list: ComputedRef<ReviewComment[]>; loading: Ref<boolean>; reload(): void
  add(p: { text: string; timestamp?: number; parent?: string; annotation?: AnnotationJson; guestName?: string }): Promise<void>
  edit(name: string, text: string): Promise<void>; remove(name: string): Promise<void>; resolve(name: string, resolved: boolean): Promise<void>
}

// components/common/SidePanel.vue
props: { open: boolean; title: string; width?: string /* default '24rem' */ }  emits: ['update:open']  slots: default, #actions

// components/assets/AssetActions.vue  — the ONE place asset row/card actions are defined
export function useAssetActions(asset: Ref<Asset>, ctx: { onChanged(): void }): DropdownOption[]
// Review, Rename, Move, Tags, Color, Convert to MP4, New version, Download, Share link, Delete (dialog.danger)

// lib/status.ts
export function assetStatusTheme(s: AssetStatus): BadgeTheme   // Uploading→gray, Processing→blue, Ready→green, Error→red
export function categoryTheme(c: string): BadgeTheme
// lib/format.ts
export function formatBytes(n: number): string; export function formatDuration(s: number): string
```

Types in `src/types.ts`: `Asset`, `Project`, `Folder`, `ReviewAsset`,
`ReviewComment`, `AnnotationJson`, `AssetVersion`, `Transcription`,
`CompressJob`, `AuditLog`, `Notification`. Copy from `types/index.ts`, drop
React-only bits.

---

## 6. Workstreams

### Phase 0 — W0 Foundation (serial, blocks everything, ~1 day)

1. `git mv frontend frontend-react`. Scaffold `frontend/` from Hive's
   config files (`package.json` deps, `vite.config.ts` with
   `frontendRoute: '/vms'`, `buildConfig` → `../vms/www/vms.html` /
   `../vms/public/frontend` / `/assets/vms/frontend/`, PWA block from the
   current `vite.config.ts` reduced to Hive's shape but keeping
   `filename: 'sw.min.js'` + `scope: '/vms'`, `tailwind.config.js`,
   `tsconfig.json`, `postcss.config.js`, `.eslintrc`, Prettier 3.3.3).
   Add `fabric`. Root `package.json` scripts unchanged.
2. `main.ts` (dev boot, `setConfig`, `app.use(router)`, `app.use(FrappeUI)`),
   `App.vue` (`FrappeUIProvider` → `router-view`), `style.css`.
3. `router.ts`: all routes lazy; guard per §2; chunk-404 reload from Hive.
4. `useSession`, `useSetup`, `useOverlays`, `useRealtime`, `useUpload`
   (port), `useUploadQueue`, `useBreakpoint`, `useSelection`, `useDownload`,
   `useFullscreen`, `lib/*`, `types.ts`.
5. `shell/AppShell.vue`, `AppSidebar.vue` (final IA from §7.1, projects
   group reads `useList('VMS Project', { limit: 8, orderBy: 'modified desc' })`),
   `MobileShellNav.vue`. Shell mounts every global overlay once:
   `CommandPalette`, `NotificationsPanel`, `KeyboardShortcutsDialog`,
   `VmsSettingsDialog`, `UploadDialog`, `CreateProjectDialog` — as **stubs**
   that streams replace.
6. `common/*`: `SidePanel`, `EmptyState`, `UserAvatar`, `RelativeTime`,
   `MediaPreviewDialog`, `StorageMeter`.
7. `assets/AssetActions.vue` (`useAssetActions`) with all dialogs it opens
   as stubs, so W2, W1 (inbox), W9 (trash) share one action list.
8. Every page as a stub with its `PageHeader` title. `pages/DevPage.vue`
   at `/dev` rendering the contracts.
9. `e2e/helpers/ui.ts` (frappe-ui locators) — spec files untouched until W10.
10. Acceptance: `yarn build` writes `vms/www/vms.html`; `/vms` loads the
    shell logged-in; `/vms/review/x` renders outside the shell; `/login`
    redirect works; `yarn typecheck` + `yarn lint` clean.

### Phase 1 — Pages (parallel, 9 streams, no shared files)

Each stream owns the files listed and nothing else. If you need a change in
a W0 file, post it as a one-line PR against `develop` before your stream PR.

| Stream | Owns | Scope | APIs | Recipe |
|---|---|---|---|---|
| **W1 Dashboard + Inbox** | `pages/DashboardPage.vue`, `pages/InboxPage.vue`, `common/StorageMeter.vue` (finalize) | Dashboard per §7.2. Inbox (`/uncategorised`) = Files-recipe table of uncategorised assets, `ListGroup` by day, row `Dropdown` from `useAssetActions`, `Categorise` as primary row action (`Select`), bulk categorise via `selectable`. | `get_bucket_usage`, `useList` VMS Project / VMS Asset (recent), `get_inbox_assets`, `update_asset_category` | Files, Dashboard archetype |
| **W2 Projects + Project browser** | `pages/ProjectsPage.vue`, `pages/ProjectDetailPage.vue`, `projects/*`, `assets/AssetGrid.vue AssetCard.vue AssetList.vue AssetTags.vue AssetTagFilter.vue AssetSortMenu.vue CategoryBadge.vue BulkActionBar.vue RenameAssetDialog.vue MoveAssetDialog.vue`, `folders/*`, `lib/folderPaths.ts` | §7.3. Grid + list toggle, folder rows, breadcrumbs, sort/tag filter/search, multi-select + bulk bar, HTML5 DnD move, share panel, convert-to-MP4 progress (`onRealtime` + poll), load more. Split `ProjectDetailPage` (1.8k LOC) into the components above; the page file must stay < 400 LOC. | `useDoc` VMS Project, `useList` VMS Folder, `get_project_assets`, `get_project_tags`, `add/remove_asset_tag`, `set_asset_card_color`, `rename_asset`, `move_asset`, `move_assets_to_folder`, `create/rename/move/delete_folder`, `delete_asset`, `convert_asset_to_mp4`, `enable/disable_project_sharing`, `review_api.toggle_public_review`, `get_download_url`, `search_projects` | Files desktop + mobile |
| **W3 Upload** | `upload/*`, `composables/useUploadQueue.ts` (finalize), version-upload entry (`useVersionUpload.ts`) | `UploadDialog` (`Dialog`, drop area, project/folder `Combobox`, category `Select`, per-file rows with `Progress`, cancel, retry, "upload report"), `UploadQueuePanel` docked bottom-right while uploads run and the dialog is closed, `DropZoneOverlay` on project pages, new-version upload flow. `u` shortcut. | `get_upload_url`, `get_part_upload_url`, `complete_multipart`, `abort_multipart`, `confirm_upload`, `fail_upload`, `send_upload_report`, `upload_new_version` path via `confirm_upload(version_of)` | — |
| **W4 Review core** | `pages/ReviewPage.vue`, `review/ReviewHeader.vue VideoPlayer.vue VideoControls.vue VideoTimeline.vue ImageViewer.vue`, `composables/useReview.ts useVideoPlayer.ts` | §7.4 layout. Player, controls, timeline with comment markers (reads `useReview().comments`), image viewer, proxy generation (`onRealtime` + poll), guest name prompt (`dialog.prompt`), header per §7.4, public-link toggle. Mounts `<CommentPanel>` and `<AnnotationCanvas>` from W5 and the four panels/dialogs from W6 by name — W0 stubs exist. | `review_api.get_review_data`, `get_review_view_url`, `toggle_public_review`, `proxy.generate_proxy`, `get_proxy_status`, `get_guest_download_url`, `get_download_url` | Two-pane archetype |
| **W5 Review comments + annotations** | `review/CommentPanel.vue CommentItem.vue CommentEditor.vue AnnotationCanvas.vue AnnotationToolbar.vue`, `composables/useReviewComments.ts useFabricCanvas.ts` | Comment list (`List` feed mode, threads, resolve, sort by time/recent, version filter, timestamp chips seek), editor (`Editor` + `CommentKit`, mentions, image paste, `Mod+Enter`, timestamp toggle, guest name), annotation overlay (fabric port; tools, colors, undo/redo; auto-capture on submit; read-only replay). Consumes `useReview()` only. | `get_comments`, `add_comment`, `edit_comment`, `delete_comment`, `resolve_comment`, `get_annotation_data`, `update_annotation`, `upload_comment_image`, `get_mentionable_users` | Discussions (thread rows), Compose |
| **W6 Review panels** | `review/VersionPanel.vue TranscriptionPanel.vue YouTubeUploadDialog.vue SplitVideoDialog.vue`, `composables/useVersionUpload.ts` (shared with W3 — W3 owns it, W6 consumes) | `VersionPanel` (`SidePanel`, `List` of versions, current badge, download / restore via `dialog.confirm`, upload new version), `TranscriptionPanel` (empty → processing → complete states, timestamped segments seek the player, speaker rename `dialog.prompt`, retry), YouTube upload dialog (channel `Select`, title/description `FormControl`, privacy, progress via `onRealtime('youtube_upload_progress')` + poll, reset), split dialog (parts list, status). Each opens from `useReview().panels.*`. | `get_asset_versions`, `get_version_download_url`, `restore_version`, `transcription.*`, `youtube.get_youtube_channels / upload_to_youtube / get_youtube_upload_status / reset_youtube_upload`, `video_split.*` | — |
| **W7 Settings + Setup** | `settings/*`, `pages/SetupWizardPage.vue` | `SettingsDialog` family with the five tabs; General = R2 credentials form + Test connection + bucket usage; Transcription = provider/model `Select`; YouTube = OAuth connect (redirect), channel list with default toggle + disconnect (`dialog.danger`); Users = `List` of users + invite (`dialog.prompt` → `invite_by_email`), pending invitations with cancel; Profile = name / image / theme (`useColorScheme`) / logout. Setup wizard = Form archetype, 3 steps (`Tabs` as stepper), same fields as today. | `test_r2_connection`, `complete_setup`, `reset_setup`, `get_bucket_usage`, `youtube.*` (connect/finalize/disconnect/channels/default/redirect_uri/status), `get_vms_users`, `frappe.core.api.user_invitation.*`, VMS Settings via `useDoc` | Settings archetype |
| **W8 Palette + Notifications + Shared** | `shell/CommandPalette.vue NotificationsPanel.vue KeyboardShortcutsDialog.vue`, `pages/SharedProjectPage.vue` | Palette: navigation group, actions group (Upload, New project, Settings, Invite), assets (≥2 chars, `search_assets` scoped to current project route), projects (`search_projects`). Notifications: `SidePanel`, `useList('Notification Log')` + `useDocRealtime`, mark read, unread dot on the sidebar row. Shortcuts dialog. Shared page: guest gallery per §7.5. | `search_assets`, `search_projects`, Notification Log list + `frappe.desk.doctype.notification_log.notification_log.mark_as_read`, `get_shared_project`, `get_shared_project_assets`, `get_shared_asset_view_url`, `get_shared_asset_download_url` | — |
| **W9 Tools + Trash + Audit** | `pages/ToolsPage.vue`, `pages/TrashPage.vue`, `pages/AuditLogPage.vue` | Tools: compress flow (file drop → `useUpload` with tool URL → start → progress via `onRealtime('compress_progress')` + poll → download), jobs `List`. Trash: Files-recipe table, `ListGroup` Folders / Assets, row Restore / Delete forever, Empty trash primary → `dialog.danger`. Audit: `List` table (time, user, action, target, details), filters as `Select`s from `get_audit_log_filters`, load-more pagination. | `tools_api.*`, `get_trash_assets`, `get_trash_folders`, `restore_asset`, `restore_folder`, `permanently_delete_*`, `empty_trash`, `get_audit_logs`, `get_audit_log_filters` | Files, Data table |

Merge order after Phase 1: W3 → W2 → W4 → W5 → W6 → rest. (W2 and W9
both consume `useAssetActions`; W4/5/6 nest.)

### Phase 2 — Integration and cleanup (after Phase 1 merges)

| Stream | Work |
|---|---|
| **W10 e2e** | Point the 11 specs at the new DOM through `e2e/helpers/ui.ts`. Green = done. |
| **W11 Polish** | Walk `DESIGN.md` on every screen: gutters `px-3 py-5 pb-10 sm:px-5`, one primary per screen, `grep -E 'text-gray-\|bg-gray-\|border-gray-' src` empty, dark mode toggle check, mobile pass on Dashboard / Projects / Project detail / Review / Inbox. Kill duplicate components that appeared across streams. |
| **W12 Delete React** | `git rm -r frontend-react`, remove `copy-html-entry`, rewrite `CLAUDE.md` (Vue + frappe-ui, commands, data layer, token rule, `/frappe-ui` skill), update `README`, drop React-only memory notes. |

---

## 7. Screen specs and IA changes

Every change below is a deliberate departure from the React app. Streams
implement these, not the old layout.

### 7.1 Shell and navigation (W0)

Today: flat 6-item sidebar (Dashboard, Uncategorised, Projects, Audit Logs,
Tools, Trash) + header with search box, upload button, bell, avatar. Audit
Logs and Trash sit at the same level as Projects.

New (desktop, `Sidebar width="14rem"`):

```
SidebarHeader  logo · "VMS" · subtitle = site name · menu: Settings, Keyboard shortcuts, Log out
──
Search                     (opens palette, shows ⌘K)
Home                       /
Inbox                      /uncategorised   suffix: uncategorised count (ink-gray-5)
Projects                   /projects
Notifications              (opens NotificationsPanel) suffix: unread dot
──  SidebarLabel "Projects"           trailing ghost "+" → createProjectOpen
  ▸ last 8 projects by modified, lucide-folder, active when route matches
  "All projects" row when > 8
──  SidebarLabel "More"  (collapsed by default, remembered in localStorage `vms_sidebar_more`)
  Tools                    /tools
  Audit log                /audit-logs
  Trash                    /trash
──
bottom: StorageMeter (Progress + "x of y used") — same as Files recipe
```

- No page-header search input. Upload moves to page headers (Project detail,
  Inbox, Dashboard primary) — not a global header button. The global entry
  is `u` and the palette.
- User avatar + settings live in `SidebarHeader` menu, not a header bar.
- Mobile: `MobileNav` tabs Home / Projects / Inbox / You (avatar → sheet with
  Notifications, Tools, Trash, Audit log, Settings, Log out).

### 7.2 Dashboard (W1)

Centered `max-w-4xl space-y-6`.

1. `PageHeader`: title "Home", primary `Upload` (solid gray), secondary `New project`.
2. KPI strip `divide-x divide-outline-gray-2`: Assets, Projects, Uncategorised, Storage used (figure `text-2xl text-ink-gray-9`, label `text-sm text-ink-gray-5`). Storage tile doubles as a `Progress`.
3. "Recent projects" — section heading `text-lg-semibold`, 4 `ProjectCard`s in a grid, "View all" ghost link.
4. "Recent uploads" — `List` feed mode, `h-15` rows: thumbnail 40×24, name, project · relative time, status `Badge` right-aligned fixed column. Click → review.
5. Empty state (no projects): `EmptyState` with `Create project` primary.

Drops: activity charts, card-boxed sections.

### 7.3 Project browser (W2)

Follows `FilesDesktop.vue` closely.

- `PageHeader`: `Breadcrumbs` (Projects › Project › Folder), right side:
  `New folder` (subtle), `Upload` (solid). Project `…` `Dropdown` next to
  the last breadcrumb: Share, Rename, Settings, Delete.
- Toolbar row under header: filter `TextInput` (`#prefix` search icon,
  `w-64`), tag `MultiSelect`, sort `Dropdown`, category `Select`, view
  toggle `TabButtons` [grid | list] (remembered in `vms_asset_view`).
- **Grid** (default): folders first as a compact row list (`List` with
  `ListRow h-10`, lucide-folder, name, item count), then a divider label
  "Files", then the asset grid — card = thumbnail 16:9 on
  `bg-surface-gray-2`, duration chip bottom-right, name `text-base
  text-ink-gray-8 truncate`, meta line `text-sm text-ink-gray-5` (size ·
  time), status dot only when not Ready, card color as a 3px top edge (not a
  full tint), `…` ghost button on hover → `useAssetActions`. Checkbox
  top-left on hover/selected.
- **List**: Files recipe table `['minmax(0,1fr)','8rem','7.5rem','6rem','3rem']` = Name (thumb + name), Category `Badge`, Modified, Size, `…`. `ListGroup` by Folder vs Files; sort via `ListHeaderCellSort`.
- Selection: `selectable` + `BulkActionBar` pinned bottom center
  (`bg-surface-elevation-1 shadow rounded-lg`): n selected · Move · Tag ·
  Download · Delete · ×.
- Drag-and-drop: assets onto folder rows / breadcrumb; keep native DnD,
  highlight target with `bg-surface-gray-2 outline outline-outline-gray-3`.
- Share: `ShareProjectPanel` (`SidePanel`) — toggle, link + copy, guest count.
- Convert to MP4: row/card `Progress` inline + toast on completion; realtime
  + 5 s poll.
- Empty folder: recipe empty state ("This folder is empty · Upload a file or
  create a folder").

### 7.4 Review (W4 / W5 / W6)

Two-pane, outside the shell, `h-screen`, `:scroll="false"` semantics.

```
PageHeaderBase (h-12, border-b)
  left : ← back (route back or /projects/:id), asset name (text-base-semibold, truncate), version Badge "v3" (click → VersionPanel), status Badge if not Ready
  right: Share (solid gray, opens link popover w/ public toggle + copy)   ·   … Dropdown: Download, New version, Transcribe, Upload to YouTube, Split video, Convert to MP4, Open in project
────────────────────────────────────────────────────────
  main (flex-1, bg-surface-gray-1 or black behind video)   │  CommentPanel  w-[22rem] shrink-0 border-l bg-surface-base
    VideoPlayer + AnnotationCanvas overlay                  │    header: "Comments" · count · sort Dropdown · version filter
    VideoControls (play, time, Slider, rate, volume,        │    ScrollArea: List feed, CommentItem (avatar, name, time chip,
      fullscreen)                                           │      Badge "Drawing", body, replies indented, Resolve ghost)
    VideoTimeline (markers from comments)                   │    footer: CommentEditor + AnnotationToolbar (only when annotating)
```

- Eight header buttons collapse to two (`Share` + `…`), per "one primary action".
- Panels (Versions, Transcription) are `SidePanel`s over the comment column,
  not stacked sheets; only one open at a time.
- Guest: same layout, no `…` except Download; name prompt via `dialog.prompt`
  on first comment; stored in `vms_guest_name`.
- Mobile (`< md`): player on top (16:9), controls, then comments fill the
  rest; header actions in `…`; timeline hidden.
- Keyboard: unchanged from `useVideoPlayer`.

### 7.5 Shared project (W8)

Guest page, no shell. `PageHeaderBase`: project name + "Shared by {owner}",
right `Download all` (subtle). Body: asset grid identical to 7.3 grid, minus
selection/actions; card click → `MediaPreviewDialog` with Download.

### 7.6 Inbox, Trash, Audit, Tools (W1 / W9)

All four are the Files / Data-table archetype: `PageHeader` (title + one
primary), optional toolbar row, `List` table, empty state. Trash and Audit
group by day (`ListGroup`). Tools: header primary `Compress video` opens a
`Dialog` with drop area; jobs table below.

### 7.7 Settings (W7)

`SettingsDialog`: nav Profile · General · Transcription · YouTube · Users.
Each panel: `space-y-11 pt-6` sections → `divide-y divide-outline-gray-1`
of `SettingsRow` (label + description left, control right). Destructive
actions (`Disconnect YouTube`, `Reset setup`) are `theme="red"` `subtle`
buttons at the bottom of their section, confirmed by `dialog.danger`.

---

## 8. Dependencies

`frontend/package.json` (final):

```
dependencies:    frappe-ui 1.0.0-beta.55, vue, vue-router, fabric ^7
devDependencies: same list as Hive (vite 7, @vitejs/plugin-vue 6, tailwindcss 3.4, vue-tsc,
                 unplugin-icons, @iconify/json, lucide-static, vite-plugin-pwa, workbox-*,
                 eslint 9 + eslint-plugin-vue + typescript-eslint, prettier 3.3.3)
```

Nothing else. Adding a dependency is a decision for this table, not a
stream.

---

## 9. Backend touch points (small, can land before W0)

| Change | Why |
|---|---|
| `vms/api.py` `get_sidebar_counts()` (GET) → `{ uncategorised: int, unread_notifications: int, storage: {used, total} }` | One call for sidebar suffixes + storage meter instead of three. |
| `get_inbox_assets`, `get_trash_assets`, `get_audit_logs`: accept `start` / `page_length` if they don't already | "Load more" on `List` tables. |
| Nothing else. All other methods keep name, params and shape. |

Verify each with `bench --site vms.localhost execute` before W0 merges.

---

## 10. Acceptance per stream

- `yarn build` succeeds; `yarn typecheck` (`vue-tsc --noEmit`) and `yarn lint` clean.
- Zero raw color utilities: `grep -rE 'text-gray-|bg-gray-|border-gray-|bg-(blue|red|green)-[0-9]' src` → empty.
- No `fetch(`, `axios`, `createResource` in `src`.
- Every list is `frappe-ui/list`; every dialog is `Dialog` or `dialog.*`; every icon is a `lucide-*` span.
- Desktop + mobile + dark mode checked in the browser (`agent-browser` at `vms.localhost:8000/vms`; `yarn build` first — Frappe serves the built bundle).
- Guest paths (`/review/:id?token=`, `/shared/:id?token=`) work logged-out.
- Relevant `e2e/` spec green or updated in the same PR.
- PR against `develop`, one stream per PR, description: Why / What / How.

---

## 11. Execution order

```
Day 0        §9 backend PR (tiny) · W0 (serial, one agent)
Day 1–3      W1 W2 W3 W4 W5 W6 W7 W8 W9 in parallel — 9 agents, `.claude/worktrees/`
             merge order: W3 → W2 → W4 → W5 → W6 → W1 → W7 → W8 → W9
Day 4        W10 e2e · W11 polish
Day 5        W12 delete React, CLAUDE.md, memory notes
```

Per-stream agent prompt template:

> Read `plans/frappe-ui-rewrite.md` §2, §5, §7.x and your row in §6. Read
> the `/frappe-ui` skill (`DESIGN.md`, `COMPONENTS.md`). The old
> implementation is in `frontend-react/src/...` — port behaviour, not
> markup. Only touch the files your stream owns. Test in the browser with
> `agent-browser` after `yarn build`. Open a PR against `develop`.
