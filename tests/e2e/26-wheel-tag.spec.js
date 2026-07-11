// Workflow T26: Area 7 — the adaptive wheel's Tag action.
//
// Right-click an entity node → wheel → Tag → a quick-tag input appears → typing
// a tag and pressing Enter appends it to the entity's data.tags and persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

test.describe("T26. Adaptive wheel — Tag action", () => {
  test("tagging an entity via the wheel persists to data.tags", async ({ page }) => {
    await openFreshApp(page);
    const ev = await saveEntity(page, "events", {
      name: "The Keep Falls",
      data: { eventType: "Battle" },
    }, { status: "active" });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } })));
    const body = page.locator("[data-ui='TimelinePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });

    // Open the wheel over the event card, then choose Tag.
    await body.locator(`[data-event-id='${ev.id}']`).click({ button: "right" });
    const wheel = page.locator("[data-testid='adaptive-wheel']");
    await expect(wheel).toBeVisible({ timeout: 5000 });
    await wheel.locator("[data-testid='wheel-tag']").click();

    // The quick-tag input appears; type a tag and submit.
    const input = page.locator("[data-testid='quick-tag-input']");
    await expect(input).toBeVisible();
    await input.fill("climax");
    await input.press("Enter");

    // The tag lands on the entity and survives a store read.
    await expect.poll(async () =>
      page.evaluate((id) => {
        const e = window.LoomwrightBackend.EntityService.getSync(id, "events");
        return (e && e.data && e.data.tags) || [];
      }, ev.id)
    ).toContain("climax");
  });
});
