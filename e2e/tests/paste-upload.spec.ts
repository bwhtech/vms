import { test, expect, Page } from "@playwright/test";
import { createTestProject, cleanupTestProjects } from "../helpers";
import { dialog } from "../helpers/ui";
import { Shell } from "../pages";

// A 1x1 PNG — the smallest thing the clipboard can hand us that the backend's
// allowed_extensions accepts.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Fire the same `paste` event Chrome fires for Mod+V / Mod+Shift+V, with a
 * file on the clipboard. `selector` targets the element the paste lands on;
 * without it the event goes to the document, as it does when nothing is focused.
 */
async function pasteFile(
  page: Page,
  options: {
    fileName: string;
    base64: string;
    type: string;
    selector?: string;
  },
) {
  await page.evaluate(({ fileName, base64, type, selector }) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], fileName, { type }));
    const target = selector ? document.querySelector(selector) : document;
    target?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, options);
}

test.describe("Paste to upload", () => {
  let projectName: string;

  test.beforeAll(async ({ request }) => {
    const project = await createTestProject(request, {
      project_name: `E2E Paste Project ${Date.now()}`,
    });
    projectName = project.name;
  });

  test.afterAll(async ({ request }) => {
    await cleanupTestProjects(request, "E2E Paste Project");
  });

  test("opens the upload dialog with the pasted file queued", async ({
    page,
  }) => {
    const shell = new Shell(page);
    await shell.goto(`/vms/projects/${projectName}`);

    const fileName = `pasted-${Date.now()}.png`;
    await pasteFile(page, {
      fileName,
      base64: PNG_BASE64,
      type: "image/png",
    });

    const uploadDialog = dialog(page, "Upload Assets");
    await expect(uploadDialog).toBeVisible({ timeout: 5000 });
    await expect(uploadDialog.getByText(fileName)).toBeVisible();

    // The paste queues straight into the upload, no extra click.
    await expect(uploadDialog.getByText("1 uploaded")).toBeVisible({
      timeout: 30000,
    });
  });

  test("leaves a paste inside a text field alone", async ({ page }) => {
    const shell = new Shell(page);
    await shell.goto(`/vms/projects/${projectName}`);

    const search = page.getByPlaceholder("Search");
    await expect(search.first()).toBeVisible({ timeout: 10000 });
    await search.first().click();

    await pasteFile(page, {
      fileName: "ignored.png",
      base64: PNG_BASE64,
      type: "image/png",
      selector: "input[placeholder='Search']",
    });

    await expect(dialog(page, "Upload Assets")).not.toBeVisible();
  });
});
