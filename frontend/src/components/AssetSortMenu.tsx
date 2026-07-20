import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, Check } from "lucide-react"

export type AssetSortField = "creation" | "file_size" | "file_name"
export type AssetSortOrder = "asc" | "desc"

export interface AssetSort {
  field: AssetSortField
  order: AssetSortOrder
}

export const DEFAULT_ASSET_SORT: AssetSort = { field: "creation", order: "desc" }

const SORT_OPTIONS: { label: string; sort: AssetSort }[] = [
  { label: "Newest first", sort: { field: "creation", order: "desc" } },
  { label: "Oldest first", sort: { field: "creation", order: "asc" } },
  { label: "Name (A–Z)", sort: { field: "file_name", order: "asc" } },
  { label: "Name (Z–A)", sort: { field: "file_name", order: "desc" } },
  { label: "Largest first", sort: { field: "file_size", order: "desc" } },
  { label: "Smallest first", sort: { field: "file_size", order: "asc" } },
]

interface AssetSortMenuProps {
  value: AssetSort
  onChange: (sort: AssetSort) => void
}

export function AssetSortMenu({ value, onChange }: AssetSortMenuProps) {
  const active = SORT_OPTIONS.find(
    (o) => o.sort.field === value.field && o.sort.order === value.order
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <ArrowUpDown data-icon="inline-start" />
        <span className="hidden sm:inline">{active ? active.label : "Sort"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={`${option.sort.field}-${option.sort.order}`}
            onClick={() => onChange(option.sort)}
          >
            <span className="flex-1">{option.label}</span>
            {option === active && (
              <Check className="size-3.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
