// Workflow T21: Area 4 — Relationships tab becomes a live, visual hub.
//
// Verifies the Relationships panel renders LIVE data instead of the old demo
// constants: persisted relationship entities (both the extraction shape
// {fromId,toId,relationshipType} and the entity-editor shape
// {from,to,bondType,intensity}) resolve to graph edges + compare meters, the
// character bar is driven by live cast, empty states show when the store is
// empty, and pending relationship review candidates render + Accept persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity, getEntityCount } = require("./helpers");

async function openRelPanel(page) {
  // On a cold boot the shell is still compiling app.jsx with in-browser Babel
  // when this runs, so a single open-panel dispatch can land before the
  // listener is registered and get lost. onOpenPanel is idempotent (it never
  // closes an open panel), so re-dispatch on each poll until the body mounts.
  await page.waitForFunction(() => {
    if (document.querySelector("[data-ui='RelationshipsPanelBody']")) return true;
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
    return false;
  }, null, { timeout: 60000, polling: 800 });
  await page.waitForTimeout(300);
}

// Seed two cast members and return their ids.
async function seedPair(page) {
  const a = await saveEntity(page, "cast", { name: "Aelinor Vey", data: { role: "protagonist", summary: "Queen of the Pale Reach.", goals: ["broker peace with Hess"], fears: ["becoming her mother"] } }, { status: "active" });
  const b = await saveEntity(page, "cast", { name: "Saren of Hess", data: { role: "antagonist", summary: "Heir to House Hess." } }, { status: "active" });
  return { a, b };
}

test.describe("T21. Relationships tab — live hub", () => {
  // The static shell compiles ~80 JSX files with in-browser Babel on every
  // navigation; a fresh-app boot (two navigations) can exceed the default
  // 30s budget on slower machines. Give each test room to boot.
  test.beforeEach(({}, testInfo) => { testInfo.setTimeout(120_000); });

  test("empty store shows the no-characters empty state (not demo cast)", async ({ page }) => {
    await openFreshApp(page);
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    await expect(body).toBeVisible();
    // No live cast → the character bar is empty and the body shows the prompt.
    await expect(body.locator(".rel-empty")).toContainText(/No characters yet/i);
    // The old demo names must NOT appear anywhere.
    await expect(body).not.toContainText("Captain Brec");
    await expect(body).not.toContainText("The Auger");
  });

  test("extraction-shape relationship entity renders in single + network views", async ({ page }) => {
    await openFreshApp(page);
    const { a, b } = await seedPair(page);
    // Persist a relationship entity in the extraction/accept shape.
    await saveEntity(page, "relationships", {
      name: "Aelinor → Saren",
      summary: "Court rivals across the Glass Audience.",
      data: { fromId: a.id, toId: b.id, relationshipType: "confronted" },
    }, { status: "active" });
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    // The character bar shows both live cast members (first names).
    await expect(body.locator(".rel-bar__cast")).toContainText("Aelinor");
    await expect(body.locator(".rel-bar__cast")).toContainText("Saren");
    // Single view (default) shows the rival group card with the summary.
    await expect(body).toContainText("Court rivals across the Glass Audience.");
    // "confronted" normalises to the Rival bucket.
    await expect(body.locator(".rel-group__head")).toContainText(/Rival/i);
    // Network view graphs both nodes.
    await body.locator(".rel-bar__mode:has-text('Network')").click();
    await expect(body.locator(".rel-net__svg")).toBeVisible();
    await expect(body.locator(".rel-net__svg")).toContainText("Aelinor Vey");
    await expect(body.locator(".rel-net__svg")).toContainText("Saren of Hess");
  });

  test("editor-shape relationship (from/to/bondType/intensity/valence) drives compare meters", async ({ page }) => {
    await openFreshApp(page);
    const { a, b } = await seedPair(page);
    await saveEntity(page, "relationships", {
      name: "Aelinor & Saren",
      data: {
        from: { id: a.id, name: "Aelinor Vey", type: "cast" },
        to: { id: b.id, name: "Saren of Hess", type: "cast" },
        bondType: "enemy",
        intensity: "90",
        valence: "negative",
        summary: "Open enmity after the treaty broke.",
      },
    }, { status: "active" });
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    // Jump to Compare mode — Aelinor is the default focus, pick Saren as pair.
    await body.locator(".rel-bar__mode:has-text('Compare')").click();
    // The compare view resolves the edge and shows meters + summary.
    await expect(body.locator(".rel-compare")).toBeVisible();
    await expect(body).toContainText("Open enmity after the treaty broke.");
    // Strength meter reflects the intensity (90).
    const strengthMeter = body.locator(".rel-meter", { hasText: "Strength" });
    await expect(strengthMeter).toContainText("90");
    // Negative valence → low trust, high conflict.
    await expect(body.locator(".rel-meter", { hasText: "Conflict" })).toContainText("82");
  });

  test("relationship whose endpoint isn't a known cast member is skipped", async ({ page }) => {
    await openFreshApp(page);
    const { a } = await seedPair(page);
    // toId points at a non-existent entity → edge must be dropped.
    await saveEntity(page, "relationships", {
      name: "Aelinor → Ghost",
      data: { fromId: a.id, toId: "does-not-exist", relationshipType: "betrayed" },
    }, { status: "active" });
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    // Single view for Aelinor shows the no-relationships empty state.
    await expect(body.getByText(/No tracked relationships/i)).toBeVisible();
  });

  test("pending relationship candidate renders in Review and Accept persists an entity", async ({ page }) => {
    await openFreshApp(page);
    const { a, b } = await seedPair(page);
    await page.evaluate(async ({ fromId, toId }) => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-rel-1",
        entityType: "relationships",
        status: "pending",
        name: "Aelinor → Saren",
        summary: "Aelinor betrayed Saren.",
        suggestedAction: "create",
        confidence: 0.74,
        suggestedChanges: { fromId, toId, relationshipType: "betrayed" },
        relatedEntityIds: [fromId, toId],
        // Real extraction candidates carry sourceQuote as a plain string.
        sourceQuote: "Aelinor turned on Saren at the gate.",
      });
    }, { fromId: a.id, toId: b.id });
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    await body.locator(".rel-bar__mode:has-text('Review')").click();
    const card = body.locator(".rel-review__card");
    await expect(card).toContainText("Aelinor → Saren");
    await expect(card).toContainText("Aelinor turned on Saren at the gate.");
    const before = await getEntityCount(page, "relationships");
    await card.locator("button:has-text('Accept')").click();
    await page.waitForTimeout(600);
    const after = await getEntityCount(page, "relationships");
    expect(after).toBe(before + 1);
  });

  test("Review Deny resolves the candidate without creating an entity", async ({ page }) => {
    await openFreshApp(page);
    const { a, b } = await seedPair(page);
    await page.evaluate(async ({ fromId, toId }) => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-rel-deny", entityType: "relationships", status: "pending",
        name: "Aelinor → Saren", summary: "Uncertain bond.",
        suggestedAction: "create", confidence: 0.5,
        suggestedChanges: { fromId, toId, relationshipType: "whispered-to" },
      });
    }, { fromId: a.id, toId: b.id });
    await openRelPanel(page);
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    await body.locator(".rel-bar__mode:has-text('Review')").click();
    const before = await getEntityCount(page, "relationships");
    await body.locator(".rel-review__card button:has-text('Deny')").click();
    await page.waitForTimeout(500);
    // No entity created, and the candidate leaves the pending queue.
    expect(await getEntityCount(page, "relationships")).toBe(before);
    const stillPending = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync("relationships").some((i) => i.id === "rq-rel-deny" && i.status === "pending"));
    expect(stillPending).toBe(false);
  });
});
