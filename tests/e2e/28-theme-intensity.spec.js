// Workflow T28: Area 8 — workspace.themeIntensity modulates the accent.
//
// The persisted themeIntensity pref (0..100) mutes the accent toward neutral
// grey (100 = full accent, lower = more muted). When unset it is a strict
// no-op so the default palette identity is preserved.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

const accentOf = (page) => page.evaluate(() =>
  document.documentElement.style.getPropertyValue("--accent").trim());
const intensityAttr = (page) => page.evaluate(() =>
  document.documentElement.getAttribute("data-accent-intensity"));

async function setIntensity(page, v) {
  await page.evaluate((val) => window.LoomwrightBackend.SettingsService.saveSection("workspace", { themeIntensity: val }), v);
  await page.waitForTimeout(300);
}

test.describe("T28. Theme intensity", () => {
  test("unset intensity leaves the accent untouched (no data attr)", async ({ page }) => {
    await openFreshApp(page);
    // No themeIntensity saved — the attribute is absent and an accent is set.
    expect(await intensityAttr(page)).toBeNull();
    expect(await accentOf(page)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("lowering intensity mutes the accent; full intensity restores it", async ({ page }) => {
    await openFreshApp(page);

    await setIntensity(page, 100);
    const full = await accentOf(page);
    expect(await intensityAttr(page)).toBe("100");

    await setIntensity(page, 0);
    const muted = await accentOf(page);
    expect(await intensityAttr(page)).toBe("0");

    // Muted accent differs from the full-intensity accent (blended toward grey).
    expect(muted).not.toBe(full);

    // Returning to 100 restores the full-intensity accent.
    await setIntensity(page, 100);
    expect(await accentOf(page)).toBe(full);
  });
});
