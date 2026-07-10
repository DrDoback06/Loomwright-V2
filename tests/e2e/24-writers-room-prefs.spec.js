// Workflow T24: Area 7 — the Writer's Room applies the persisted workspace
// layout prefs (editor page width + font).
//
// Onboarding + the Editor → Page settings persist workspace.editorWidth and
// workspace.font. The Writer's Room now reads them and applies them live as
// the --wr-editor-width / --wr-editor-font CSS vars on the .wr root, so the
// manuscript column resizes / restyles. It also refreshes when the prefs
// change (reopening onboarding, changing settings) without a reload.
//
// Note: the canvas width is min(--wr-editor-width, 100%), so with the side
// margins visible the centre column can clamp it. The visible-width checks
// therefore run in focus mode (margins hidden → wide column); the var + font
// checks run in the normal layout.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function gotoWritersRoom(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
  await expect(page.locator("[data-ui='ManuscriptCanvas']").first()).toBeVisible({ timeout: 10000 });
}

async function setWorkspace(page, patch) {
  await page.evaluate(async (p) => {
    const svc = window.LoomwrightBackend.SettingsService;
    const cur = svc.getSectionSync("workspace", {}) || {};
    await svc.saveSection("workspace", { ...cur, ...p });
  }, patch);
  await page.waitForTimeout(300);
}

async function enterFocusMode(page) {
  await page.locator("button[aria-label='Focus mode']").first().dispatchEvent("click");
  await expect(page.locator("[data-testid='wr-exit-focus']")).toBeVisible({ timeout: 5000 });
}

const canvasWidth = (page) =>
  page.locator(".wr-canvas").first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
const columnWidth = (page) =>
  page.locator(".wr-canvas-wrap").first().evaluate((el) => Math.floor(el.getBoundingClientRect().width));

test.describe("T24. Writer's Room — workspace layout prefs", () => {
  test("editorWidth + font prefs apply as CSS vars and restyle the canvas", async ({ page }) => {
    await openFreshApp(page);
    await setWorkspace(page, { editorWidth: 960, font: "EB Garamond" });
    await gotoWritersRoom(page);
    const wr = page.locator(".wr[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible();
    // The root carries the CSS vars derived from the prefs (the mechanism).
    expect(await wr.evaluate((el) => el.style.getPropertyValue("--wr-editor-width").trim())).toBe("960px");
    expect(await wr.evaluate((el) => el.style.getPropertyValue("--wr-editor-font").trim())).toContain("EB Garamond");
    // The chosen font is applied to the manuscript canvas + editable body.
    expect(await page.locator(".wr-canvas").first().evaluate((el) => getComputedStyle(el).fontFamily)).toContain("EB Garamond");
  });

  test("editorWidth sizes the manuscript column in focus mode", async ({ page }) => {
    await openFreshApp(page);
    await gotoWritersRoom(page);
    await enterFocusMode(page);
    // Margins hidden → wide column. Pick a target below it so min(target,100%) = target.
    const avail = await columnWidth(page);
    const target = Math.max(560, Math.min(820, avail - 60));
    await setWorkspace(page, { editorWidth: target });
    await expect.poll(() => canvasWidth(page), { timeout: 5000 }).toBe(target);
  });

  test("default project uses the built-in width (no pref var set)", async ({ page }) => {
    await openFreshApp(page);
    await gotoWritersRoom(page);
    const wr = page.locator(".wr[data-ui='WritersRoomScreen']");
    expect(await wr.evaluate((el) => el.style.getPropertyValue("--wr-editor-width").trim())).toBe(""); // → CSS falls back to 720px
    await enterFocusMode(page);
    const avail = await columnWidth(page);
    expect(await canvasWidth(page)).toBe(Math.min(720, avail));
  });

  test("changing the pref updates the Writer's Room live (no reload)", async ({ page }) => {
    await openFreshApp(page);
    await gotoWritersRoom(page);
    await enterFocusMode(page);
    const avail = await columnWidth(page);
    const t1 = Math.max(520, Math.min(600, avail - 80));
    const t2 = Math.max(560, Math.min(840, avail - 60));
    await setWorkspace(page, { editorWidth: t1 });
    await expect.poll(() => canvasWidth(page), { timeout: 5000 }).toBe(t1);
    // Change the pref while the room is open — it re-applies on the settings event.
    await setWorkspace(page, { editorWidth: t2 });
    await expect.poll(() => canvasWidth(page), { timeout: 5000 }).toBe(t2);
  });
});
