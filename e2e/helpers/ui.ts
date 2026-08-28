import { Locator, Page } from "@playwright/test";

/**
 * frappe-ui locator helpers (frappe-ui 1.0.0-beta, reka-ui primitives).
 *
 * Selectors are derived from `frontend/node_modules/frappe-ui/src` and the
 * `experimental/CommandPalette` family. Page objects switch to these in W10;
 * spec files should not hand-roll frappe-ui selectors.
 */

type TextMatch = string | RegExp;

/**
 * Element with `data-testid` — the escape hatch for app-specific markup.
 */
export function testId(page: Page, id: string): Locator {
  return page.getByTestId(id);
}

/**
 * `Dialog` → reka `DialogContent` (`role="dialog"`, `.dialog-content`), named by `DialogTitle` via aria-labelledby.
 * Covers `dialog.confirm / prompt / danger`, `SettingsDialog` and `CommandPalette` (all render through `Dialog`).
 */
export function dialog(page: Page, title?: TextMatch): Locator {
  return title
    ? page.getByRole("dialog", { name: title })
    : page.getByRole("dialog");
}

/**
 * Action button in the footer of a `Dialog` (`actions` prop or `#actions` slot renders `<Button>`s).
 */
export function dialogButton(
  page: Page,
  label: TextMatch,
  title?: TextMatch,
): Locator {
  return dialog(page, title).getByRole("button", { name: label });
}

/**
 * `Dropdown` / `ContextMenu` item → reka `DropdownMenuItem` (`role="menuitem"`, `data-slot="item"`) inside `[data-slot="content"]`.
 */
export function dropdownItem(page: Page, label: TextMatch): Locator {
  return page.getByRole("menuitem", { name: label });
}

/**
 * Open `Dropdown` panel → reka `DropdownMenuContent` (`role="menu"`, `data-slot="content"`) portalled to body.
 */
export function dropdownMenu(page: Page): Locator {
  return page.getByRole("menu");
}

/**
 * `Sidebar` root → `[data-slot="sidebar"]` (`data-state` = expanded | collapsed).
 */
export function sidebar(page: Page): Locator {
  return page.locator('[data-slot="sidebar"]');
}

/**
 * `SidebarItem` → `[data-slot="sidebar-item"]` (`data-state` = active | inactive) whose link/button text is `label`.
 */
export function sidebarItem(page: Page, label: TextMatch): Locator {
  return sidebar(page)
    .locator('[data-slot="sidebar-item"]')
    .filter({
      has: page.getByText(label, { exact: typeof label === "string" }),
    });
}

/**
 * Toast → vue-sonner `[data-sonner-toast]` inside `[data-sonner-toaster]` (bottom-right), filtered by its text.
 */
export function toast(page: Page, text?: TextMatch): Locator {
  const toasts = page.locator("[data-sonner-toast]");
  return text ? toasts.filter({ hasText: text }) : toasts;
}

/**
 * `List` root → `[data-slot="list"]` (`role="table"` with a header, `role="list"` without).
 */
export function list(page: Page): Locator {
  return page.locator('[data-slot="list"]');
}

/**
 * `ListRow` → `[data-slot="list-row"]` (`role="row"` | `"listitem"`, `data-state="selected"`), filtered by its text.
 */
export function listRow(page: Page, text?: TextMatch): Locator {
  const rows = page.locator('[data-slot="list-row"]');
  return text ? rows.filter({ hasText: text }) : rows;
}

/**
 * `ListRow` selection checkbox → `[data-slot="list-row-checkbox"]` (`role="checkbox"`) of the row matching `text`.
 */
export function listRowCheckbox(page: Page, text: TextMatch): Locator {
  return listRow(page, text).locator('[data-slot="list-row-checkbox"]');
}

/**
 * `FormControl` / `TextInput` / `Select` … → control associated with `InputLabel` (`<label for=id data-slot="label">`).
 */
export function formControl(page: Page, label: TextMatch): Locator {
  return page.getByLabel(label);
}

/**
 * Button inside `PageHeader` / `PageHeaderBase` → `<header>` (may be teleported to the shell's header target).
 */
export function pageHeaderButton(page: Page, label: TextMatch): Locator {
  return page.locator("header").getByRole("button", { name: label });
}

/**
 * `PageHeader` region → the `<header>` element rendered by `PageHeaderBase`.
 */
export function pageHeader(page: Page): Locator {
  return page.locator("header");
}

/**
 * `CommandPalette` (experimental) → reka `ListboxRoot` `[data-slot="command-palette"]` inside a bare `Dialog`.
 */
export function commandPalette(page: Page): Locator {
  return page.locator('[data-slot="command-palette"]');
}

/**
 * `CommandPaletteInput` → `<input>` inside `[data-slot="command-palette-input"]`.
 */
export function commandPaletteInput(page: Page): Locator {
  return commandPalette(page).locator(
    '[data-slot="command-palette-input"] input',
  );
}

/**
 * `CommandPaletteItem` → `[data-slot="command-palette-item"]` (reka `ListboxItem`, `data-state="active"` when highlighted).
 */
export function commandPaletteItem(page: Page, label: TextMatch): Locator {
  return commandPalette(page)
    .locator('[data-slot="command-palette-item"]')
    .filter({ hasText: label });
}

/**
 * `CommandPaletteEmpty` → `[data-slot="command-palette-empty"]` inside a `role="status"` wrapper.
 */
export function commandPaletteEmpty(page: Page): Locator {
  return commandPalette(page).locator('[data-slot="command-palette-empty"]');
}

/**
 * `TabTrigger` / `SettingsNavItem` → reka `TabsTrigger` (`role="tab"`, `data-slot="tab-trigger"`, `data-state="active"`).
 */
export function tab(page: Page, label: TextMatch): Locator {
  return page.getByRole("tab", { name: label });
}

/**
 * `TabPanel` / `SettingsPanel` → reka `TabsContent` (`role="tabpanel"`); only the active panel is rendered.
 */
export function tabPanel(page: Page): Locator {
  return page.getByRole("tabpanel");
}

/**
 * `Popover` panel → reka `PopoverContent` `[data-slot="content"]` (`data-state="open"`), portalled to body.
 */
export function popover(page: Page): Locator {
  return page.locator(
    '[data-slot="content"][data-state="open"]:not([role="menu"])',
  );
}

/**
 * `SidePanel` (app component, `components/common/SidePanel.vue`) → `<aside role="dialog" data-slot="side-panel" aria-label=title>`.
 * Versions / Transcription / Notifications open in this panel, not in a `Dialog`.
 */
export function sidePanel(page: Page, title?: TextMatch): Locator {
  const panels = page.locator('[data-slot="side-panel"]');
  return title ? panels.filter({ has: page.getByRole("heading", { name: title }) }) : panels;
}

/**
 * `SidebarHeader` workspace button → the `Dropdown` trigger inside `[data-slot="sidebar-header"]`
 * (Settings / Keyboard shortcuts / Log out live in this menu).
 */
export function sidebarHeaderButton(page: Page): Locator {
  return sidebar(page).locator('[data-slot="sidebar-header"] button').first();
}

/**
 * `SettingsNavItem` → reka `TabsTrigger` (`role="tab"`) whose `data-state="active"` marks the selected tab.
 */
export function activeTab(page: Page, label: TextMatch): Locator {
  return page.getByRole("tab", { name: label }).and(page.locator('[data-state="active"]'));
}

/**
 * `ListGroup` → `[data-slot="list-group"]` (`role="rowgroup"`) whose header text is `label`.
 */
export function listGroup(page: Page, label: TextMatch): Locator {
  return page
    .locator('[data-slot="list-group"]')
    .filter({ has: page.locator('[data-slot="list-group-header"]', { hasText: label }) });
}

/**
 * `Select` → reka `SelectTrigger` (`role="combobox"`, `data-slot="trigger"`).
 */
export function selectTrigger(scope: Page | Locator): Locator {
  return scope.locator('[data-slot="trigger"][role="combobox"]');
}
