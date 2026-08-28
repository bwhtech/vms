import { expect, Locator, Page } from "@playwright/test";
import {
	commandPalette,
	commandPaletteInput,
	dialog,
	dropdownItem,
	sidebarHeaderButton,
	sidebarItem,
	sidePanel,
} from "../helpers/ui";

/**
 * The logged-in shell (`AppShell` + `AppSidebar`). Pages inside the shell wait
 * on the sidebar before interacting; "Home" is the first nav row.
 */
export class Shell {
	constructor(readonly page: Page) {}

	async goto(path = "/vms"): Promise<void> {
		await this.page.goto(path);
		await this.page.waitForLoadState("networkidle");
		await this.waitForReady();
	}

	async waitForReady(): Promise<void> {
		await expect(sidebarItem(this.page, "Home")).toBeVisible({ timeout: 15000 });
	}

	/**
	 * Open the command palette with Mod+K (`useKeyboardShortcut` in the shell).
	 * The "Desktop Chrome" device profile reports a non-Mac platform, so
	 * frappe-ui resolves `Mod` to Control regardless of the host OS.
	 */
	async openCommandPalette(): Promise<Locator> {
		await this.page.keyboard.press("Control+k");
		await expect(commandPalette(this.page)).toBeVisible({ timeout: 5000 });
		return commandPaletteInput(this.page);
	}

	/** Open Settings from the `SidebarHeader` workspace menu. */
	async openSettings(): Promise<Locator> {
		await sidebarHeaderButton(this.page).click();
		await dropdownItem(this.page, "Settings").click();
		const settings = dialog(this.page, "Settings");
		await expect(settings).toBeVisible({ timeout: 10000 });
		return settings;
	}
}

/**
 * `/vms/review/:assetId` (`ReviewPage` + `ReviewHeader`), rendered outside the shell.
 * Secondary actions (Transcribe, New version, …) sit in the header's "More actions" `Dropdown`.
 */
export class ReviewPage {
	constructor(readonly page: Page) {}

	async goto(assetName: string): Promise<void> {
		await this.page.goto(`/vms/review/${assetName}`);
		await this.page.waitForLoadState("networkidle");
		await expect(this.moreActionsButton()).toBeVisible({ timeout: 15000 });
	}

	moreActionsButton(): Locator {
		return this.page.getByRole("button", { name: "More actions" });
	}

	/** Open the "More actions" menu and return the item matching `label`. */
	async menuItem(label: string | RegExp): Promise<Locator> {
		await this.moreActionsButton().click();
		return dropdownItem(this.page, label);
	}

	transcriptionPanel(): Locator {
		return sidePanel(this.page, "Transcription");
	}
}
