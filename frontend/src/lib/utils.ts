import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Pull the real failure reason out of a Frappe error.
 *
 * `err.message` is always the generic "There was an error." — the actual reason
 * a whitelisted method threw lives in `_server_messages`, a JSON string holding
 * an array of JSON strings. Returns "" when there is nothing useful, so callers
 * can fall back with `serverMessage(err) || "..."`.
 */
export function serverMessage(err: unknown): string {
  const raw = (err as { _server_messages?: string } | null)?._server_messages
  if (!raw) return ""

  let entries: unknown
  try {
    entries = JSON.parse(raw)
  } catch {
    return ""
  }
  if (!Array.isArray(entries)) return ""

  return entries
    .map((entry) => {
      if (typeof entry !== "string") return ""
      try {
        const parsed = JSON.parse(entry)
        return typeof parsed?.message === "string" ? parsed.message : ""
      } catch {
        return entry
      }
    })
    .map((msg) => msg.replace(/<[^>]*>/g, "").trim())
    .filter(Boolean)
    .join(" ")
}

/** Format a duration in seconds as M:SS, or H:MM:SS once it passes an hour. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
