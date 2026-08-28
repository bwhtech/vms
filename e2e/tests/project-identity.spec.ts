import { test, expect } from "@playwright/test";
import {
	cleanupTestProjects,
	createTestProject,
	generateProjectName,
	getProject,
	VMSProject,
} from "../helpers/vms";
import {
	dialog,
	dialogButton,
	formControl,
	popover,
	tab,
	tabPanel,
	testId,
} from "../helpers/ui";

/**
 * A project's identity is a curated lucide icon on a tinted square, or a
 * DiceBear avatar generated in the browser. The six fields behind it always
 * move together, so every assertion below reads the stored row rather than
 * trusting the mark on screen.
 */
test.describe("Project identity", () => {
	test.afterAll(async ({ request }) => {
		await cleanupTestProjects(request);
	});

	test("should pick an icon and colour while creating a project", async ({
		page,
		request,
	}) => {
		await page.goto("/vms/projects");
		await page.waitForLoadState("networkidle");

		await testId(page, "new-project").click();
		await expect(dialog(page, "New project")).toBeVisible({ timeout: 5000 });

		await testId(page, "project-icon-trigger").click();
		await expect(popover(page)).toBeVisible();
		await popover(page).getByRole("button", { name: "green" }).click();
		// Picking the icon is what closes the popover.
		await popover(page).getByRole("button", { name: "rocket" }).click();

		const projectName = generateProjectName();
		await formControl(page, "Project name").fill(projectName);
		await dialogButton(page, "Create project", "New project").click();
		await page.waitForURL(/\/vms\/projects\/VMS-PROJ-/, { timeout: 15000 });

		const id = page.url().split("/").pop() as string;
		const project = await getProject(request, id);
		expect(project.icon).toBe("rocket");
		expect(project.color).toBe("green");
		expect(project.avatar || "").toBe("");
	});

	test("should generate an avatar from the project header", async ({
		page,
		request,
	}) => {
		const created: VMSProject = await createTestProject(request);

		await page.goto(`/vms/projects/${created.name}`);
		await page.waitForLoadState("networkidle");

		await testId(page, "project-icon-trigger").click();
		await expect(popover(page)).toBeVisible();
		await popover(page).getByRole("radio", { name: "Avatar" }).click();
		// The style definitions are code-split, so the first render downloads a chunk.
		await expect(testId(page, "project-avatar-shuffle")).toBeVisible({
			timeout: 15000,
		});

		await expect(async () => {
			const project = await getProject(request, created.name);
			expect(project.avatar ?? "").toContain("data:image/svg+xml");
			expect(project.avatar_style).toBe("glass");
			expect(project.avatar_seed ?? "").not.toBe("");
		}).toPass({ timeout: 15000 });
	});

	test("should reject an avatar that is not an SVG data URI", async ({
		request,
	}) => {
		const created = await createTestProject(request);
		const response = await request.put(
			`/api/v2/document/VMS Project/${created.name}`,
			{ data: { avatar: "<svg onload=alert(1)></svg>" } },
		);
		expect(response.ok()).toBe(false);
	});
});

test.describe("Appearance settings", () => {
	test("should offer the theme picker in its own tab", async ({ page }) => {
		await page.goto("/vms/projects?settings=appearance");
		await page.waitForLoadState("networkidle");

		await expect(tab(page, "Appearance")).toHaveAttribute(
			"data-state",
			"active",
		);
		const panel = tabPanel(page);
		await expect(panel.getByText("Theme")).toBeVisible();
		for (const label of ["Light", "Dark", "System"]) {
			await expect(panel.getByText(label, { exact: true })).toBeVisible();
		}
	});
});
