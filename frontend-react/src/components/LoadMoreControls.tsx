import { Button } from "@/components/ui/button"

export function LoadMoreControls({
  loaded,
  total,
  pageSize,
  isLoading,
  onLoadMore,
}: {
  loaded: number
  total: number
  pageSize: number
  isLoading: boolean
  onLoadMore: () => void
}) {
  if (total <= pageSize) return null

  const remaining = total - loaded

  return (
    <div className="flex flex-col items-center gap-2 pt-6">
      <span className="text-sm text-muted-foreground">
        Showing {loaded} of {total}
      </span>
      {remaining > 0 && (
        <Button variant="outline" size="sm" disabled={isLoading} onClick={onLoadMore}>
          {isLoading ? "Loading..." : `Load more (${remaining} left)`}
        </Button>
      )}
    </div>
  )
}
