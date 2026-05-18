// =====================================================================
// handoff-service.jsx — AI Handoff Pack persistence and generation.
//
// Coordinates the build of a handoff JSON pack from entities, project
// intelligence, references, and manuscript context. Handles clipboard
// copy, download, and result import.
//
// Public API (on window.HandoffService):
//   .generatePack(options)            → Promise<object>
//   .generatePrompt(pack)             → string
//   .copyPackToClipboard(pack?)       → Promise<void>
//   .downloadPack(pack?)              → Promise<void>
//   .importResult(textOrJson)         → Promise<object>
//   .parseResult(json)                → object
//   .getLastPack()                    → Promise<object|null>
//   .saveLastPack(pack)               → Promise<void>
// =====================================================================

const HandoffService = (() => {
  const STORE_KEY = "last_handoff_pack";

  async function _gatherContext(options) {
    const intel = await ProjectIntelService.load();
    const refs = await ReferencesService.list();
    const onboarding = await OnboardingService.load();

    return {
      projectIntelligence: options.includeProjectIntelligence !== false ? intel : undefined,
      references: options.includeReferences !== false
        ? refs.filter((r) => r.aiContext).map((r) => ({ id: r.id, type: r.type, title: r.title, content: r.content }))
        : undefined,
      onboarding: options.includeOnboarding ? onboarding : undefined,
      styleProfile: intel ? { tone: intel.writingStyleGuide, keywords: intel.toneKeywords } : undefined,
      canonRules: intel ? intel.canonRules : undefined,
    };
  }

  return {
    async generatePack(options = {}) {
      const {
        outputType = "scene",
        detailLevel = "balanced",
        selectedEntities = [],
        instructions = "",
        contextOptions = {},
        surface = "composition",
        targetChapterId = null,
      } = options;

      const entityData = [];
      for (const sel of selectedEntities) {
        const full = await EntityService.get(sel.id);
        if (!full) continue;
        const entry = {
          id: full.id,
          type: full.type,
          name: full.name,
          role: sel.role || "referenced",
        };
        if (detailLevel !== "minimal") {
          entry.summary = full.summary;
          entry.aliases = full.aliases;
        }
        if (detailLevel === "full") {
          entry.fields = full.fields;
          entry.related = full.related;
          entry.mentions = full.mentions;
        }
        entityData.push(entry);
      }

      const context = await _gatherContext(contextOptions);

      const pack = {
        id: "hp-" + Date.now().toString(36),
        purpose: instructions || "Generate " + outputType,
        outputType,
        detailLevel,
        targetChapterId,
        instructions,
        selectedEntities: entityData,
        contextOptions,
        ...context,
        constraints: {
          maxTokens: contextOptions.maxContext || 16000,
          excludeDormant: contextOptions.excludeDormant !== false,
        },
        expectedReturnType: outputType === "entity" ? "json" : "text",
        timestamp: new Date().toISOString(),
        surface,
      };

      await this.saveLastPack(pack);
      return pack;
    },

    generatePrompt(pack) {
      if (typeof buildAIHandoffPrompt === "function") {
        return buildAIHandoffPrompt(pack);
      }
      const lines = [];
      lines.push("# AI Handoff — " + (pack.purpose || "Task"));
      lines.push("");
      lines.push("**Output type:** " + (pack.outputType || "scene"));
      lines.push("**Detail level:** " + (pack.detailLevel || "balanced"));
      if (pack.instructions) {
        lines.push("");
        lines.push("## Instructions");
        lines.push(pack.instructions);
      }
      if (pack.selectedEntities && pack.selectedEntities.length > 0) {
        lines.push("");
        lines.push("## Entities");
        for (const e of pack.selectedEntities) {
          lines.push("- **" + e.name + "** (" + e.type + ", role: " + e.role + ")" + (e.summary ? " — " + e.summary : ""));
        }
      }
      if (pack.canonRules && pack.canonRules.length > 0) {
        lines.push("");
        lines.push("## Canon rules");
        for (const rule of pack.canonRules) lines.push("- " + rule);
      }
      if (pack.styleProfile) {
        lines.push("");
        lines.push("## Style");
        lines.push(pack.styleProfile.tone || "(not set)");
      }
      lines.push("");
      lines.push("---");
      lines.push("Return your result as " + (pack.expectedReturnType || "text") + ".");
      return lines.join("\n");
    },

    async copyPackToClipboard(pack) {
      const p = pack || await this.getLastPack();
      if (!p) return;
      const json = JSON.stringify(p, null, 2);
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // Fallback for non-HTTPS
        const ta = document.createElement("textarea");
        ta.value = json;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    },

    async downloadPack(pack) {
      const p = pack || await this.getLastPack();
      if (!p) return;
      const json = JSON.stringify(p, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "loomwright-handoff-" + (p.id || Date.now()) + ".json";
      a.click();
      URL.revokeObjectURL(url);
    },

    async importResult(textOrJson) {
      let parsed;
      try {
        parsed = typeof textOrJson === "string" ? JSON.parse(textOrJson) : textOrJson;
      } catch {
        return { type: "text", content: textOrJson, parsed: false };
      }
      return { type: "json", content: parsed, parsed: true };
    },

    parseResult(json) {
      if (!json) return { entities: [], text: "", suggestions: [] };
      if (typeof json === "string") {
        try { json = JSON.parse(json); } catch { return { entities: [], text: json, suggestions: [] }; }
      }
      return {
        entities: json.entities || json.updates || [],
        text: json.text || json.content || json.draft || "",
        suggestions: json.suggestions || json.reviewItems || [],
      };
    },

    async getLastPack() {
      return StorageService.get(STORE_KEY);
    },

    async saveLastPack(pack) {
      await StorageService.set(STORE_KEY, pack);
    },
  };
})();

window.HandoffService = HandoffService;
