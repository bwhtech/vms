---
name: vms-skill
description: VMS (Video Management Solution) video library from the CLI, with the vmsctl.py helper over frappectl. Use when the user wants to find, list, link, download or upload VMS videos or folders; organise a VMS project (folders, move, rename, tag, category); share a project, folder or file; or read a video's transcript.
---

# VMS from the CLI

VMS keeps videos in **projects**. A project holds nested **folders**, and folders hold
**files** (assets). The video bytes live in Cloudflare R2. The site hands out short-lived
presigned links to them.

## The tool

`scripts/vmsctl.py` wraps frappectl. It needs only the standard library and Python 3.10+.

```bash
vmsctl() { python3 <this skill's folder>/scripts/vmsctl.py "$@"; }
export VMS_SITE=<frappectl profile>   # or -s on each call
```

Use a shell function. An alias does not expand in a non-interactive shell.

Everything is addressed by **path**, starting at the project name, the way the VMS app
shows it: `Acme Launch/Raw/Day 1/clip.mp4`. Names match case-insensitively. The project
part also matches a unique substring (`acme` → `Acme Launch`). An ID (`VMS-PROJ-…`,
`VMS-FLD-…`, `VMS-ASSET-…`) works anywhere a path does. Use the ID when a name is
ambiguous. The tool prints IDs after `·`.

Add `--json` to any command for machine-readable output.

## Before you start

The user owns the frappectl profile. Check it first:

```bash
frappectl -s <profile> auth whoami
```

When the user names a site, use that profile. When there are several profiles and no
name, ask. When none exists, stop and tell the user to run `frappectl auth login`. Run
no other `auth` command. The user needs the System Manager or Video Manager role.

Every action on the site goes through the tool or frappectl. Work against the API only,
even when the site runs on this machine.

## Pull videos (read)

```bash
vmsctl projects acme                       # find the project
vmsctl tree "Acme Launch" -d 2             # folder tree with file counts
vmsctl ls "Acme Launch/Raw"                # folders and files in one folder
vmsctl ls "Acme Launch/Raw" -r             # every file below, with relative paths
vmsctl find interview --in "Acme Launch"   # files by name
vmsctl info "Acme Launch/Raw/clip.mp4"
vmsctl link "Acme Launch/Raw/clip.mp4"     # streaming link
vmsctl link "Acme Launch/Raw" -r --download   # download links for a whole folder
vmsctl get "Acme Launch/Raw" -r -o ~/Downloads   # download, keeping the folder structure
vmsctl transcript "Acme Launch/Raw/clip.mp4"
```

Links expire (VMS Settings → presigned URL expiry). Hand them to the user right away, or
fetch fresh ones.
Each download link writes a Download entry to the VMS audit log, so use `link` without
`--download` when the user only wants to watch. `get` skips files that are already on disk
at the same size, so running it again resumes a folder.

## Organise and upload (write)

```bash
vmsctl mkdir "Acme Launch/Raw/Day 2" -p
vmsctl upload ./shoot --to "Acme Launch/Raw" -n   # preview first
vmsctl upload ./shoot --to "Acme Launch/Raw"      # a local folder becomes a VMS folder
vmsctl upload a.mp4 b.mp4 --to "Acme Launch/Edits" --category "For Review"
vmsctl mv "Acme Launch/Raw/clip.mp4" "Acme Launch/Selects"
vmsctl mv "Acme Launch/Raw/Day 1" "Other Project"  # a folder moves with everything in it
vmsctl rename "Acme Launch/Raw/clip.mp4" "clip-final.mp4"
vmsctl tag "Acme Launch/Raw/clip.mp4" broll drone   # --rm removes
vmsctl category Deliverable "Acme Launch/Edits/final.mp4"   # a wrong name lists the valid ones
```

Run `upload -n` first and show the user the plan. `upload` skips a file when one of that
name is already in the target folder. `--force` uploads a second copy. Large files go up
in parts, sized by the server. If an upload fails partway, the tool cleans up the half-made record.
Run the same command again to retry. Files that are already up are skipped.

## Share

```bash
vmsctl share "Acme Launch/Edits"              # public browse link for a folder
vmsctl share "Acme Launch"                    # for a whole project
vmsctl share "Acme Launch/Edits/final.mp4"    # public review link for one file
vmsctl share "Acme Launch/Edits" --off        # revoke
```

## One-way doors

Ask the user before each of these:

1. **`share`**: anyone with the link can watch the files.
2. **`share --off`**: every link already sent out stops working.
3. **`mv` of a folder to another project**: the whole subtree moves.
4. **`upload --force`**: it creates duplicates.

Deleting is not in this tool. Send the user to the VMS app for that.

## When a call fails

| Symptom | Cause | Fix |
|---|---|---|
| `matches several projects` | the name is ambiguous | Pick from the list, or use the `VMS-PROJ-…` ID. |
| `nothing named '…' in '…'. It has: …` | wrong path segment | Use a listed name. |
| `several files named '…'` | duplicate names in a folder | Use the `VMS-ASSET-…` ID it lists. |
| `Not permitted` | the user lacks a VMS role | Tell the user. A System Manager must add Video Manager. |
| `… files are not supported` | extension not allowed in VMS Settings | Tell the user. Do not rename the file to get past the check. |
| `File size exceeds …` | above the site's max file size | Tell the user. |
| `storage refused the upload (403)` | the presigned link expired or the content type changed | Run the command again. |
| `A folder named '…' already exists` | sibling name clash on `mv` or `rename` | Pick another name, or move the contents instead. |

For an error with no clear cause, run the frappectl call again with `--debug`, then give
the user the exact command and error. `reference/cli.md` lists every command and the
server method behind it, for anything the tool does not cover.
