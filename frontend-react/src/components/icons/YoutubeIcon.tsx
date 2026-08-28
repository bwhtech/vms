import { HugeiconsIcon } from "@hugeicons/react"
import { YoutubeIcon as HugeYoutubeIcon } from "@hugeicons/core-free-icons"

/**
 * Lucide v1 dropped brand icons, so YouTube stays on hugeicons. Wrapped as a
 * plain component so it drops into the same slots as any lucide icon.
 */
export function YoutubeIcon({
  size,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <HugeiconsIcon
      icon={HugeYoutubeIcon}
      strokeWidth={2}
      size={size}
      className={className}
    />
  )
}
