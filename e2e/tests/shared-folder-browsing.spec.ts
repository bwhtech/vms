import { test, expect } from "@playwright/test";
import {
	createTestProject,
	cleanupTestProjects,
	createTestFolder,
	uploadTestFile,
	enableFolderSharing,
	enableProjectSharing,
	softDeleteFolder,
} from "../helpers/vms";
import { guestGet } from "../helpers/frappe";

test.describe("Recursive Shared Folder Browsing", () => {
	let projectName: string;
	let rootFolder: string;
	let subA: string;
	let subB: string;
	let rootAssetName: string;
	let aAssetName: string;
	let bAssetName: string;

	test.beforeAll(async ({ request }) => {
		const project = await createTestProject(request, {
			project_name: `E2E Recursive Sharing ${Date.now()}`,
		});
		projectName = project.name;

		const root = await createTestFolder(request, projectName, "Root");
		rootFolder = root.name;
		const a = await createTestFolder(request, projectName, "Sub A", rootFolder);
		subA = a.name;
		const b = await createTestFolder(request, projectName, "Sub B", rootFolder);
		subB = b.name;

		const rootUpload = await uploadTestFile(request, {
			file_name: "root.jpg",
			content: Buffer.from("root content"),
			content_type: "image/jpeg",
			project: projectName,
			folder: rootFolder,
		});
		rootAssetName = rootUpload.asset_name;

		const aUpload = await uploadTestFile(request, {
			file_name: "a.jpg",
			content: Buffer.from("a content"),
			content_type: "image/jpeg",
			project: projectName,
			folder: subA,
		});
		aAssetName = aUpload.asset_name;

		const bUpload = await uploadTestFile(request, {
			file_name: "b.jpg",
			content: Buffer.from("b content"),
			content_type: "image/jpeg",
			project: projectName,
			folder: subB,
		});
		bAssetName = bUpload.asset_name;
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestProjects(request, "E2E Recursive Sharing");
	});

	test("folder share root lists subfolder tiles, not the nested files", async ({
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, rootFolder);

		const info = await guestGet<{
			subfolders: Array<{ name: string; folder_name: string }>;
		}>(request, "vms.api.get_shared_folder", {
			folder: rootFolder,
			token: share_token,
		});
		expect(info.status).toBe(200);
		const names = info.data!.subfolders.map((f) => f.folder_name).sort();
		expect(names).toEqual(["Sub A", "Sub B"]);

		const assets = await guestGet<{ assets: Array<{ name: string }> }>(
			request,
			"vms.api.get_shared_folder_assets",
			{ folder: rootFolder, token: share_token },
		);
		expect(assets.data!.assets.map((a) => a.name)).toEqual([rootAssetName]);
	});

	test("browsing into a subfolder scopes assets to it", async ({
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, rootFolder);

		const assets = await guestGet<{ assets: Array<{ name: string }> }>(
			request,
			"vms.api.get_shared_folder_assets",
			{ folder: rootFolder, token: share_token, current: subA },
		);
		expect(assets.data!.assets.map((a) => a.name)).toEqual([aAssetName]);
	});

	test("a sibling folder outside the share is rejected", async ({
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, subA);

		const { status } = await guestGet(request, "vms.api.get_shared_folder", {
			folder: subA,
			token: share_token,
			current: subB,
		});
		expect(status).toBeGreaterThanOrEqual(400);
	});

	test("a file two levels deep is reachable via its own view URL", async ({
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, rootFolder);

		const { status, data } = await guestGet<{ url: string }>(
			request,
			"vms.api.get_shared_asset_download_url",
			{ asset_name: aAssetName, folder: rootFolder, token: share_token },
		);
		expect(status).toBe(200);
		expect(data!.url).toContain("X-Amz-Signature");
	});

	test("recursive download listing includes the whole subtree", async ({
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, rootFolder);

		const { data } = await guestGet<{ assets: Array<{ name: string }> }>(
			request,
			"vms.api.get_shared_folder_assets",
			{ folder: rootFolder, token: share_token, recursive: 1, page_size: 100 },
		);
		const names = data!.assets.map((a) => a.name).sort();
		expect(names).toEqual([aAssetName, bAssetName, rootAssetName].sort());
	});

	test("trashing a subfolder removes its tile and 403s its deep link", async ({
		request,
	}) => {
		const trashTarget = await createTestFolder(
			request,
			projectName,
			"Trash Target",
			rootFolder,
		);

		const { share_token } = await enableFolderSharing(request, rootFolder);
		await softDeleteFolder(request, trashTarget.name);

		const info = await guestGet<{
			subfolders: Array<{ name: string }>;
		}>(request, "vms.api.get_shared_folder", {
			folder: rootFolder,
			token: share_token,
		});
		expect(info.data!.subfolders.map((f) => f.name)).not.toContain(trashTarget.name);

		const { status } = await guestGet(request, "vms.api.get_shared_folder", {
			folder: rootFolder,
			token: share_token,
			current: trashTarget.name,
		});
		expect(status).toBeGreaterThanOrEqual(400);
	});

	test("project share root shows top-level folders, not a flat merge", async ({
		request,
	}) => {
		const { share_token } = await enableProjectSharing(request, projectName);

		const info = await guestGet<{
			subfolders: Array<{ folder_name: string }>;
		}>(request, "vms.api.get_shared_project", {
			project: projectName,
			token: share_token,
		});
		expect(info.data!.subfolders.map((f) => f.folder_name)).toContain("Root");
	});

	test("guest can browse from folder tiles into a subfolder and back via breadcrumb", async ({
		page,
		request,
	}) => {
		const { share_token } = await enableFolderSharing(request, rootFolder);

		await page.goto(`/vms/shared/folder/${rootFolder}?token=${share_token}`);
		await page.waitForLoadState("networkidle");

		const tiles = page.locator('[data-testid="shared-folder-tile"]');
		await expect(tiles).toHaveCount(2);
		await expect(page.locator("text=root.jpg")).toBeVisible();

		await page.locator('[data-testid="shared-folder-tile"]', { hasText: "Sub A" }).click();
		await page.waitForLoadState("networkidle");
		await expect(page.locator("text=a.jpg")).toBeVisible({ timeout: 10000 });
		await expect(page.locator("text=b.jpg")).not.toBeVisible();
		expect(page.url()).toContain(`path=${subA}`);

		await page.goto(page.url());
		await page.waitForLoadState("networkidle");
		await expect(page.locator("text=a.jpg")).toBeVisible({ timeout: 10000 });
	});
});
