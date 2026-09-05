# Folder-scoped sharing

## Problem

Sharing today is project-wide only. `VMS Project` carries a single `share_token`;
`get_shared_project_assets` filters by `{project}` and returns every asset in the
project as a flat list. There is no way to share one folder without exposing the
rest of the project.

## Goal

Share a single folder. A guest with a folder link sees the files **directly in
that folder** — not its subfolders, not sibling or parent folders.

## Decisions

- **Scope**: the folder's own assets only. Nested subfolders are not shown or
  reachable.
- **Independence**: each folder carries its own `share_token`, unrelated to the
  project's share or any other folder's. Project + any number of folders can be
  shared at once; revoking one touches nothing else.
- **URL**: `/vms/shared/folder/<folder-id>?token=…` — no project segment, so
  moving the folder between projects never breaks the link.
- **Lifecycle**: moving the folder keeps the link. Trashing the folder clears its
  `share_token` (link dies). Restoring does not bring the link back — the user
  re-shares. The link always reflects the folder's current files.
- **Guest page**: reuses the existing shared-page shell — folder name as title,
  flat grid, preview, per-file download, "Download all".
- **Entry points**: a "Share" item on each folder card's ⋮ menu (grid and list
  view) and in the "Folder actions" dropdown when inside a folder. Opens a side
  panel like the project one.

## Out of scope

Recursive/subtree sharing · link expiry / passwords · audit-log entries for
share actions (project sharing isn't audited either) · zip download · guest
uploads · extracting sharing out of `api.py`.

## Backend (`vms/api.py`, `vms_folder`)

- `VMS Folder` gains `share_section` + `share_token` (Data, hidden, read-only,
  unique) — mirrors `VMS Project`.
- `VMSFolder.revoke_share_on_trash()` (called from `validate`): clears
  `share_token` whenever `deleted_at` is set. Covers every trash path since they
  all `.save()`.
- New whitelisted methods:
  | Method | Auth | Returns |
  | --- | --- | --- |
  | `enable_folder_sharing(folder)` | `require_vms_access()` | `{share_token, share_url}` |
  | `disable_folder_sharing(folder)` | `require_vms_access()` | `{status: "ok"}` |
  | `get_shared_folder(folder, token)` | guest | `{name, folder_name, project_name}` |
  | `get_shared_folder_assets(folder, token, page, page_size)` | guest | same shape as `get_shared_project_assets`, filtered to `{folder}` |
- `_validate_folder_token(folder, token)` — mirrors `_validate_project_token`,
  also rejects a trashed folder.
- `_validate_shared_asset_scope(project, token, folder)` — returns the
  `(field, value)` a shared asset must match: `("folder", folder)` when `folder`
  is given, else `("project", project)`.
- `get_shared_asset_view_url` / `get_shared_asset_download_url` gain an optional
  `folder` param and use `_validate_shared_asset_scope`. `project` becomes
  optional. Behaviour with no `folder` is unchanged.

## Frontend

- `types.ts`: `Folder.share_token?: string | null`.
- `useProjectBrowser`: add `share_token` to the folders `useList` fields.
- `FolderCard.vue` / `FolderRow.vue`: `Share` menu item, `emit('share', folder)`.
- `AssetList.vue`: forward `share-folder`.
- `useProjectPageActions`: `shareFolderOpen` + `shareFolderTarget` state,
  `openShareFolder(folder)`, `Share` entry in `folderActions`.
- `ShareFolderPanel.vue` (new, ~90 lines, mirrors `ShareProjectPanel.vue`):
  toggle that calls `enable_folder_sharing` / `disable_folder_sharing`, shows and
  copies the link.
- `ProjectDetailPage.vue`: wire `@share` / `@share-folder`, mount
  `<ShareFolderPanel>`.
- `router.ts`: `/shared/folder/:folderId` → `SharedProjectPage.vue`, `props: true`,
  `meta: { guest: true }`.
- `SharedProjectPage.vue`: optional `folderId` prop. When set, `isFolder` swaps
  the info/assets endpoints to the folder ones and passes `folder` (not
  `project`) to the asset-URL calls; title shows the folder name; status badge
  and description are hidden. `downloadAll` unchanged.

## Testing

Deferred — full e2e/unit suite is a follow-up. One security assertion was
verified during implementation: folder A (file a1) with subfolder B (b1) and
sibling C (c1); sharing A, a guest gets a1 only, b1/c1 are rejected; trashing A
clears the token and kills the link.
