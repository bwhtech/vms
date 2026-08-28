# React app inventory (frontend-react/)

Audit of the app being replaced. 26,379 LOC in `frontend/src`. Every row is
KEEP (port behaviour), or DROP (see cut list in the master plan). Stream
column = who ports it.

## Build and entry

| Item | Note | Verdict |
|---|---|---|
| `vite.config.ts` | outDir `../vms/public/frontend`, `--base=/assets/vms/frontend/`, PWA `sw.min.js` scope `/vms`, manifest static in `public/` | KEEP shape; frappe-ui vite plugin `buildConfig` replaces the `cp` step |
| `copy-html-entry` script | `cp index.html ../vms/www/vms.html` | DROP (plugin writes it) |
| `copy-service-worker` | `cp sw.min.js ../vms/www/sw.min.js` | KEEP |
| `vms/www/vms.py` | boot: site_name, csrf, version, tz; `get_context_for_dev` | KEEP unchanged |
| `hooks.py` `website_route_rules` | `/vms/<path:app_path>` → `vms` | KEEP unchanged |
| `lib/cleanup-legacy-sw.ts` | unregisters old SW | KEEP → `lib/sw-cleanup.ts` |

## Routes (`App.tsx`)

| Route | Component | Shell | Guard | Stream |
|---|---|---|---|---|
| `/` | DashboardPage | yes | auth + setup | W1 |
| `/uncategorised` | InboxPage (UncategorisedPage) | yes | auth + setup | W1 |
| `/projects` | ProjectsPage | yes | auth + setup | W2 |
| `/projects/:projectId` | ProjectDetailPage | yes | auth + setup | W2 |
| `/projects/:projectId/folder/:folderId` | ProjectDetailPage | yes | auth + setup | W2 |
| `/audit-logs` | AuditLogPage | yes | auth + setup | W9 |
| `/trash` | TrashPage | yes | auth + setup | W9 |
| `/tools` | ToolsPage | yes | auth + setup | W9 |
| `/review/:assetId` | ReviewPage | no | none (`?token=`) | W4 |
| `/shared/:projectId` | SharedProjectPage | no | none (`?token=`) | W8 |
| (gate) | SetupWizard | no | System Manager only | W7 |
| `*` | redirect `/` | | | W0 |

Wrapper chain today: `UploadProvider` → `ProtectedRoute` (`useFrappeAuth`) →
`SetupGate` (`get_setup_status`) → `AppLayout`. Becomes: router guards +
`AppShell`.

## Pages (5,865 LOC)

| File | LOC | What | APIs | Verdict |
|---|---|---|---|---|
| ProjectDetailPage.tsx | 1831 | grid/list, folders, DnD, bulk, tags, sort, share, convert | get_project_assets, move_assets_to_folder, move_folder, enable/disable_project_sharing, convert_asset_to_mp4, toggle_public_review, VMS Project/Folder docs; realtime `asset_conversion_progress` | KEEP, split into components (W2) |
| ReviewPage.tsx | 549 | review workspace host | get_review_data, toggle_public_review, proxy.*, transcription.*, video_split.get_split_status, youtube upload status; realtime `proxy_generation_progress` | KEEP (W4) |
| AuditLogPage.tsx | 511 | TanStack table, facets, pagination | get_audit_logs, get_audit_log_filters | KEEP, List table (W9) |
| SetupWizard.tsx | 505 | R2 credential wizard | test_r2_connection, complete_setup | KEEP (W7) |
| TrashPage.tsx | 501 | restore / delete forever / empty | get_trash_assets, get_trash_folders, restore_*, permanently_delete_*, empty_trash | KEEP (W9) |
| InboxPage.tsx | 491 | uncategorised triage | get_inbox_assets, update_asset_category | KEEP (W1) |
| ToolsPage.tsx | 474 | compress tool | tools_api.* ; realtime `compress_progress` | KEEP (W9) |
| ProjectsPage.tsx | 266 | project grid + create | useFrappeGetDocList VMS Project, doc CRUD | KEEP (W2) |
| SharedProjectPage.tsx | 255 | guest gallery | get_shared_project, get_shared_project_assets, get_shared_asset_download_url | KEEP (W8) |
| DashboardPage.tsx | 253 | recent + storage | get_bucket_usage, doclists | KEEP, new layout (W1) |
| SettingsPage.tsx | 229 | not routed | — | DROP |

## Components

### Layout / shell (W0, W8)

| File | LOC | Verdict |
|---|---|---|
| layout/Sidebar.tsx | 211 | KEEP → `shell/AppSidebar.vue`, new IA |
| layout/AppLayout.tsx | 100 | KEEP → `shell/AppShell.vue`; `open-settings` CustomEvent → `useOverlays` |
| layout/Header.tsx | 46 | DROP (no header bar; PageHeader per page) |
| CommandPalette.tsx | 301 | KEEP → frappe-ui experimental CommandPalette (W8) |
| NotificationSheet.tsx | 259 | KEEP → `NotificationsPanel.vue` (W8) |
| theme-provider.tsx, mode-toggle.tsx | 103 | DROP → `useColorScheme` |
| UserAvatar.tsx | 32 | KEEP → `common/UserAvatar.vue` (Avatar) |
| ReloadPrompt.tsx | 28 | KEEP → PWA update toast via `toast.info` + action |
| icons/YoutubeIcon.tsx | — | KEEP → `common/YoutubeIcon.vue` |

### Assets / upload / folders (W2, W3)

| File | LOC | Verdict |
|---|---|---|
| UploadDialog.tsx | 628 | KEEP (W3) |
| AssetCardPreview.tsx | 196 | KEEP → `assets/AssetCard.vue` |
| AssetCardMenu.tsx | 185 | KEEP → `assets/AssetActions.vue` (`useAssetActions`, W0 contract) |
| AssetTags.tsx | 142 | KEEP (MultiSelect / chips) |
| AssetCardColor.tsx | 123 | KEEP as 6-swatch Dropdown |
| AssetTagFilter.tsx | 99 | KEEP (MultiSelect) |
| AssetSortMenu.tsx | 60 | KEEP (Dropdown) |
| AssetSearchInput.tsx | 34 | KEEP (TextInput #prefix) |
| DropZoneOverlay.tsx | 85 | KEEP (W3) |
| MediaPlayerDialog.tsx | 151 | KEEP → `common/MediaPreviewDialog.vue`, no zoom libs |
| CategoryBadge.tsx | 73 | KEEP (Badge + `categoryTheme`) |
| LoadMoreControls.tsx | 32 | KEEP (Button ghost "Load more") |
| RenameAssetDialog.tsx | 115 | KEEP → `dialog.prompt` |
| DeleteAssetDialog.tsx | 93 | DROP → `dialog.danger` |
| MoveAssetDialog.tsx | 121 | KEEP (Combobox project + folder) |
| MoveFolderDialog.tsx | 186 | KEEP |
| MoveToFolderDialog.tsx | 147 | KEEP |
| RenameFolderDialog.tsx | 97 | DROP → `dialog.prompt` |
| CreateFolderDialog.tsx | 96 | DROP → `dialog.prompt` |
| DeleteFolderDialog.tsx | 88 | DROP → `dialog.danger` |

### Review (W4, W5, W6)

| File | LOC | Stream | Verdict |
|---|---|---|---|
| ReviewHeader.tsx | 434 | W4 | KEEP, collapsed to Share + `…` |
| VideoPlayer.tsx | 422 | W4 | KEEP |
| VideoControls.tsx | 130 | W4 | KEEP (Slider, Dropdown rate) |
| VideoTimeline.tsx | 111 | W4 | KEEP |
| ImageViewer.tsx | 66 | W4 | KEEP |
| CommentPanel.tsx | 248 | W5 | KEEP (List feed) |
| CommentItem.tsx | 368 | W5 | KEEP |
| CommentEditor.tsx | 326 | W5 | KEEP → `Editor` + `CommentKit` |
| CommentInput.tsx | 206 | W5 | merge into CommentEditor |
| AnnotationCanvas.tsx | 99 | W5 | KEEP (fabric) |
| AnnotationToolbar.tsx | 112 | W5 | KEEP |
| TranscriptionSheet.tsx | 424 | W6 | KEEP → `TranscriptionPanel.vue` (SidePanel) |
| VersionSheet.tsx | 252 | W6 | KEEP → `VersionPanel.vue` |
| YouTubeUploadDialog.tsx | 400 | W6 | KEEP |
| SplitVideoDialog.tsx | 132 | W6 | KEEP |

### Settings (W7)

| File | LOC | Verdict |
|---|---|---|
| SettingsDialog.tsx | 185 | KEEP → frappe-ui `SettingsDialog` family; tabs profile/general/transcription/youtube/users |
| settings/GeneralSection.tsx | 507 | KEEP (R2 form, test connection, usage) |
| settings/YouTubeSection.tsx | 441 | KEEP |
| settings/ProfileSection.tsx | 262 | KEEP (+ theme switch) |
| settings/UsersSection.tsx | 216 | KEEP (invite via `frappe.core.api.user_invitation`) |
| settings/TranscriptionSection.tsx | 196 | KEEP |

### UI primitives

`components/ui/*` — 36 shadcn/base-ui files, 4,596 LOC, plus
`ui/minimal-tiptap/` (editor, bubble menu, image, link, extensions). **DROP
all.** frappe-ui covers every one.

## Hooks → composables

| Hook | LOC | Verdict |
|---|---|---|
| useFabricCanvas.ts | 550 | KEEP, port 1:1 (W5). Normalized JSON keys unchanged. |
| useUpload.ts | 440 | KEEP, port 1:1 (W0). XHR, presigned PUT, multipart (50 MB parts, 2 concurrent, 3 retries), ETag CORS error message. |
| useVideoPlayer.ts | 218 | KEEP (W4) |
| useReviewComments.ts | 122 | KEEP (W5) |
| useFullscreen.ts | 94 | KEEP (W0) |
| useDownload.ts | 70 | KEEP (W0) |
| useSelection.ts | 37 | KEEP (W0) |
| use-mobile.ts | 19 | → `useBreakpoint` (W0) |
| useDebouncedValue.ts | 17 | → `useDebounce` from `@vueuse/core` (transitive via frappe-ui) or 5-line composable |
| useReviewContext.ts | 8 | → `useReview()` |

## Contexts → composables

| Context | LOC | Verdict |
|---|---|---|
| contexts/ReviewContext.tsx | 218 | → `provideReview` / `useReview` (W4 owns, W5/W6 consume) |
| contexts/UploadContext.tsx | 154 | → `useUploadQueue` singleton (W0/W3) |
| context/UserContext.tsx | 53 | → `useSession` (W0) |

## lib

| File | Verdict |
|---|---|
| lib/folderPaths.ts (79) | KEEP (W2) |
| lib/utils.ts (`cn`, formatters) | `cn` DROP; formatters → `lib/format.ts` |
| lib/cleanup-legacy-sw.ts | KEEP → `lib/sw-cleanup.ts` |
| types/index.ts (103) | KEEP → `types.ts` |

## Realtime events (all KEEP)

| Event | Publisher | Consumer | Poll fallback |
|---|---|---|---|
| `asset_conversion_progress` | `vms/tools.py:367` | ProjectDetailPage | 5 s `get_project_assets` while converting |
| `proxy_generation_progress` | `vms/proxy.py:161` | ReviewPage | 5 s `get_proxy_status` |
| `youtube_upload_progress` | `vms/youtube.py:456` | YouTubeUploadDialog | 5 s `get_youtube_upload_status` |
| `compress_progress` | `vms/tools.py:207` | ToolsPage | 5 s `get_compress_status` |
| Notification Log doc events | Frappe | NotificationSheet | none (reload on open) |

## localStorage

| Key | Verdict |
|---|---|
| `vms_guest_name` | KEEP |
| `theme` | NEW (frappe-ui) |
| `vms_asset_view`, `vms_sidebar_more` | NEW (§7) |

## Dependencies

| Package | Verdict |
|---|---|
| react, react-dom, react-router, frappe-react-sdk | DROP |
| @base-ui/react, shadcn, class-variance-authority, clsx, tailwind-merge | DROP |
| @tanstack/react-table | DROP |
| @tiptap/* , tippy.js, lowlight | DROP (frappe-ui/editor) |
| cmdk | DROP |
| sonner, vaul, next-themes | DROP |
| emblor | DROP |
| lucide-react, @hugeicons/* | DROP (lucide CSS classes) |
| yet-another-react-lightbox, react-medium-image-zoom | DROP |
| date-fns | DROP (frappe-ui dayjs) |
| fabric ^7 | KEEP |
| vite-plugin-pwa, workbox-* | KEEP |
| tailwindcss 4 + @tailwindcss/vite | → tailwindcss 3.4 + postcss |

## e2e (KEEP, W10)

`e2e/tests/`: auth.setup, command-palette (22), deletion (19), onboarding
(5), projects (5), sharing (12), thumbnail (1), tools (13), transcription
(16), uploads (9), version-upload (4). Fixtures in `e2e/fixtures`, page
objects in `e2e/pages`. Add `e2e/helpers/ui.ts` in W0.

## Backend (unchanged reference)

`vms/api.py`, `vms/review_api.py`, `vms/transcription.py`, `vms/youtube.py`,
`vms/tools_api.py`, `vms/video_split.py`, `vms/proxy.py` — full method list
in master plan §6 rows. DocTypes under
`vms/video_management_solution/doctype/`: vms_asset, vms_asset_version,
vms_audit_log, vms_compress_job, vms_folder, vms_project, vms_render_job,
vms_review_comment, vms_settings, vms_youtube_channel.
