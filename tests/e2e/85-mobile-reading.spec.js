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

  test("swiping the reading stage seeks forward and back", async ({ page }) => {
    await openFreshApp(page);
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
    await expect(page.locator("[data-ui='SpeedReaderPanelBody']")).toBeVisible({ timeout: 5000 });

    const word = page.locator("[data-testid='sr-word']");
    // Short horizontal swipe (~80px, under the 130px sentence threshold) seeks
    // a single word: negative dx = left = forward, positive = right = back.
    const swipe = (dxPx) => page.evaluate((dx) => {
      const stage = document.querySelector(".sr-panel__stage");
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2, y = r.top + r.height / 2;
      const mk = (type, x, end) => {
        const touch = new Touch({ identifier: 1, target: stage, clientX: x, clientY: y });
        stage.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: end ? [] : [touch], changedTouches: [touch] }));
      };
      mk("touchstart", cx - dx / 2, false);
      mk("touchend", cx + dx / 2, true);
    }, dxPx);

    const w0 = (await word.textContent()).trim();
    await swipe(-80);                  // swipe left → forward one word
    await page.waitForTimeout(120);
    const w1 = (await word.textContent()).trim();
    expect(w1).not.toBe(w0);

    await swipe(80);                   // swipe right → back to the start word
    await page.waitForTimeout(120);
    const w2 = (await word.textContent()).trim();
    expect(w2).toBe(w0);
  });
});
