import { test, expect, type Page } from "@playwright/test";
import {
	cleanupTestProjects,
	createTestProject,
	generateProjectName,
	getProject,
	VMSProject,
} from "../helpers/vms";
import { callGetMethod } from "../helpers/frappe";
import { dialog, dialogButton, dropdownItem, formControl } from "../helpers/ui";

const PIN_API =
	"vms.video_management_solution.doctype.vms_pinned_project.vms_pinned_project";

function sidebarRow(page: Page, name: string) {
	return page.locator(`[data-testid="sidebar-project"][data-project="${name}"]`);
}

test.describe("Sidebar project row actions", () => {
	let project: VMSProject;

	test.beforeEach(async ({ request }) => {
		project = await createTestProject(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestProjects(request);
	});

	test("should pin a project to the top of the list", async ({
		page,
		request,
	}) => {
		await page.goto("/vms/projects");
		await page.waitForLoadState("networkidle");

		const row = sidebarRow(page, project.name);
		await expect(row).toBeVisible({ timeout: 10000 });
		await row.click({ button: "right" });
		await dropdownItem(page, "Pin to top").click();

		await expect(row).toHaveAttribute("data-pinned", "true", {
			timeout: 10000,
		});
		// Pinned rows lead the list, whatever the recent-projects order says.
		// Any pin the session user already had stays above, so the assertion is
		// that no unpinned row comes first — not that this row is row zero.
		const order = await page
			.locator('[data-testid="sidebar-project"]')
			.evaluateAll((rows) =>
				rows.map((row) => ({
					name: row.getAttribute("data-project"),
					pinned: row.getAttribute("data-pinned") === "true",
				})),
			);
		const index = order.findIndex((row) => row.name === project.name);
		const firstUnpinned = order.findIndex((row) => !row.pinned);
		expect(index).toBeGreaterThanOrEqual(0);
		expect(firstUnpinned === -1 || index < firstUnpinned).toBe(true);

		// The pin is per user and stored server-side, so it survives a reload.
		await page.reload();
		await page.waitForLoadState("networkidle");
		await expect(sidebarRow(page, project.name)).toHaveAttribute(
			"data-pinned",
			"true",
			{ timeout: 10000 },
		);

		await sidebarRow(page, project.name).click({ button: "right" });
		await dropdownItem(page, "Unpin").click();
		await expect(sidebarRow(page, project.name)).not.toHaveAttribute(
			"data-pinned",
			"true",
			{ timeout: 10000 },
		);

		const pinned = await callGetMethod<string[]>(
			request,
			`${PIN_API}.get_pinned_projects`,
		);
		expect(pinned).not.toContain(project.name);
	});

	test("should rename a project from the row menu", async ({
		page,
		request,
	}) => {
		await page.goto("/vms/projects");
		await page.waitForLoadState("networkidle");

		const row = sidebarRow(page, project.name);
		await expect(row).toBeVisible({ timeout: 10000 });
		await row.click({ button: "right" });
		await dropdownItem(page, "Rename").click();

		await expect(dialog(page, "Rename project")).toBeVisible();
		const renamed = generateProjectName();
		await formControl(page, "Project name").fill(renamed);
		await dialogButton(page, "Rename", "Rename project").click();

		await expect(async () => {
			const updated = await getProject(request, project.name);
			expect(updated.project_name).toBe(renamed);
		}).toPass({ timeout: 10000 });
	});
});
