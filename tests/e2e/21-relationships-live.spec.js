// Workflow T21: Area 4 — Relationships workspace reads the LIVE store.
//
// Verifies that every mode of the Relationships panel is driven by live
// entities instead of the old ATLAS_CAST / RELATIONSHIPS demo constants:
//   - the cast bar + single/network/conflict views render seeded cast,
//   - a persisted relationship entity (extraction shape: data.fromId/toId/
//     relationshipType) becomes a real edge with derived meters,
//   - hopes/fears read the character's goals/fears,
//   - the review tab shows pending relationship candidates and Accept
//     creates a real relationship entity + resolves the queue item,
//   - an empty project shows the honest "No cast yet" state.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openRelPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
  });
  await page.waitForSelector("[data-ui='RelationshipsPanelBody']", { timeout: 5000 });
  await page.waitForTimeout(200);
}

async function seedPair(page) {
  const a = await saveEntity(page, "cast", {
    name: "Kestrel Vane",
    data: { role: "protagonist", goals: ["reach the Iron Gate"], fears: ["the drowning dream"] },
  }, { status: "active" });
  const b = await saveEntity(page, "cast", {
    name: "Doran Ash",
    data: { role: "antagonist" },
  }, { status: "active" });
  return { aId: a.id, bId: b.id };
}

test.describe("T21. Relationships — live workspace", () => {
  test("cast bar + single view render live cast and a persisted edge", async ({ page }) => {
    await openFreshApp(page);
    const { aId, bId } = await seedPair(page);
    // Extraction-accepted shape: cross-links nested under data.*.
    await saveEntity(page, "relationships", {
      name: "Kestrel → Doran",
      summary: "Bitter rivals over the Iron Gate.",
      data: { fromId: aId, toId: bId, relationshipType: "rival" },
    }, { status: "active" });

    await openRelPanel(page);

    // Live cast bar — seeded names, NOT the old demo (Aelinor/Saren/Brec…).
    await expect(page.locator(".rel-bar__cast")).toContainText("Kestrel");
    await expect(page.locator(".rel-bar__cast")).toContainText("Doran");
    await expect(page.locator(".rel-bar__cast")).not.toContainText("Aelinor");

    // Single view (protagonist selected by default) shows the rival edge.
    await expect(page.locator(".rel-single__name")).toHaveText("Kestrel Vane");
    await expect(page.locator(".rel-grid")).toContainText("Doran Ash");
    await expect(page.locator(".rel-grid")).toContainText("Bitter rivals");

    // Hopes/Fears read the character's live goals/fears.
    await expect(page.locator(".rel-twocol")).toContainText("reach the Iron Gate");
    await expect(page.locator(".rel-twocol")).toContainText("the drowning dream");
  });

  test("network mode draws one node per participating live character", async ({ page }) => {
    await openFreshApp(page);
    const { aId, bId } = await seedPair(page);
    await saveEntity(page, "relationships", {
      name: "edge", data: { fromId: aId, toId: bId, relationshipType: "enemy" },
    }, { status: "active" });

    await openRelPanel(page);
    await page.locator(".rel-bar__mode", { hasText: "Network" }).click();

    // Two labelled nodes render with the live names.
    await expect(page.locator(".rel-net__svg")).toContainText("Kestrel Vane");
    await expect(page.locator(".rel-net__svg")).toContainText("Doran Ash");
    // enemy edge → conflict legend chip present.
    await expect(page.locator(".rel-net__legend")).toContainText("Enemy");
  });

  test("review tab lists pending candidates and Accept creates a live edge", async ({ page }) => {
    await openFreshApp(page);
    const { aId, bId } = await seedPair(page);

    // Seed a pending relationship candidate in the review queue.
    await page.evaluate(async ({ aId, bId }) => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-test-1",
        entityType: "relationships",
        name: "Kestrel → Doran",
        status: "pending",
        confidence: 0.82,
        sourceQuote: "Kestrel would not look at Doran, and Doran only smiled.",
        suggestedChanges: { fromId: aId, toId: bId, relationshipType: "rival" },
        relatedEntityIds: [aId, bId],
      });
    }, { aId, bId });

    await openRelPanel(page);
    await page.locator(".rel-bar__mode", { hasText: "Review" }).click();

    // The pending candidate renders live (queue badge + card).
    await expect(page.locator(".rel-bar__q")).toHaveText("1");
    await expect(page.locator(".rel-review__card")).toContainText("Kestrel Vane");
    await expect(page.locator(".rel-review__card")).toContainText("Doran Ash");
    await expect(page.locator(".rel-review__quote")).toContainText("only smiled");

    const relsBefore = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("relationships").length);

    // Accept → creates a relationship entity + resolves the queue item.
    await page.locator(".rel-review__actions button", { hasText: "Accept" }).first().click();
    await page.waitForTimeout(300);

    const relsAfter = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("relationships").length);
    expect(relsAfter).toBe(relsBefore + 1);

    // The queue item is no longer pending → badge gone.
    await expect(page.locator(".rel-bar__q")).toHaveCount(0);

    // The new edge carries the cross-links.
    const created = await page.evaluate(() => {
      const list = window.LoomwrightBackend.EntityService.listSync("relationships");
      const e = list[list.length - 1];
      const d = e.data || {};
      return { from: d.fromId || (d.from && d.from.id), to: d.toId || (d.to && d.to.id), type: d.relationshipType || d.bondType };
    });
    expect(created.from).toBe(aId);
    expect(created.to).toBe(bId);
    expect(created.type).toBe("rival");
  });

  test("empty project shows the honest no-cast state", async ({ page }) => {
    await openFreshApp(page);
    await openRelPanel(page);
    await expect(page.locator("[data-ui='RelationshipsPanelBody']")).toContainText("No cast yet");
  });
});
