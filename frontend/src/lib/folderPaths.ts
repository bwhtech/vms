import type { VMSFolder } from "@/types"

/** Matches the depth cap in the VMS Folder controller — corrupt parent data can't spin. */
const MAX_FOLDER_DEPTH = 50

export interface FolderOption {
  name: string
  /** Ancestor names, root first. Empty for a top-level folder. */
  ancestors: string[]
  folderName: string
  /** "B-roll / Drone Shots / Sunset" — used for sorting and trigger labels. */
  path: string
}

/** Folders can share a name in different branches, so options are labelled by path. */
export function buildFolderOptions(folders: VMSFolder[]): FolderOption[] {
  const byName = new Map(folders.map((f) => [f.name, f]))
  const options = folders.map((folder) => {
    const ancestors: string[] = []
    let node = folder.parent_folder ? byName.get(folder.parent_folder) : undefined
    while (node && ancestors.length < MAX_FOLDER_DEPTH) {
      ancestors.unshift(node.folder_name)
      node = node.parent_folder ? byName.get(node.parent_folder) : undefined
    }
    return {
      name: folder.name,
      ancestors,
      folderName: folder.folder_name,
      path: [...ancestors, folder.folder_name].join(" / "),
    }
  })
  return options.sort((a, b) => a.path.localeCompare(b.path))
}

/** The folder itself plus everything under it — never valid move destinations. */
export function collectDescendants(folders: VMSFolder[], root: string): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const f of folders) {
    const parent = f.parent_folder ?? ""
    const siblings = childrenOf.get(parent) ?? []
    siblings.push(f.name)
    childrenOf.set(parent, siblings)
  }

  const blocked = new Set<string>()
  const queue = [root]
  while (queue.length) {
    const current = queue.shift()!
    if (blocked.has(current)) continue
    blocked.add(current)
    queue.push(...(childrenOf.get(current) ?? []))
  }
  return blocked
}
