// Workflow T64: Relationships tab — regression coverage. The tab is already
// fully live + persistent (audit found no fixes needed): bonds are
// relationships entities, LinkService.listRelationshipEdgesSync derives the
// graph, and create/edit go through the entity editor. This locks that in:
// a seeded bond renders in the single view, and the create action opens the
// relationships editor.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openRelationshipsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } })));
  await page.waitForTimeout(300);
}

test.describe("T64. Relationships tab", () => {
  test("a seeded bond renders live in the single view", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "cast", { name: "Aelinor Vey",  data: { role: "protagonist" } }, { status: "active" });
    const b = await saveEntity(page, "cast", { name: "Captain Brec", data: { role: "supporting" } }, { status: "active" });
    await saveEntity(page, "relationships", {
      data: {
        from: { id: a.id, name: "Aelinor Vey", type: "cast" },
        to:   { id: b.id, name: "Captain Brec", type: "cast" },
        bondType: "ally", valence: "positive", summary: "Tide-sworn shield of the Reach.",
      },
    }, { status: "active" });
    await openRelationshipsPanel(page);
    await expect(page.locator("[data-ui='RelationshipsPanelBody']")).toBeVisible({ timeout: 5000 });
    const card = page.locator(".rel-card");
    await expect(card.first()).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText("Captain Brec");        // bond target (derived edge)
    await expect(card).toContainText("Tide-sworn shield");   // edge.summary from data.summary
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/relationships.png" });
  });

  test("the create action opens the relationships editor", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor Vey", data: { role: "protagonist" } }, { status: "active" });
    await openRelationshipsPanel(page);
    await expect(page.locator("[data-ui='RelationshipsPanelBody']")).toBeVisible({ timeout: 5000 });
    // no bonds yet -> single view shows the "+ Create" affordance
    await page.locator("[data-callback='onCreateRelationship']").first().click();
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 5000 });
  });
});
