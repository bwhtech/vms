import { test, expect } from "@playwright/test";
import { dropdownItem, sidebar } from "../helpers/ui";
import { callGetMethod } from "../helpers/frappe";

/**
 * The switcher is fed by `frappe.apps.get_apps` — the site-wide apps-screen
 * list — so what it offers depends on which apps the site has installed. The
 * one row it always has is Desk, added client-side for System Managers.
 */
test.describe("App switcher", () => {
	test("lists Desk and the site's other apps, but not VMS itself", async ({
		page,
		request,
	}) => {
		const apps = await callGetMethod<
			{ name: string; title: string; route: string }[]
		>(request, "frappe.apps.get_apps");

		await page.goto("/vms/projects");
		await page.waitForLoadState("networkidle");

		await sidebar(page).locator('[data-slot="sidebar-header"] button').click();
		await dropdownItem(page, "Switch app").hover();

		const desk = dropdownItem(page, "Desk");
		await expect(desk).toBeVisible({ timeout: 10000 });
		await expect(dropdownItem(page, "VMS")).toHaveCount(0);

		for (const app of apps.filter((app) => app.name !== "vms")) {
			await expect(dropdownItem(page, app.title)).toBeVisible();
		}

		await desk.click();
		await expect(page).toHaveURL(/\/desk/);
	});
});
