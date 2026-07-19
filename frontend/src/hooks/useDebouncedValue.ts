import { useEffect, useState } from "react"

/**
 * Returns `value` only once it has stopped changing for `delay` ms.
 *
 * Used to keep typing responsive while the settled value drives API requests.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return settled
}
