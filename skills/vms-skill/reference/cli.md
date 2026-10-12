# vmsctl command reference

`python3 scripts/vmsctl.py <command> -h` prints the exact flags. This page maps each
command to the server call behind it, for when you need the raw API through
`frappectl api method/<method>`.

Global flags: `-s/--site <profile>` (default `$VMS_SITE`), `--json`.

| Command | What it does | Server call |
|---|---|---|
| `projects [query]` | list projects | `doc list "VMS Project"` |
| `ls <path> [-r]` | folders and files at a path | `doc list "VMS Folder"`, `doc list "VMS Asset"` |
| `tree <path> [-d N]` | folder tree with file counts | same |
| `find <text> [--in path] [--limit N]` | files whose name contains text | `doc list "VMS Asset"` with `file_name like` |
| `info <file>` | one file's fields | `doc list "VMS Asset"` |
| `link <path>… [-r] [--download]` | presigned view or download links | `vms.api.get_view_url`, `vms.api.get_download_url` |
| `get <path>… [-r] [-o dir]` | download to disk | `vms.api.get_download_url`, then HTTP GET |
| `transcript <file>` | transcript markdown | `vms.transcription.get_transcription` (GET) |
| `mkdir <path> [-p]` | create a folder | `vms.api.create_folder` |
| `rename <path> <new name>` | rename a file or folder | `vms.api.rename_asset`, `vms.api.rename_folder` |
| `mv <path>… <dest>` | move files or folders | `vms.api.move_asset` (other project), `vms.api.move_assets_to_folder`, `vms.api.move_folder` |
| `tag <file> <tag>… [--rm]` | add or remove tags | `vms.api.add_asset_tag`, `vms.api.remove_asset_tag` |
| `category <Footage\|For Review\|Deliverable> <file>…` | set the category | `vms.api.update_asset_category` |
| `share <path> [--off]` | public link | `vms.api.enable_project_sharing`, `vms.api.enable_folder_sharing`, `vms.review_api.toggle_public_review` (and their disable forms) |
| `upload <path>… --to <dest> [--category C] [-n] [--force]` | upload | see below |

## Paths

`Project/Folder/Sub/file.ext`. The first segment is a project name, a unique substring of
one, or its ID. Later segments match folder names case-insensitively. The last segment can
be a file name. Trashed folders and files never match. Inbox files (no project) have no
path. Reach them by `VMS-ASSET-…` ID.

## Output shapes

Text output puts the ID after `·`:

```
Raw/  ·VMS-FLD-00001
clip.mp4  1.2 GB  4:31  Footage  #broll  ·VMS-ASSET-00042
```

`link` prints `path<TAB>url` per file. `get` and `upload` report progress on stderr and,
with `--json`, print what they did on stdout.

## Upload flow

1. `vms.api.get_upload_url(file_name, content_type, file_size, project, folder, category)`
   creates the asset in `Uploading` status. It returns `upload_url`, or for files above
   2 GB, `upload_id` and `part_size`.
2. Single PUT: `PUT upload_url` with the same `Content-Type`.
   Multipart: for each part, `vms.api.get_part_upload_url(r2_key, upload_id, part_number)`,
   then `PUT`. Keep each `ETag`. Then `vms.api.complete_multipart(asset_name, upload_id, parts)`.
3. `vms.api.confirm_upload(asset_name, file_size)` marks it Ready and queues the thumbnail.

On failure the tool calls `vms.api.fail_upload` or `vms.api.abort_multipart`.
