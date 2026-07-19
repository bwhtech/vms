import { useMemo, useState } from "react"
import { useFrappeGetDocList, useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VMSFolder } from "@/types"
import { buildFolderOptions, collectDescendants } from "@/lib/folderPaths"

interface MoveFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: VMSFolder
  project: string
  onComplete?: () => void
}

const ROOT_VALUE = "__root__"

export function MoveFolderDialog({
  open,
  onOpenChange,
  folder,
  project,
  onComplete,
}: MoveFolderDialogProps) {
  const [target, setTarget] = useState<string>("")
  const { call: moveFolder, loading } = useFrappePostCall("vms.api.move_folder")

  // Reset on close rather than in an effect on open — the dialog is unmounted-ish
  // between uses anyway, and a stale destination from the last folder would be wrong.
  const handleOpenChange = (next: boolean) => {
    if (!next) setTarget("")
    onOpenChange(next)
  }

  const { data: folders } = useFrappeGetDocList<VMSFolder>("VMS Folder", {
    fields: ["name", "folder_name", "parent_folder"],
    filters: [["project", "=", project], ["deleted_at", "is", "not set"]],
    orderBy: { field: "folder_name", order: "asc" },
    limit: 500,
  })

  // A folder can't move into itself or into anything beneath it, and moving it
  // where it already is would be a no-op.
  const destinations = useMemo(() => {
    const all = folders ?? []
    const blocked = collectDescendants(all, folder.name)
    return buildFolderOptions(all).filter(
      (f) => !blocked.has(f.name) && f.name !== folder.parent_folder,
    )
  }, [folders, folder.name, folder.parent_folder])

  const handleMove = async () => {
    if (!target) {
      toast.error("Please select a destination")
      return
    }

    try {
      const parent = target === ROOT_VALUE ? null : target
      await moveFolder({ folder_name_id: folder.name, parent_folder: parent })
      toast.success(`Moved "${folder.folder_name}"`)
      handleOpenChange(false)
      onComplete?.()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to move folder"
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Folder</DialogTitle>
          <DialogDescription>
            Move “{folder.folder_name}” and everything inside it to another folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Destination</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string | null) => {
                  if (!value) return "Select a folder..."
                  if (value === ROOT_VALUE) return "Project Root (no folder)"
                  return destinations.find((f) => f.name === value)?.path ?? value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {folder.parent_folder && (
                <SelectItem value={ROOT_VALUE}>Project Root (no folder)</SelectItem>
              )}
              {destinations.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.ancestors.length > 0 && (
                    <span className="text-muted-foreground">
                      {f.ancestors.join(" / ")} /{" "}
                    </span>
                  )}
                  {f.folderName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={loading || !target}>
            {loading ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
