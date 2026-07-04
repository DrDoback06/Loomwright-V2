// Workflow T43: Whole-app surface sweep — every route, panel, and full
// workspace renders without page errors, dead registrations, or
// "Workspace not registered" placeholders, on a real (seeded) project.
//
// This is the Phase-7 safety net: it iterates the SAME registries the
// app navigates by (NAV_ITEMS, PANEL_ACCESS), so a surface added later
// is swept automatically — and a surface that breaks fails loudly.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function seedOneOfEverything(page) {
  const types = ["cast", "bestiary", "locations", "items", "classes", "races", "stats", "skills", "abilities", "quests", "events", "lore", "factions", "references"];
  for (const t of types) {
    await saveEntity(page, t, { name: "Sweep " + t, data: {} }, { status: "active" });
  }
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "sw-1", num: 1, title: "Sweep", state: "saved", bodyText: "A quiet chapter." }],
      activeChapterId: "sw-1",
      manuscripts: { "sw-1": { text: "A quiet chapter." } },
      trashedChapters: [],
    });
  });
}

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push("pageerror: " + String(err).slice(0, 300)));
  page.on("console", (m) => {
    const t = m.text();
    // React component crashes surface as console errors.
    if (m.type() === "error" && !/favicon|net::|ERR_|Download the React DevTools/.test(t)) {
      errors.push("console: " + t.slice(0, 300));
    }
  });
  return errors;
}

test.describe("T43. Surface sweep — nothing dead, nothing crashing", () => {
  test("every route renders", async ({ page }) => {
    const errors = collectErrors(page);
    await openFreshApp(page);
    await seedOneOfEverything(page);
    const routes = await page.evaluate(() => (window.NAV_ITEMS || []).filter((n) => n.kind === "route").map((n) => n.id));
    expect(routes.length).toBeGreaterThanOrEqual(3);
    for (const r of routes.filter((x) => x !== "settings")) {
      await page.evaluate((routeId) => {
        window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId } }));
      }, r);
      await page.waitForTimeout(350);
    }
    // Settings opens the Control Centre workspace.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "sweep" } }));
    });
    await expect(page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='control-centre']")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("every nav panel opens and renders a body", async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectErrors(page);
    await openFreshApp(page);
    await seedOneOfEverything(page);
    const kinds = await page.evaluate(() => (window.NAV_ITEMS || [])
      .filter((n) => n.kind === "panel")
      .map((n) => n.panelKind || n.entity || n.id));
    expect(kinds.length).toBeGreaterThanOrEqual(15);
    for (const kind of kinds) {
      await page.evaluate((k) => {
        window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
      }, kind);
      await page.waitForTimeout(300);
      // The newest panel is rendered (front of the stack) with SOME body content.
      const panelCount = await page.locator(".pstk__panel").count();
      expect(panelCount, "panel for " + kind).toBeGreaterThan(0);
      // No missing-preset diagnostic. (Older panels auto-collapse to the
      // rail as new ones open — no need to close them.)
      await expect(page.locator(".pstk__panel:has-text('Missing preset')")).toHaveCount(0);
    }
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("every registered full workspace opens with no 'not registered' placeholder", async ({ page }) => {
    const errors = collectErrors(page);
    await openFreshApp(page);
    await seedOneOfEverything(page);
    // Workspace ids from PANEL_ACCESS — the same source the panel buttons use.
    const pairs = await page.evaluate(() => {
      const seen = new Map();
      for (const [kind, acc] of Object.entries(window.PANEL_ACCESS || {})) {
        if (acc && acc.workspaceId && acc.workspaceMode !== "existing" && !seen.has(acc.workspaceId)) {
          seen.set(acc.workspaceId, kind);
        }
      }
      return [...seen.entries()];
    });
    expect(pairs.length).toBeGreaterThanOrEqual(12);
    for (const [workspaceId, panelKind] of pairs) {
      await page.evaluate(({ workspaceId, panelKind }) => {
        window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId, panelKind, sourcePanel: "sweep" } }));
      }, { workspaceId, panelKind });
      const host = page.locator(`[data-ui='FullWorkspaceHost'][data-workspace-id='${workspaceId}']`);
      await expect(host, workspaceId).toBeVisible({ timeout: 5000 });
      await expect(host, workspaceId + " must be registered").not.toContainText("Workspace not registered");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("the 'existing' full-screen editors (Atlas, Skill Trees) open from their panels", async ({ page }) => {
    const errors = collectErrors(page);
    await openFreshApp(page);
    await seedOneOfEverything(page);
    // Atlas editor.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "atlas-editor", panelKind: "atlas", sourcePanel: "sweep" } }));
    });
    await expect(page.locator("[data-ui='AtlasEditor'], [data-ui='AtlasFullScreen'], .atlas-editor, .atfs").first()).toBeVisible({ timeout: 6000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    // Skill tree editor.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "skill-tree-editor", panelKind: "skills", sourcePanel: "sweep" } }));
    });
    await expect(page.locator(".ste-overlay, [data-ui='SkillTreeEditor']").first()).toBeVisible({ timeout: 6000 });
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("Abilities is its own working surface: roster, detail, edit, tree hop", async ({ page }) => {
    const errors = collectErrors(page);
    await openFreshApp(page);
    await saveEntity(page, "skills", { name: "Salt-walker", summary: "Crosses salted causeways unharmed.", data: { skillType: "passive", effects: [{ trigger: "On causeway", effect: "Ignore terrain" }] } }, { status: "active" });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "abilities" } }));
    });
    const body = page.locator("[data-ui='AbilitiesPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    // Not the deprecation card.
    await expect(body).not.toContainText("compatibility panel");
    await expect(body).toContainText("Salt-walker");
    await body.locator(".loc-tree__row:has-text('Salt-walker')").click();
    await expect(body).toContainText("Crosses salted causeways unharmed.");
    await expect(body).toContainText("Ignore terrain");
    // Edit opens the editor on the record.
    await body.locator("[data-callback='onEditEntity']").click();
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-ui='EntityEditor']")).toContainText("Salt-walker");
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
