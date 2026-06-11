// Workflow T38: Full workspaces read the LIVE store and honour the
// panel's selected entity.
//
// The 12 narrative/RPG full workspaces used to read window.ENTITY_SAMPLES
// (quarantined to {} on real projects) and fall back to hardcoded demo
// rosters (Aelinor Vey…). These specs prove, at the rendered-DOM level:
//   1. a fresh project shows WorkspaceEmptyState — never demo names;
//   2. a saved entity appears in the workspace roster + dossier;
//   3. opening with an entityId focuses that record (not items[0]);
//   4. live updates re-render without a reload;
//   5. FullRecordSection renders schema fields and its Edit opens the editor.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

// [workspaceId, panelKind, entityType, name fields for seeding]
const WORKSPACES = [
  ["cast-dossier",         "cast",      "cast"],
  ["bestiary-field-guide", "bestiary",  "bestiary"],
  ["quest-log",            "quests",    "quests"],
  ["event-ledger",         "events",    "events"],
  ["canon-vault",          "lore",      "lore"],
  ["location-registry",    "locations", "locations"],
  ["item-vault",           "items",     "items"],
  ["class-builder",        "classes",   "classes"],
  ["species-registry",     "races",     "races"],
  ["stat-lab",             "stats",     "stats"],
  ["faction-registry",     "factions",  "factions"],
];

const DEMO_NAMES = ["Aelinor Vey", "Captain Brec", "Saren of Hess", "Auger Wake", "Salt-ghost", "The Auger of Hess", "Greycoats lower no banner"];

async function openWorkspace(page, workspaceId, panelKind, entityId = null) {
  await page.evaluate(({ workspaceId, panelKind, entityId }) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: { workspaceId, panelKind, sourcePanel: "test", entityId },
    }));
  }, { workspaceId, panelKind, entityId });
  await page.waitForSelector(`[data-ui='FullWorkspaceHost'][data-workspace-id='${workspaceId}']`, { timeout: 5000 });
}

async function exitWorkspace(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

test.describe("T38. Full workspaces — live store + entity focus", () => {
  test("fresh project: every workspace shows the empty state, never demo data", async ({ page }) => {
    await openFreshApp(page);
    for (const [workspaceId, panelKind] of WORKSPACES) {
      await openWorkspace(page, workspaceId, panelKind);
      const host = page.locator(`[data-ui='FullWorkspaceHost'][data-workspace-id='${workspaceId}']`);
      await expect(host.locator("[data-ui='WorkspaceEmptyState']"), workspaceId + " should render its empty state").toBeVisible({ timeout: 4000 });
      for (const demo of DEMO_NAMES) {
        await expect(host, workspaceId + " must not render demo name " + demo).not.toContainText(demo);
      }
      await exitWorkspace(page);
    }
    // timeline-workspace empties differently (chapters OR events).
    await openWorkspace(page, "timeline-workspace", "timeline");
    const tl = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='timeline-workspace']");
    await expect(tl.locator("[data-ui='WorkspaceEmptyState']")).toBeVisible();
    await exitWorkspace(page);
  });

  test("a saved entity of each type renders in its workspace roster", async ({ page }) => {
    await openFreshApp(page);
    const seeded = {};
    for (const [workspaceId, panelKind, type] of WORKSPACES) {
      const ent = await saveEntity(page, type, { name: "Live " + type + " One", data: {} }, { status: "active" });
      seeded[workspaceId] = ent;
    }
    for (const [workspaceId, panelKind, type] of WORKSPACES) {
      await openWorkspace(page, workspaceId, panelKind);
      const host = page.locator(`[data-ui='FullWorkspaceHost'][data-workspace-id='${workspaceId}']`);
      await expect(host, workspaceId + " should show the live record").toContainText("Live " + type + " One", { timeout: 4000 });
      await exitWorkspace(page);
    }
  });

  test("cast dossier: live fields render and FullRecordSection shows schema data", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", {
      name: "Live Hero",
      summary: "Holds the gate.",
      data: {
        role: "protagonist",
        title: "Warden of the Gate",
        personality: "Stubborn, kind in private.",
        goals: ["Hold the southern gate"],
        backstory: "Born in the gatehouse; never left it.",
      },
    }, { status: "active" });
    await openWorkspace(page, "cast-dossier", "cast");
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='cast-dossier']");
    await expect(host).toContainText("Live Hero");
    await expect(host).toContainText("Warden of the Gate");
    await expect(host).toContainText("Born in the gatehouse");
    // FullRecordSection renders populated schema sections.
    const frs = host.locator("[data-ui='FullRecordSection']");
    await expect(frs).toBeVisible();
    await expect(frs).toContainText("Hold the southern gate");
  });

  test("opening with entityId focuses the selected record, not items[0]", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Alpha First", data: { role: "supporting" } }, { status: "active" });
    const beta = await saveEntity(page, "cast", { name: "Beta Second", data: { role: "protagonist", title: "The Chosen" } }, { status: "active" });
    await openWorkspace(page, "cast-dossier", "cast", beta.id);
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='cast-dossier']");
    // The selected roster row is Beta…
    await expect(host.locator(".fws-roster__row.is-selected")).toHaveAttribute("data-entity-id", beta.id);
    // …and the dossier hero shows Beta, not Alpha.
    await expect(host.locator(".fws-dossier__name")).toContainText("Beta Second");
  });

  test("live update re-renders the open workspace without reload", async ({ page }) => {
    await openFreshApp(page);
    const ent = await saveEntity(page, "items", { name: "Plain Dagger", data: { itemType: "Weapon" } }, { status: "active" });
    await openWorkspace(page, "item-vault", "items", ent.id);
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='item-vault']");
    await expect(host).toContainText("Plain Dagger");
    await page.evaluate(async ({ id }) => {
      await window.LoomwrightBackend.EntityService.update("items", id, { name: "Renamed Dagger" });
    }, { id: ent.id });
    await expect(host).toContainText("Renamed Dagger", { timeout: 4000 });
  });

  test("FullRecordSection Edit opens the entity editor on the record", async ({ page }) => {
    await openFreshApp(page);
    const ent = await saveEntity(page, "quests", {
      name: "The Long Watch",
      data: { questType: "Mystery", status: "Active", goal: "Find who douses the beacons." },
    }, { status: "active" });
    await openWorkspace(page, "quest-log", "quests", ent.id);
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='quest-log']");
    const frs = host.locator("[data-ui='FullRecordSection']");
    await expect(frs).toContainText("Find who douses the beacons.");
    await frs.locator("button:has-text('Edit')").first().click();
    // The entity editor surface opens with the quest loaded.
    const editor = page.locator("[data-ui='EntityEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toContainText("The Long Watch");
  });

  test("panel header button carries the panel's selection into the workspace", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Alpha First", data: { role: "supporting" } }, { status: "active" });
    const beta = await saveEntity(page, "cast", { name: "Beta Second", data: { role: "protagonist" } }, { status: "active" });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } }));
    });
    await page.waitForTimeout(300);
    // Select Beta in the cast panel, then open the workspace via the real header button.
    await page.locator(".cast-row[data-cast-id]:has-text('Beta Second')").click();
    await page.locator("[data-callback='onOpenPanelWorkspace'][title='Open Dossier View']").click();
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='cast-dossier']");
    await expect(host).toBeVisible({ timeout: 5000 });
    await expect(host.locator(".fws-roster__row.is-selected")).toHaveAttribute("data-entity-id", beta.id);
    await expect(host.locator(".fws-dossier__name")).toContainText("Beta Second");
  });

  test("timeline workspace renders live events on the track", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [
          { id: "ch-1", num: 1, title: "One", state: "saved", bodyText: "" },
          { id: "ch-2", num: 2, title: "Two", state: "saved", bodyText: "" },
        ],
        activeChapterId: "ch-1",
        manuscripts: { "ch-1": { text: "" }, "ch-2": { text: "" } },
        trashedChapters: [],
      });
    });
    await saveEntity(page, "events", { name: "The Beacon Fails", data: { eventType: "Disaster", chapter: "Ch. 2" } }, { status: "active" });
    await openWorkspace(page, "timeline-workspace", "timeline");
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='timeline-workspace']");
    await expect(host).toContainText("The Beacon Fails");
    await expect(host).toContainText("Ch.2");
  });
});
