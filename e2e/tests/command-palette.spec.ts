import { test, expect, Page } from "@playwright/test";
import {
	createTestProject,
	createTestAsset,
	cleanupTestProjects,
	searchAssets,
	searchProjects,
} from "../helpers";
import {
	activeTab,
	commandPalette,
	commandPaletteEmpty,
	commandPaletteInput,
	commandPaletteItem,
	dialog,
} from "../helpers/ui";
import { Shell } from "../pages";

// The command palette is frappe-ui's experimental `CommandPalette` inside a
// bare `Dialog`: `[data-slot="command-palette"]`, `-input`, `-item`, `-empty`.

/** Open the command palette via keyboard shortcut. */
async function openCommandPalette(page: Page) {
	await new Shell(page).openCommandPalette();
}

test.describe("Command Palette (Cmd+K)", () => {
	test.beforeEach(async ({ page }) => {
		await new Shell(page).goto("/vms");
	});

	test("should open with Cmd+K and close with Escape", async ({ page }) => {
		await openCommandPalette(page);

		// Search input should be visible
		const input = commandPaletteInput(page);
		await expect(input).toBeVisible();

		// Close with Escape
		await page.keyboard.press("Escape");
		await expect(commandPalette(page)).not.toBeVisible({
			timeout: 3000,
		});
	});

	test("should show navigation commands", async ({ page }) => {
		await openCommandPalette(page);

		// Navigation commands should be visible
		await expect(
			commandPaletteItem(page, "Go to Dashboard"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Go to Uncategorised"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Go to Projects"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Go to Audit Logs"),
		).toBeVisible();
	});

	test("should show action commands", async ({ page }) => {
		await openCommandPalette(page);

		await expect(
			commandPaletteItem(page, "Upload Files"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Open Settings"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Invite User"),
		).toBeVisible();
		await expect(
			commandPaletteItem(page, "Profile"),
		).toBeVisible();
	});

	test("should navigate to Invite User (Settings > Users tab)", async ({
		page,
	}) => {
		await openCommandPalette(page);

		// Click "Invite User" action
		await commandPaletteItem(page, "Invite User").click();

		// Command palette should close
		await expect(commandPalette(page)).not.toBeVisible({
			timeout: 3000,
		});

		// Settings dialog should open with Users tab active
		const settingsDialog = dialog(page, "Settings");
		await expect(settingsDialog).toBeVisible({ timeout: 5000 });

		// Users tab should be the active tab (reka-ui sets data-state="active")
		await expect(activeTab(page, "Users")).toBeVisible();
	});

	test("should navigate to Profile (Settings > Profile tab)", async ({
		page,
	}) => {
		await openCommandPalette(page);

		// Click "Profile" action
		await commandPaletteItem(page, "Profile").click();

		// Command palette should close
		await expect(commandPalette(page)).not.toBeVisible({
			timeout: 3000,
		});

		// Settings dialog should open with Profile tab active
		const settingsDialog = dialog(page, "Settings");
		await expect(settingsDialog).toBeVisible({ timeout: 5000 });

		// Profile tab should be active (reka-ui sets data-state="active")
		await expect(activeTab(page, "Profile")).toBeVisible();
	});

	test("should navigate to Projects page via command", async ({ page }) => {
		await openCommandPalette(page);

		// Click "Go to Projects"
		await commandPaletteItem(page, "Go to Projects").click();

		// Should navigate to projects page
		await expect(page).toHaveURL(/\/vms\/projects/, { timeout: 10000 });
	});

	test("should navigate to Uncategorised page via command", async ({ page }) => {
		await openCommandPalette(page);

		await commandPaletteItem(page, "Go to Uncategorised").click();

		await expect(page).toHaveURL(/\/vms\/uncategorised/, { timeout: 10000 });
	});

	test("should navigate to Audit Logs page via command", async ({
		page,
	}) => {
		await openCommandPalette(page);

		await commandPaletteItem(page, "Go to Audit Logs").click();

		await expect(page).toHaveURL(/\/vms\/audit-logs/, { timeout: 10000 });
	});

	test("should filter commands when typing", async ({ page }) => {
		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill("invite");

		// "Invite User" should still be visible
		await expect(
			commandPaletteItem(page, "Invite User"),
		).toBeVisible();

		// Unrelated navigation items should be hidden by the palette filtering
		await expect(
			commandPaletteItem(page, "Go to Dashboard"),
		).not.toBeVisible({ timeout: 2000 });
	});
});

// ---------------------------------------------------------------------------
// Search API tests
// ---------------------------------------------------------------------------

test.describe("Command Palette – Search API", () => {
	const UNIQUE_TAG = `srch${Date.now()}`;
	let projectName: string;
	let project2Name: string;
	let assetName: string;

	test.beforeAll(async ({ request }) => {
		// Create a project and asset with unique names for search tests
		const project = await createTestProject(request, {
			project_name: `E2E Test Project ${UNIQUE_TAG} Alpha`,
		});
		projectName = project.name;

		const project2 = await createTestProject(request, {
			project_name: `E2E Test Project ${UNIQUE_TAG} Beta`,
		});
		project2Name = project2.name;

		const asset = await createTestAsset(request, {
			project: projectName,
			file_name: `${UNIQUE_TAG}-testvideo.mp4`,
			category: "Footage",
			status: "Ready",
		});
		assetName = asset.name;
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestProjects(request, `E2E Test Project ${UNIQUE_TAG}`);
	});

	test("search_assets should return matching results", async ({ request }) => {
		const data = await searchAssets(request, { query: UNIQUE_TAG });

		expect(data.results.length).toBeGreaterThanOrEqual(1);

		const match = data.results.find((r) => r.name === assetName);
		expect(match).toBeTruthy();
		expect(match!.file_name).toContain(UNIQUE_TAG);
		expect(match!.project).toBe(projectName);
		expect(match!.project_name).toBeTruthy();
	});

	test("search_assets should return empty for non-matching query", async ({
		request,
	}) => {
		const data = await searchAssets(request, {
			query: "zzz_nonexistent_xyzzy_999",
		});

		expect(data.results).toHaveLength(0);
	});

	test("search_assets should filter by project", async ({ request }) => {
		// Search within projectName — should find the asset
		const withinProject = await searchAssets(request, {
			query: UNIQUE_TAG,
			project: projectName,
		});
		expect(withinProject.results.length).toBeGreaterThanOrEqual(1);
		expect(withinProject.results.every((r) => r.project === projectName)).toBe(true);

		// Search within project2 — should find nothing (asset is in project1)
		const outsideProject = await searchAssets(request, {
			query: UNIQUE_TAG,
			project: project2Name,
		});
		expect(outsideProject.results).toHaveLength(0);
	});

	test("search_assets should respect limit parameter", async ({ request }) => {
		const data = await searchAssets(request, {
			query: UNIQUE_TAG,
			limit: 1,
		});

		expect(data.results.length).toBeLessThanOrEqual(1);
	});

	test("search_assets should return empty for blank query", async ({ request }) => {
		const data = await searchAssets(request, { query: "  " });

		expect(data.results).toHaveLength(0);
	});

	test("search_projects should return matching results", async ({
		request,
	}) => {
		const data = await searchProjects(request, { query: UNIQUE_TAG });

		expect(data.results.length).toBeGreaterThanOrEqual(2);

		const alphaMatch = data.results.find((r) => r.name === projectName);
		expect(alphaMatch).toBeTruthy();
		expect(alphaMatch!.project_name).toContain("Alpha");

		const betaMatch = data.results.find((r) => r.name === project2Name);
		expect(betaMatch).toBeTruthy();
		expect(betaMatch!.project_name).toContain("Beta");
	});

	test("search_projects should return empty for non-matching query", async ({
		request,
	}) => {
		const data = await searchProjects(request, {
			query: "zzz_nonexistent_xyzzy_999",
		});

		expect(data.results).toHaveLength(0);
	});

	test("search_projects should respect limit parameter", async ({
		request,
	}) => {
		const data = await searchProjects(request, {
			query: UNIQUE_TAG,
			limit: 1,
		});

		expect(data.results).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Search UI tests
// ---------------------------------------------------------------------------

test.describe("Command Palette – Search UI", () => {
	const UNIQUE_TAG = `srchui${Date.now()}`;
	let projectName: string;
	let assetName: string;

	test.beforeAll(async ({ request }) => {
		const project = await createTestProject(request, {
			project_name: `E2E Test Project ${UNIQUE_TAG}`,
		});
		projectName = project.name;

		const asset = await createTestAsset(request, {
			project: projectName,
			file_name: `${UNIQUE_TAG}-clip.mp4`,
			category: "Footage",
			status: "Ready",
		});
		assetName = asset.name;
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestProjects(request, `E2E Test Project ${UNIQUE_TAG}`);
	});

	test("should show asset search results when typing a query", async ({
		page,
	}) => {
		await new Shell(page).goto("/vms");

		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill(UNIQUE_TAG);

		// Wait for search results — asset file name should appear
		await expect(
			commandPaletteItem(page, `${UNIQUE_TAG}-clip.mp4`),
		).toBeVisible({ timeout: 10000 });
	});

	test("should show project search results when typing a query", async ({
		page,
	}) => {
		await new Shell(page).goto("/vms");

		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill(UNIQUE_TAG);

		// Project results section should appear — use data-value to target project items specifically
		const projectItem = commandPalette(page).locator(`[data-slot="command-palette-item"][data-value^="project-"]`, { hasText: UNIQUE_TAG });
		await expect(projectItem.first()).toBeVisible({ timeout: 10000 });
	});

	test("should navigate to review page when clicking an asset result", async ({
		page,
	}) => {
		await new Shell(page).goto("/vms");

		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill(UNIQUE_TAG);

		// Wait for asset result to appear and click it
		const assetItem = commandPaletteItem(page, `${UNIQUE_TAG}-clip.mp4`);
		await expect(assetItem).toBeVisible({ timeout: 10000 });
		await assetItem.click();

		// Should navigate to the review page for this asset
		await expect(page).toHaveURL(new RegExp(`/vms/review/${assetName}`), {
			timeout: 10000,
		});
	});

	test("should navigate to project page when clicking a project result", async ({
		page,
	}) => {
		await new Shell(page).goto("/vms");

		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill(UNIQUE_TAG);

		// Wait for project result (use data-value to target project items specifically)
		const projectItem = commandPalette(page).locator(`[data-slot="command-palette-item"][data-value="project-${projectName}"]`);
		await expect(projectItem).toBeVisible({ timeout: 10000 });
		await projectItem.click();

		// Should navigate to the project detail page
		await expect(page).toHaveURL(new RegExp(`/vms/projects/${projectName}`), {
			timeout: 10000,
		});
	});

	test("should show no results for a nonsense query", async ({ page }) => {
		await new Shell(page).goto("/vms");

		await openCommandPalette(page);

		const input = commandPaletteInput(page);
		await input.fill("zzz_nonexistent_xyzzy_999");

		// Wait for search to complete — the palette shows "No results found." when empty
		await expect(commandPaletteEmpty(page)).toHaveText(/No results found/, {
			timeout: 10000,
		});
	});
});
