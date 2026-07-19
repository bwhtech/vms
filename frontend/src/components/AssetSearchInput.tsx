import { Input } from "@/components/ui/input"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface AssetSearchInputProps {
  value: string
  onChange: (search: string) => void
  placeholder?: string
}

export function AssetSearchInput({ value, onChange, placeholder = "Search files..." }: AssetSearchInputProps) {
  return (
    <div className="relative">
      <HugeiconsIcon
        icon={Search01Icon}
        strokeWidth={2}
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search files"
        className="h-8 w-40 pl-8 pr-7 text-sm sm:w-56"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted-foreground/20"
          aria-label="Clear search"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
