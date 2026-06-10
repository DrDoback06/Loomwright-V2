// Workflow U26: Area 4 phase 6 — AI Writer live + Home stats truthful.
//
// The AI Writer panel reads live context (active chapter, dropped
// entities, style refs, cast POVs) and routes Generate through the
// provider-gated registry branch (configure-AI notice without a key).
// Home's manuscript card derives Active chapter / words-today / pace
// from the live stores.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openPanelKind(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(300);
}

test.describe("U26. AI Writer + Home — live", () => {
  test("AI Writer renders live context and gates Generate behind a provider", async ({ page }) => {
    await openFreshApp(page);
    // Capture backend notices.
    await page.evaluate(() => {
      window.__notices = [];
      window.addEventListener("lw:backend-notice", (e) => window.__notices.push(e.detail?.message || ""));
    });
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.EntityService.save("cast", { name: "Anwen Hale", data: { role: "protagonist" } }, { status: "active" });
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u26-c1", num: 1, title: "The Gate" }],
        activeChapterId: "u26-c1",
        manuscripts: { "u26-c1": { html: "", text: "Anwen walked the toll road in the rain." } },
      });
    });
    await openPanelKind(page, "aiWriter");
    const aiw = page.locator("[data-ui='AiWriterPanelBody']");
    await expect(aiw).toBeVisible();
    // No demo chips; the drop zone invites real entities.
    await expect(aiw.locator(".aiw__drop-empty")).toBeVisible();
    await expect(aiw).not.toContainText("Aelinor Vey");
    // Live context line shows the real chapter + its tail.
    await expect(aiw).toContainText("Ch. 1");
    await expect(aiw).toContainText("toll road in the rain");
    // POV select offers the live cast.
    await expect(aiw.locator("select").nth(1)).toContainText("Anwen Hale — close third");
    // Preview starts empty (no canned sample prose).
    await expect(aiw.locator("[data-ui='AiwPreviewEmpty']")).toBeVisible();
    // Generate without a provider → specific configure notice, no sample text.
    await aiw.locator("[data-testid='aiw-generate']").click();
    await page.waitForTimeout(500);
    const notices = await page.evaluate(() => window.__notices);
    expect(notices.some((n) => /provider/i.test(n))).toBe(true);
    await expect(aiw.locator("[data-ui='AiwPreviewEmpty']")).toBeVisible();
  });

  test("entities drag-drop into the writer's context as chips", async ({ page }) => {
    await openFreshApp(page);
    const anwen = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const e = await B.EntityService.save("cast", { name: "Anwen Hale" }, { status: "active" });
      return { id: e.id };
    });
    await openPanelKind(page, "aiWriter");
    const aiw = page.locator("[data-ui='AiWriterPanelBody']");
    await page.evaluate(({ id }) => {
      const zone = document.querySelector(".aiw__drop");
      const dt = new DataTransfer();
      dt.setData("application/x-loom-entity", JSON.stringify({ id, entityType: "cast", name: "Anwen Hale" }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
    }, anwen);
    await expect(aiw.locator(".aiw__drop-chips .rpg-chip", { hasText: "Anwen Hale" })).toBeVisible();
  });

  test("Home manuscript card shows live active chapter and words-today", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "u26-h1", num: 1, title: "The Gate" }, { id: "u26-h2", num: 2, title: "The Bridge" }],
        activeChapterId: "u26-h2",
        manuscripts: {},
      });
      // First save of the day set the baseline; now add today's words.
      await B.ManuscriptChapterService.setChapterContent("u26-h2", {
        html: "", text: "Seven new words went onto the page today.",
      });
    });
    // Navigate to Home.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "home" } })));
    await page.waitForTimeout(400);
    const home = page.locator("[data-ui='HomeScreen'], .home").first();
    await expect(home).toBeVisible();
    await expect(home).toContainText("Ch. 2");
    // Words-today is live (8 words) — no +1,204 hardcode anywhere.
    await expect(home).toContainText("+8");
    await expect(home).not.toContainText("+1,204");
    await expect(home).not.toContainText("~7 weeks remaining");
  });
});
