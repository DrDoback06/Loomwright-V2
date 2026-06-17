// Workflow T73: Today tab — suggestions are live (audit confirmed:
// buildTodaySuggestions derives from quests/reviews/chapters + the
// InsightService engine; Dismiss-× persists to localStorage). The gap: the
// card's bottom action row (primary action / → Tangle / Dismiss) had
// data-callback only with no payload, so Send-to-Writer/Tangle fired empty
// and the bottom Dismiss was dead. Now they carry the suggestion. This
// verifies a live suggestion renders, → Tangle persists a node, and the
// × dismiss persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openTodayPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "today" } })));
  await page.waitForTimeout(300);
}

test.describe("T73. Today tab", () => {
  test("live suggestion renders; Tangle + dismiss actions work", async ({ page }) => {
    await openFreshApp(page);
    // a quest with an open step -> a live Today suggestion
    await saveEntity(page, "quests", { title: "Brec's Letter", data: { steps: [{ id: "s1", title: "Find it", status: "todo" }] } }, { status: "active" });
    await openTodayPanel(page);
    const panel = page.locator("[data-ui='TodayPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("Brec's Letter"); // live suggestion from the quest

    const cards = panel.locator(".today__card");
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    // → Tangle creates a persisted suggestion node
    await cards.first().getByRole("button", { name: "→ Tangle" }).click();
    await page.waitForTimeout(250);
    const tangleNodes = await page.evaluate(() => {
      const s = window.LoomwrightBackend.TangleService.loadSync();
      return (s.nodes || []).filter((n) => n.kind === "suggestion").length;
    });
    expect(tangleNodes).toBeGreaterThan(0);

    // dismiss (×) hides the card and persists to localStorage
    const before = await cards.count();
    await cards.first().locator(".today__card-dismiss").click();
    await expect(cards).toHaveCount(before - 1);
    const dismissed = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lw:v2:today_dismissed") || "[]"));
    expect(dismissed.length).toBeGreaterThan(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/today.png" });
  });
});
