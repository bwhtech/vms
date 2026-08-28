# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VMS (Video Management Solution) is a Frappe application with a Vue 3 + frappe-ui frontend. Monorepo layout: Python backend in `vms/`, frontend in `frontend/`, Playwright e2e suite in `e2e/`.

The rewrite plan and screen specs live in `plans/frappe-ui-rewrite.md`; read the relevant section before changing a screen.

## Testing

After building a frontend feature, test in the browser with the `agent-browser` skill at `vms.localhost:8000/vms` (login `Administrator` / `admin`). Frappe serves the built bundle, so run `yarn build` first — the Vite dev server is not what the site serves. For backend checks use the bench CLI (`bench --site vms.localhost execute ...`).

The e2e suite is the acceptance bar: `npx playwright test` from the app root runs against the live site (no web server is started). Keep it green.

## Common Commands

### Frontend (`frontend/`)
```bash
yarn dev          # Vite dev server on localhost:8080
yarn build        # Build to vms/public/frontend/ + vms/www/vms.html, copy sw.min.js
yarn typecheck    # vue-tsc --noEmit
yarn lint         # eslint + prettier --check
yarn format       # prettier --write src
```

### Backend / Frappe
```bash
bench start
bench --site vms.localhost run-tests --app vms
bench --site vms.localhost migrate
```

IMPORTANT: to create new DocTypes, use `new_doc` via `bench execute` with a temp script in the `vms/` module path, then edit the generated JSON directly. This gives you the boilerplate files and folder structure.

### Code Quality
```bash
pre-commit run --all-files    # ruff, prettier, eslint
```

## Frontend rules

- Load the `/frappe-ui` skill (`DESIGN.md`, `COMPONENTS.md`, `TOKENS.md`) before writing UI. Use frappe-ui components (`Button`, `Dialog`, `dialog.*`, `List`, `Select`, `FormControl`, `Dropdown`, `Badge`, `toast`, `PageHeader`, `SettingsDialog`, `CommandPalette` …) — do not hand-roll equivalents. `PageHeader` has only a default slot.
- Colours come from frappe-ui semantic tokens only (`text-ink-gray-*`, `bg-surface-*`, `border-outline-gray-*`). `grep -rE 'text-gray-|bg-gray-|border-gray-' frontend/src` must stay empty.
- Icons are `lucide-*` spans (unplugin-icons); no per-icon component imports.
- Data layer: `useCall` / `useList` / `useDoc` from frappe-ui against `/api/v2/method/...` and `/api/v2/document/...`. No `fetch`, `axios` or `createResource`. Realtime goes through `composables/useRealtime.ts` (`onRealtime`) — frappe-ui beta.55 has no `initSocket`.
- Shared state is in `composables/` (`useSession`, `useOverlays`, `useUploadQueue`, `useReview`, `useNotifications`, …). Global overlays (upload, settings, palette, notifications, shortcuts) are mounted once in `components/shell/AppShell.vue` and opened via `useOverlays()`.
- Layout: `PageHeader` + content with gutters `px-3 py-5 pb-10 sm:px-5`; one solid primary action per screen. `SidePanel` (`components/common/SidePanel.vue`) is the right-hand panel — frappe-ui `Dialog` cannot dock right.
- Guest pages (`/review/:id?token=`, `/shared/:id?token=`) render outside the shell and must work logged out.
- Keep page files under ~400 LOC; split into `components/<area>/`.

## Cloudflare (Wrangler CLI)

Always use `npx wrangler`.

```bash
npx wrangler whoami
npx wrangler r2 bucket list
npx wrangler r2 object put <bucket>/<key> --file <path>
npx wrangler r2 object get <bucket>/<key>
```

- R2 bucket: `vms-media`
- Account ID: `d6c626b7fc4903cf137f782c7ff88d7a`
- If not authenticated, run `npx wrangler login`.
