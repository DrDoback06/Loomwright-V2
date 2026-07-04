// Workflow Q (Audit Log / Undo Pass):
//   - AuditService records every meaningful local mutation.
//   - Home Recent Activity reads from the live audit log.
//   - Undo restores entity state for create / update / delete.
//   - Review accept logs the action (audit-only path).
//   - Settings provider key updates never leak the secret value.
//   - Sample load is undoable and preserves user-created records.
//
// Service-shaped — drives backend so it stays stable while the
// Home recent-activity UI iterates.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("Q. Audit Log / Undo — recent activity, reversible actions, privacy", () => {

  test("create entity → audit event recorded with right target pointer", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Hess Vaela" });
    const result = await page.evaluate((entityId) => {
      const Audit = window.LoomwrightBackend.AuditService;
      const recent = Audit.getRecentSync(1)[0] || null;
      return {
        action: recent?.action,
        entityType: recent?.entityType,
        targetId: recent?.targetId,
        targetName: recent?.targetName,
      };
    }, cast.id);
    expect(result.action).toBe("entity.create");
    expect(result.entityType).toBe("cast");
    expect(result.targetId).toBe(cast.id);
    expect(result.targetName).toBe("Hess Vaela");
  });

  test("edit entity → undo restores old name", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Original" });
    const result = await page.evaluate(async (entityId) => {
      const B = window.LoomwrightBackend;
      await B.EntityService.update("cast", entityId, { name: "Changed" });
      const updateEvent = B.AuditService.listSync({ action: "entity.update" })[0];
      await B.AuditService.undo(updateEvent.id);
      return {
        nameAfterUndo: B.EntityService.getSync(entityId, "cast")?.name,
        originalUndone: B.AuditService.getSync(updateEvent.id)?.undone,
        undoEventLogged: B.AuditService.listSync({ action: "audit.undo" }).length,
      };
    }, cast.id);
    expect(result.nameAfterUndo).toBe("Original");
    expect(result.originalUndone).toBe(true);
    expect(result.undoEventLogged).toBeGreaterThanOrEqual(1);
  });

  test("delete entity → undo restores it (active status)", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Will-be-restored" });
    const result = await page.evaluate(async (entityId) => {
      const B = window.LoomwrightBackend;
      await B.EntityService.delete("cast", entityId);
      const deleteEvent = B.AuditService.listSync({ action: "entity.delete" })[0];
      await B.AuditService.undo(deleteEvent.id);
      const restored = B.EntityService.getSync(entityId, "cast");
      return { status: restored?.status, name: restored?.name };
    }, cast.id);
    expect(result.status).toBe("active");
    expect(result.name).toBe("Will-be-restored");
  });

  test("review accept logs review.accept event and review item can be reopened", async ({ page }) => {
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      // Seed a review item.
      await B.ReviewService.add({
        id: "rv-1", entityType: "cast", name: "Pending Candidate", status: "pending", payload: { name: "Pending Candidate" },
      });
      await B.ReviewService.resolve("rv-1", "accepted");
      const event = B.AuditService.listSync({ action: "review.accept" })[0];
      // Undo: should reopen the item to pending.
      await B.AuditService.undo(event.id);
      const queue = B.StorageService.getSync(B.keys.reviewQueue, []);
      const item = queue.find((q) => q.id === "rv-1");
      return {
        eventRecorded: !!event,
        targetId: event?.targetId,
        reopened: item?.status,
      };
    });
    expect(result.eventRecorded).toBe(true);
    expect(result.targetId).toBe("rv-1");
    expect(result.reopened).toBe("pending");
  });

  test("settings provider key update — audit log never contains the API key value", async ({ page }) => {
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.SettingsService.saveSection("aiProviders", {
        provider: "anthropic",
        apiKey: "sk-ant-AUDIT-LEAK-TEST",
        model: "claude-opus-4-7",
      });
      const evt = B.AuditService.listSync({ action: "settings.section-update" })[0];
      const allJson = JSON.stringify(B.AuditService.loadSync());
      const exportJson = JSON.stringify(B.AuditService.exportSync());
      return {
        eventRecorded: !!evt,
        sectionId: evt?.targetId,
        afterApiKey: evt?.after?.apiKey,
        logContainsSecret: allJson.includes("sk-ant-AUDIT-LEAK-TEST"),
        exportContainsSecret: exportJson.includes("sk-ant-AUDIT-LEAK-TEST"),
      };
    });
    expect(result.eventRecorded).toBe(true);
    expect(result.sectionId).toBe("aiProviders");
    expect(result.afterApiKey).toBe("[redacted]");
    expect(result.logContainsSecret).toBe(false);
    expect(result.exportContainsSecret).toBe(false);
  });

  test("sample load → audit event with relatedIds; undo removes only sample records, preserves user entity", async ({ page }) => {
    await openFreshApp(page);
    // Seed a user-created entity that must survive any sample operation.
    const userEnt = await saveEntity(page, "cast", { name: "User-Created Hess" });
    const result = await page.evaluate(async (userEntityId) => {
      const B = window.LoomwrightBackend;
      await B.SampleProjectService.loadSample();
      const loadEvent = B.AuditService.listSync({ action: "sample.load" })[0];
      await B.AuditService.undo(loadEvent.id);
      const afterUndoCast = B.EntityService.listSync("cast");
      return {
        loadEventRecorded: !!loadEvent,
        relatedIdCount: (loadEvent?.relatedIds || []).length,
        userEntityStillThere: afterUndoCast.some((c) => c.id === userEntityId),
      };
    }, userEnt.id);
    expect(result.loadEventRecorded).toBe(true);
    expect(result.relatedIdCount).toBeGreaterThan(0);
    // The key contract: undoing a sample.load preserves the user's
    // own entity regardless of how many sample records were added.
    expect(result.userEntityStillThere).toBe(true);
  });
});
