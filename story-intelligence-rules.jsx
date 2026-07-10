// =====================================================================
// story-intelligence-rules.jsx — product-level refinement rules layered
// over StoryIntelligenceService without replacing its live-store engine.
// =====================================================================

(function () {
  const service = window.LoomwrightBackend?.StoryIntelligenceService || window.StoryIntelligenceService;
  if (!service || service.__refinedRulesInstalled) return;

  const originalBuildSuggestions = service.buildSuggestions.bind(service);
  const originalBuildDashboard = service.buildDashboard.bind(service);

  function isProjectEmpty(snapshot) {
    return !(snapshot?.chapters?.length || snapshot?.entities?.length || snapshot?.references?.length);
  }

  function addEarlyDossierInsights(rows, snapshot) {
    const ids = new Set(rows.map((r) => r.id));
    const profiles = service.buildProfiles(snapshot);
    for (const profile of profiles) {
      if (profile.mentionCount < 1 || profile.completeness > 60) continue;
      const id = `intel-thin-${profile.entity.id}`;
      if (ids.has(id)) continue;
      rows.push({
        id,
        section: "intel",
        title: `${profile.entity.name} has entered the story but needs a deeper dossier`,
        why: `${profile.mentionCount} tracked manuscript mention${profile.mentionCount === 1 ? "" : "s"}. Missing: ${profile.missing.join(", ") || "motives, context, and history"}.`,
        related: [{ id: profile.entity.id, type: profile.entity.type, label: profile.entity.name }],
        action: "Develop this entity",
        actionType: "edit-entity",
        confidence: "strong",
        priority: 63,
        chapter: profile.firstChapter ? `First: Ch. ${profile.firstChapter.number}` : "—",
      });
      ids.add(id);
    }
    return rows;
  }

  service.buildSuggestions = function refinedBuildSuggestions(opts = {}) {
    const snapshot = opts.snapshot || service.buildSnapshot();
    let rows = originalBuildSuggestions({ ...opts, snapshot, limit: Math.max(opts.limit || 36, 80) });

    // A blank project should feel intentionally blank. Idea Forge remains
    // available in the UI, but Loomwright must not invent a missing-style task
    // before the user has written, imported, referenced, or created anything.
    if (isProjectEmpty(snapshot)) {
      rows = rows.filter((row) => row.id !== "intel-style-gap" && row.id !== "intel-canon-gap");
    } else {
      rows = addEarlyDossierInsights(rows, snapshot);
    }

    return rows
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.title).localeCompare(String(b.title)))
      .slice(0, opts.limit || 36);
  };

  service.buildDashboard = function refinedBuildDashboard() {
    const dashboard = originalBuildDashboard();
    const snapshot = dashboard.snapshot || service.buildSnapshot();
    const suggestions = service.buildSuggestions({ snapshot, limit: 40 });
    return {
      ...dashboard,
      suggestions,
      risks: suggestions.filter((s) => s.section === "continuity").slice(0, 8),
      opportunities: suggestions.filter((s) => ["threads", "untouched", "inspiration", "quests"].includes(s.section)).slice(0, 8),
    };
  };

  service.__refinedRulesInstalled = true;
  window.dispatchEvent(new CustomEvent("lw:story-intelligence-updated", { detail: { reason: "rules-refined" } }));
})();
