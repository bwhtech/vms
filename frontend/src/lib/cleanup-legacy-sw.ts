// Before the worker moved to the site root, it registered at scope
// /assets/vms/frontend/ — a scope that does not cover /vms, so it never
// controlled a client. Anyone who loaded the app back then still carries that
// registration and its precache. It is inert rather than harmful, but nothing
// removes it, and the precache keeps a full copy of an old bundle on disk.
const LEGACY_SCOPE = "/assets/vms/frontend/"

export async function cleanupLegacyServiceWorker() {
  if (!("serviceWorker" in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations
        .filter((r) => new URL(r.scope).pathname === LEGACY_SCOPE)
        .map((r) => r.unregister())
    )

    // Unregistering does not drop the caches the old worker filled. Its
    // precache is keyed by the scope, so matching on that leaves the current
    // worker's caches alone.
    if ("caches" in window) {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.includes(LEGACY_SCOPE)).map((name) => caches.delete(name))
      )
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The stale
    // registration is inert, so failing to clean it up is not worth surfacing.
  }
}
