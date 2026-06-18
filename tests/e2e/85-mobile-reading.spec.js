// Workflow T85: purpose-built mobile Reading surface (Speed Reader). On the
// phone the compact side-panel companion becomes a real RSVP reading view —
// a large centred pivot word and thumb-sized transport controls.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T85. Mobile reading surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("speed reader renders a large RSVP word and thumb-sized transport", async ({ page }) => {
    await openFreshApp(page);
    // Seed a chapter so the reader has a real source (else it shows empty state).
    await page.evaluate(async () => {
      const MCS = window.LoomwrightBackend.ManuscriptChapterService;
      await MCS.save({
        chapters: [{ id: "c1", num: 1, title: "Chapter 1" }],
        activeChapterId: "c1",
        manuscripts: { c1: { text: "The salt wind carried the smell of old iron across the Pale Reach for many cold miles. ".repeat(12) } },
        trashedChapters: [],
      });
    });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "speedReader" } })));
    const body = page.locator("[data-ui='SpeedReaderPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });

    // Big RSVP word.
    const word = page.locator(".sr-panel__word").first();
    await expect(word).toBeVisible();
    const fs = await word.evaluate((el) => parseInt(getComputedStyle(el).fontSize, 10));
    expect(fs).toBeGreaterThanOrEqual(48);

    // Thumb-sized play control.
    const playSize = await page.locator(".sr-panel__t-btn--play").evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(playSize).toBeGreaterThanOrEqual(52);
  });
});
