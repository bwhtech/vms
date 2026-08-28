import { test, expect } from "@playwright/test";
import {
	createTestProject,
	createTestAsset,
	createTestFolder,
	softDeleteAsset,
	restoreAsset,
	permanentlyDeleteAsset,
	softDeleteFolder,
	restoreFolder,
	permanentlyDeleteFolder,
	getTrashAssets,
	getTrashFolders,
	emptyTrash,
	cleanupTestProjects,
	cleanupTestFolders,
	VMSProject,
	VMSAsset,
	VMSFolder,
} from "../helpers/vms";
import { docExists, getList } from "../helpers/frappe";
import {
	activeTab,
	dialog,
	dialogButton,
	dropdownItem,
	listGroup,
	listRow,
	listRowCheckbox,
	selectTrigger,
	testId,
} from "../helpers/ui";
import { Shell } from "../pages";

test.describe("Deletion — API", () => {
	let project: VMSProject;

	test.beforeAll(async ({ request }) => {
		project = await createTestProject(request, {
			project_name: `E2E Deletion ${Date.now()}`,
		});
	});

	test.afterAll(async ({ request }) => {
		// Clean up everything
		try {
			await emptyTrash(request);
		} catch { /* ignore */ }
		await cleanupTestFolders(request, project.name);
		await cleanupTestProjects(request, "E2E Deletion");
	});

	// ── Asset soft delete ────────────────────────────────────────────────

	test("soft-delete asset moves it to trash", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-soft-${Date.now()}.mp4`,
		});

		await softDeleteAsset(request, asset.name);

		const trash = await getTrashAssets(request);
		const found = trash.assets.find((a) => a.name === asset.name);
		expect(found).toBeTruthy();

		// cleanup
		await permanentlyDeleteAsset(request, asset.name);
	});

	test("soft-deleted asset excluded from project listing", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-excluded-${Date.now()}.mp4`,
		});

		await softDeleteAsset(request, asset.name);

		// Query non-trashed assets in the project
		const assets = await getList<VMSAsset>(request, "VMS Asset", {
			fields: ["name"],
			filters: { project: project.name, deleted_at: ["is", "not set"] },
		});
		const found = assets.find((a) => a.name === asset.name);
		expect(found).toBeFalsy();

		// cleanup
		await permanentlyDeleteAsset(request, asset.name);
	});

	// ── Asset restore ────────────────────────────────────────────────────

	test("restore asset brings it back from trash", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-restore-${Date.now()}.mp4`,
		});

		await softDeleteAsset(request, asset.name);
		await restoreAsset(request, asset.name);

		// Should no longer be in trash
		const trash = await getTrashAssets(request);
		const found = trash.assets.find((a) => a.name === asset.name);
		expect(found).toBeFalsy();

		// Should be back in project listings
		const assets = await getList<VMSAsset>(request, "VMS Asset", {
			fields: ["name"],
			filters: { project: project.name, deleted_at: ["is", "not set"] },
		});
		expect(assets.find((a) => a.name === asset.name)).toBeTruthy();

		// cleanup
		await softDeleteAsset(request, asset.name);
		await permanentlyDeleteAsset(request, asset.name);
	});

	// ── Asset permanent delete ───────────────────────────────────────────

	test("permanently delete removes asset from database", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-perm-${Date.now()}.mp4`,
		});

		await softDeleteAsset(request, asset.name);
		await permanentlyDeleteAsset(request, asset.name);

		const exists = await docExists(request, "VMS Asset", asset.name);
		expect(exists).toBe(false);
	});

	test("permanent delete fails on non-trashed asset", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-guard-${Date.now()}.mp4`,
		});

		// Should fail because asset is not trashed
		await expect(
			permanentlyDeleteAsset(request, asset.name),
		).rejects.toThrow();

		// cleanup
		await softDeleteAsset(request, asset.name);
		await permanentlyDeleteAsset(request, asset.name);
	});

	// ── Folder soft delete ───────────────────────────────────────────────

	test("soft-delete folder moves it to trash", async ({ request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`Del Folder ${Date.now()}`,
		);

		await softDeleteFolder(request, folder.name);

		const trash = await getTrashFolders(request);
		const found = trash.folders.find((f) => f.name === folder.name);
		expect(found).toBeTruthy();

		// cleanup
		await permanentlyDeleteFolder(request, folder.name);
	});

	test("soft-deleted folder excluded from active listing", async ({ request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`Excl Folder ${Date.now()}`,
		);

		await softDeleteFolder(request, folder.name);

		const activeFolders = await getList<VMSFolder>(request, "VMS Folder", {
			fields: ["name"],
			filters: { project: project.name, deleted_at: ["is", "not set"] },
		});
		const found = activeFolders.find((f) => f.name === folder.name);
		expect(found).toBeFalsy();

		// cleanup
		await permanentlyDeleteFolder(request, folder.name);
	});

	// ── Folder restore ───────────────────────────────────────────────────

	test("restore folder brings it back", async ({ request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`Restore Folder ${Date.now()}`,
		);

		await softDeleteFolder(request, folder.name);
		await restoreFolder(request, folder.name);

		const activeFolders = await getList<VMSFolder>(request, "VMS Folder", {
			fields: ["name"],
			filters: { project: project.name, deleted_at: ["is", "not set"] },
		});
		expect(activeFolders.find((f) => f.name === folder.name)).toBeTruthy();

		// cleanup
		await softDeleteFolder(request, folder.name);
		await permanentlyDeleteFolder(request, folder.name);
	});

	// ── Empty trash ──────────────────────────────────────────────────────

	test("empty trash removes all trashed assets and folders", async ({ request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `del-empty-${Date.now()}.mp4`,
		});
		const folder = await createTestFolder(
			request,
			project.name,
			`Empty Folder ${Date.now()}`,
		);

		await softDeleteAsset(request, asset.name);
		await softDeleteFolder(request, folder.name);

		const result = await emptyTrash(request);
		expect(result.count).toBeGreaterThanOrEqual(2);

		const exists1 = await docExists(request, "VMS Asset", asset.name);
		const exists2 = await docExists(request, "VMS Folder", folder.name);
		expect(exists1).toBe(false);
		expect(exists2).toBe(false);
	});
});

test.describe("Deletion — UI", () => {
	let project: VMSProject;

	test.beforeAll(async ({ request }) => {
		project = await createTestProject(request, {
			project_name: `E2E Deletion UI ${Date.now()}`,
		});
	});

	test.afterAll(async ({ request }) => {
		try {
			await emptyTrash(request);
		} catch { /* ignore */ }
		await cleanupTestFolders(request, project.name);
		await cleanupTestProjects(request, "E2E Deletion UI");
	});

	// The trash page is one `List` grouped by kind (`ListGroup` "Folders" /
	// "Assets"); a group only renders when it has rows.
	test("trash page loads with Assets and Folders sections", async ({ page, request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-groups-${Date.now()}.mp4`,
		});
		const folder = await createTestFolder(
			request,
			project.name,
			`UI Groups Folder ${Date.now()}`,
		);
		await softDeleteAsset(request, asset.name);
		await softDeleteFolder(request, folder.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Both sections should be visible
		await expect(listGroup(page, "Assets")).toBeVisible({ timeout: 10000 });
		await expect(listGroup(page, "Folders")).toBeVisible();

		// cleanup
		await permanentlyDeleteAsset(request, asset.name);
		await permanentlyDeleteFolder(request, folder.name);
	});

	test("soft-deleted asset appears in trash page", async ({ page, request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-trash-${Date.now()}.mp4`,
		});
		await softDeleteAsset(request, asset.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// The Assets group should show the file
		await expect(listRow(page, asset.file_name)).toBeVisible({ timeout: 10000 });

		// cleanup
		await permanentlyDeleteAsset(request, asset.name);
	});

	test("restore asset from trash page via button", async ({ page, request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-restore-${Date.now()}.mp4`,
		});
		await softDeleteAsset(request, asset.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Find the row with this asset and click its restore button
		const row = listRow(page, asset.file_name);
		await expect(row).toBeVisible({ timeout: 10000 });
		await row.getByRole("button", { name: "Restore" }).click();

		// Wait for it to disappear from the list
		await expect(row).not.toBeVisible({ timeout: 10000 });

		// Verify it's back (no longer in trash)
		const trash = await getTrashAssets(request);
		expect(trash.assets.find((a) => a.name === asset.name)).toBeFalsy();

		// cleanup
		await softDeleteAsset(request, asset.name);
		await permanentlyDeleteAsset(request, asset.name);
	});

	test("bulk restore selected assets from trash", async ({ page, request }) => {
		const a1 = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-bulk-1-${Date.now()}.mp4`,
		});
		const a2 = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-bulk-2-${Date.now()}.mp4`,
		});
		await softDeleteAsset(request, a1.name);
		await softDeleteAsset(request, a2.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Wait for rows to appear, then select both via their row checkboxes
		const row1 = listRow(page, a1.file_name);
		const row2 = listRow(page, a2.file_name);
		await expect(row1).toBeVisible({ timeout: 10000 });
		await expect(row2).toBeVisible({ timeout: 10000 });
		await listRowCheckbox(page, a1.file_name).click();
		await listRowCheckbox(page, a2.file_name).click();

		// Click bulk "Restore (2)" button in the page header
		const bulkRestore = testId(page, "trash-restore-selected");
		await expect(bulkRestore).toHaveText(/Restore \(2\)/i);
		await bulkRestore.click();

		// Wait for both to disappear
		await expect(row1).not.toBeVisible({ timeout: 10000 });
		await expect(row2).not.toBeVisible({ timeout: 10000 });

		// cleanup
		await softDeleteAsset(request, a1.name);
		await permanentlyDeleteAsset(request, a1.name);
		await softDeleteAsset(request, a2.name);
		await permanentlyDeleteAsset(request, a2.name);
	});

	test("bulk permanent delete selected assets", async ({ page, request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-permdel-${Date.now()}.mp4`,
		});
		await softDeleteAsset(request, asset.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Wait for row, then select the asset
		const row = listRow(page, asset.file_name);
		await expect(row).toBeVisible({ timeout: 10000 });
		await listRowCheckbox(page, asset.file_name).click();

		// Click "Delete forever (1)" in the page header
		const deleteBtn = testId(page, "trash-delete-selected");
		await expect(deleteBtn).toBeVisible();
		await deleteBtn.click();

		// Confirm in the `dialog.danger` prompt
		const confirm = dialog(page, /Delete .* forever\?/);
		await expect(confirm).toBeVisible();
		await dialogButton(page, "Delete forever", /Delete .* forever\?/).click();

		// Wait for row to vanish
		await expect(row).not.toBeVisible({ timeout: 10000 });

		// Verify it's permanently gone
		const exists = await docExists(request, "VMS Asset", asset.name);
		expect(exists).toBe(false);
	});

	test("folders section shows trashed folders", async ({ page, request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`UI Trash Folder ${Date.now()}`,
		);
		await softDeleteFolder(request, folder.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Should see the folder in the Folders group
		await expect(
			listGroup(page, "Folders").locator('[data-slot="list-row"]', {
				hasText: folder.folder_name,
			}),
		).toBeVisible({ timeout: 10000 });

		// cleanup
		await permanentlyDeleteFolder(request, folder.name);
	});

	test("restore folder from folders section", async ({ page, request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`UI Restore Folder ${Date.now()}`,
		);
		await softDeleteFolder(request, folder.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		const row = listRow(page, folder.folder_name);
		await expect(row).toBeVisible({ timeout: 10000 });
		await row.getByRole("button", { name: "Restore" }).click();

		await expect(row).not.toBeVisible({ timeout: 10000 });

		// Verify restored
		const trash = await getTrashFolders(request);
		expect(trash.folders.find((f) => f.name === folder.name)).toBeFalsy();

		// cleanup
		await softDeleteFolder(request, folder.name);
		await permanentlyDeleteFolder(request, folder.name);
	});

	test("empty trash dialog works", async ({ page, request }) => {
		const asset = await createTestAsset(request, {
			project: project.name,
			file_name: `ui-empty-${Date.now()}.mp4`,
		});
		await softDeleteAsset(request, asset.name);

		await page.goto("/vms/trash");
		await page.waitForLoadState("networkidle");

		// Click "Empty trash"
		const emptyBtn = testId(page, "trash-empty");
		await expect(emptyBtn).toBeVisible({ timeout: 10000 });
		await emptyBtn.click();

		// Confirmation dialog (`dialog.danger`) should appear
		const confirm = dialog(page, "Empty trash?");
		await expect(confirm).toBeVisible();
		await expect(confirm.getByText(/deleted forever|permanently delete/i)).toBeVisible();

		// Confirm
		await dialogButton(page, "Empty trash", "Empty trash?").click();

		// Wait for trash to be empty
		await page.waitForLoadState("networkidle");
		await expect(page.getByText(/Trash is empty|No deleted assets/i)).toBeVisible({
			timeout: 10000,
		});
	});

	// Folder delete lives in the "Folder actions" dropdown of the open folder
	// (compact folder rows on the project root carry no menu).
	test("delete folder dialog uses soft-delete language", async ({ page, request }) => {
		const folder = await createTestFolder(
			request,
			project.name,
			`UI SoftDel Folder ${Date.now()}`,
		);

		// Navigate into the folder
		await page.goto(`/vms/projects/${project.name}/folder/${folder.name}`);
		await page.waitForLoadState("networkidle");

		await page.getByRole("button", { name: "Folder actions" }).click();
		await dropdownItem(page, "Delete").click();

		// The dialog should show soft-delete language
		const confirm = dialog(page, /Move folder to Trash/i);
		await expect(confirm).toBeVisible();
		await expect(confirm.getByText(/move to Trash/i).first()).toBeVisible();

		// Cancel so we can clean up
		await dialogButton(page, /Cancel/i, /Move folder to Trash/i).click();

		// cleanup
		await softDeleteFolder(request, folder.name);
		await permanentlyDeleteFolder(request, folder.name);
	});

	test("settings dialog shows retention select dropdowns", async ({ page }) => {
		const shell = new Shell(page);
		await shell.goto("/vms");

		// Open settings from the sidebar workspace menu; it opens on Profile
		const settings = await shell.openSettings();
		await settings.getByRole("tab", { name: "General" }).click();
		await expect(activeTab(page, "General")).toBeVisible();

		// Look for the Housekeeping section with its retention select
		await expect(
			settings.getByText(/Permanently delete trashed assets after|Auto-delete after/).first(),
		).toBeVisible({ timeout: 10000 });

		// The retention `Select` renders a combobox trigger
		const trashSelect = selectTrigger(settings).first();
		await expect(trashSelect).toBeVisible();
	});
});
