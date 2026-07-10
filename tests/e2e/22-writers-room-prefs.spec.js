// Workflow T22: the Writer's Room honours the persisted onboarding
// `workspace` layout prefs (editor width + font). Onboarding captured these
// but the Writer's Room previously ignored all but startTab/mobileCompact.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function gotoRoute(page, routeId) {
  await page.evaluate((r) => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: r } })), routeId);
  await page.waitForTimeout(250);
}

test.describe("T22. Writer's Room — persisted layout prefs", () => {
  test("editor width + font from the workspace section apply as CSS vars", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SettingsService.saveSection("workspace", {
        startTab: "writers-room", editorWidth: 900, font: "EB Garamond", margins: true,
      });
    });
    await gotoRoute(page, "writers-room");
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 5000 });
    // The container carries the derived CSS vars.
    const vars = await wr.evaluate((el) => ({
      w: el.style.getPropertyValue("--wr-editor-w"),
      f: el.style.getPropertyValue("--wr-editor-font"),
    }));
    expect(vars.w).toBe("900px");
    expect(vars.f).toContain("EB Garamond");
    // And the manuscript canvas actually resolves the width var (<= 900px).
    const canvas = page.locator(".wr-canvas").first();
    if (await canvas.count()) {
      const width = await canvas.evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeLessThanOrEqual(900 + 1);
    }
  });

  test("no workspace pref → the default width var is absent (falls back to 720px)", async ({ page }) => {
    await openFreshApp(page);
    await gotoRoute(page, "writers-room");
    const wr = page.locator("[data-ui='WritersRoomScreen']");
    await expect(wr).toBeVisible({ timeout: 5000 });
    const w = await wr.evaluate((el) => el.style.getPropertyValue("--wr-editor-w"));
    expect(w).toBe("");
  });
});
