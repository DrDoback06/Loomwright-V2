// Workflow T24: Area 5 — Composition overlay surfaces the generated draft.
//
// The registry runs the real (BYOK) AI call and dispatches
// lw:composition-draft-generated with the text. This verifies the overlay now
// (a) shows that draft, (b) reflects the generating state, and (c) inserts the
// real generated text — not an empty/stale payload — into the manuscript.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

async function openOverlayWithEntity(page) {
  const cast = await saveEntity(page, "cast", { name: "Aelinor", data: { role: "protagonist" } }, { status: "active" });
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent("lw:drop-to-composition", {
    detail: { id, entityType: "cast", name: "Aelinor", summary: "Protagonist" },
  })), cast.id);
  const overlay = page.locator("[data-ui='CompositionOverlay']");
  await expect(overlay).toBeVisible({ timeout: 5000 });
  return overlay;
}

test.describe("T24. Composition overlay — generated draft", () => {
  test("shows the generated draft once the AI call returns", async ({ page }) => {
    await openFreshApp(page);
    const overlay = await openOverlayWithEntity(page);

    // No draft yet — the draft block is absent.
    await expect(overlay.locator("[data-testid='co-draft-text']")).toHaveCount(0);

    // Simulate the registry's post-call event.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", {
      detail: { text: "The queen crossed the Pale Reach at dusk, saying nothing." },
    })));

    await expect(overlay.locator("[data-testid='co-draft-text']"))
      .toContainText("The queen crossed the Pale Reach at dusk");
  });

  test("reflects the generating state and clears on failure", async ({ page }) => {
    await openFreshApp(page);
    const overlay = await openOverlayWithEntity(page);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:composition-draft-generating")));
    await expect(overlay.locator(".co-draft")).toContainText("generating");

    // A failure (e.g. no provider) resolves the state without a draft.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:composition-draft-failed", { detail: { message: "No provider" } })));
    await expect(overlay.locator("[data-testid='co-draft-text']")).toHaveCount(0);
  });

  test("Insert carries the generated draft text", async ({ page }) => {
    await openFreshApp(page);
    const overlay = await openOverlayWithEntity(page);

    // Capture the insert event the button dispatches.
    await page.evaluate(() => {
      window.__insertedText = null;
      window.addEventListener("lw:composition-insert-draft", (e) => { window.__insertedText = e.detail && e.detail.text; });
    });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", {
      detail: { text: "A drafted paragraph to insert." },
    })));
    await expect(overlay.locator("[data-testid='co-draft-text']")).toContainText("A drafted paragraph to insert.");

    await overlay.getByRole("button", { name: /Insert as draft/ }).click();
    const inserted = await page.evaluate(() => window.__insertedText);
    expect(inserted).toBe("A drafted paragraph to insert.");
  });

  test("Insert is disabled until a draft exists", async ({ page }) => {
    await openFreshApp(page);
    const overlay = await openOverlayWithEntity(page);
    await expect(overlay.getByRole("button", { name: /Insert as draft/ })).toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:composition-draft-generated", {
      detail: { text: "Now there is a draft." },
    })));
    await expect(overlay.getByRole("button", { name: /Insert as draft/ })).toBeEnabled();
  });
});
