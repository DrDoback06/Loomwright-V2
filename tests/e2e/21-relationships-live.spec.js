// Workflow U21: Area 4 phase 1 — Relationships panel renders live data.
//
// The designed UI (mode tabs Single / Compare 2 / Network / History /
// Conflict / Review) is unchanged; these tests verify every mode is driven
// by the live store (cast entities, relationship records, audit log,
// review queue) and that the old Pale Reach demo constants are gone.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function openRelationshipsPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
  });
  await page.waitForTimeout(300);
}

// Three characters: one explicit rival record (Anwen↔Bram) and one
// synthetic ally edge from Anwen's dossier fields (Anwen↔Cole).
async function seedTrio(page) {
  const anwen = await saveEntity(page, "cast", { name: "Anwen Hale", data: { role: "protagonist" } });
  const bram = await saveEntity(page, "cast", { name: "Bram Iron", data: { role: "antagonist" } });
  const cole = await saveEntity(page, "cast", { name: "Cole Fenn", data: {} });
  await page.evaluate(async ({ a, b, c }) => {
    const B = window.LoomwrightBackend;
    await B.EntityService.save("relationships", {
      name: "Anwen → Bram",
      summary: "Border rivals since the toll war.",
      data: { fromId: a, toId: b, bondType: "rival", secret: true, intensity: 72, trust: 18, conflict: 80 },
    }, { status: "active" });
    await B.EntityService.update("cast", a, {
      data: { role: "protagonist", goals: ["Hold the north road"], fears: ["Open water"], allies: [c] },
    });
  }, { a: anwen.id, b: bram.id, c: cole.id });
  return { anwen, bram, cole };
}

test.describe("U21. Relationships — live panel", () => {
  test("fresh project shows the designed empty state (no demo data)", async ({ page }) => {
    await openFreshApp(page);
    await openRelationshipsPanel(page);
    const rel = page.locator("[data-ui='RelationshipsPanelBody']");
    await expect(rel).toBeVisible();
    await expect(rel.locator("[data-ui='RelEmptyState']")).toBeVisible();
    await expect(rel).not.toContainText("Aelinor");
    await expect(rel).not.toContainText("Saren");
  });

  test("single, compare and network modes render the live cast and bonds", async ({ page }) => {
    await openFreshApp(page);
    await seedTrio(page);
    await openRelationshipsPanel(page);
    const rel = page.locator("[data-ui='RelationshipsPanelBody']");

    // Single — protagonist auto-selected; explicit rival + synthetic ally edges.
    await expect(rel.locator(".rel-single__name")).toHaveText("Anwen Hale");
    await expect(rel.locator(".rel-group__head", { hasText: "Rivals" })).toBeVisible();
    await expect(rel.locator(".rel-group__head", { hasText: "Friends" })).toBeVisible();
    await expect(rel.locator(".rel-card__name", { hasText: "Bram Iron" })).toBeVisible();
    // Hopes / fears come from data.goals / data.fears.
    await expect(rel).toContainText("Hold the north road");
    await expect(rel).toContainText("Open water");

    // Compare — click the rival card; live meters + secret badge.
    await rel.locator(".rel-card", { hasText: "Bram Iron" }).click();
    await expect(rel.locator(".rel-compare__type-lbl")).toHaveText("Rival");
    await expect(rel.locator(".rel-compare__type-secret")).toBeVisible();
    await expect(rel).toContainText("Border rivals since the toll war.");
    await expect(rel.locator(".rel-meter").first()).toContainText("72");

    // Network — three live nodes, none of the demo cast.
    await rel.locator(".rel-bar__mode", { hasText: "Network" }).click();
    await expect(rel.locator(".rel-net__svg circle[r='30']")).toHaveCount(3);
    await expect(rel.locator(".rel-net__svg text", { hasText: "Anwen Hale" })).toBeVisible();
    await expect(rel).not.toContainText("Aelinor");
  });

  test("review queue card accepts into a persisted relationship record", async ({ page }) => {
    await openFreshApp(page);
    const { anwen, bram } = await seedTrio(page);
    await page.evaluate(async ({ a, b }) => {
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({
        id: "rq-rel-e2e", entityType: "relationships", name: "Anwen → Bram (escalation)",
        suggestedAction: "create", confidence: 0.8, status: "pending",
        sourceQuote: "Anwen confronted Bram at the toll gate.",
        payload: { name: "Anwen → Bram (escalation)", entityType: "relationships" },
        suggestedChanges: { fromId: a, toId: b, relationshipType: "confronted" },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    }, { a: anwen.id, b: bram.id });
    await openRelationshipsPanel(page);
    const rel = page.locator("[data-ui='RelationshipsPanelBody']");
    await rel.locator(".rel-bar__mode", { hasText: "Review" }).click();
    await expect(rel.locator(".rel-review__card")).toHaveCount(1);
    await expect(rel).toContainText("Anwen confronted Bram at the toll gate.");
    await rel.locator("[data-testid='rel-accept-rq-rel-e2e']").click();
    await page.waitForTimeout(400);
    // Queue clears; a real relationships record exists now.
    await expect(rel.locator(".rel-review__card")).toHaveCount(0);
    const count = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("relationships").filter((r) => r.status !== "deleted").length);
    expect(count).toBe(2);
  });

  test("bonds persist across reload and History shows audit-derived changes", async ({ page }) => {
    await openFreshApp(page);
    await seedTrio(page);
    await openAppPreserveState(page);
    await openRelationshipsPanel(page);
    const rel = page.locator("[data-ui='RelationshipsPanelBody']");
    await expect(rel.locator(".rel-single__name")).toHaveText("Anwen Hale");
    await expect(rel.locator(".rel-card__name", { hasText: "Bram Iron" })).toBeVisible();
    // History mode — the created record shows as a "new" change from the audit log.
    await rel.locator(".rel-bar__mode", { hasText: "History" }).click();
    await expect(rel.locator(".rel-tl__card").first()).toContainText("Anwen Hale ↔ Bram Iron");
    await expect(rel.locator(".rel-tl__kind").first()).toHaveText("new");
  });
});
