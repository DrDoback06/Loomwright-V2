// =====================================================================
// story-intelligence.jsx — live story graph analysis, impact mapping,
// project guidance, and local idea generation.
//
// This module deliberately builds ON TOP of the existing Loomwright services.
// It does not create a competing store. Every insight is derived from the live
// EntityService / OccurrenceService / ReviewService / manuscript / references
// and Project Intelligence records, and generated ideas are saved through the
// existing EntityService as reviewable drafts.
// =====================================================================

(function () {
  const DISMISSED_KEY = "lw:v2:today-dismissed";
  const DAY_MS = 24 * 60 * 60 * 1000;

  const TYPE_LABELS = {
    cast: "character",
    locations: "location",
    items: "item",
    quests: "story thread",
    events: "event",
    relationships: "relationship",
    timeline: "timeline moment",
    lore: "canon fact",
    references: "reference",
    factions: "faction",
    bestiary: "creature",
    classes: "class",
    races: "species",
    stats: "stat",
    skills: "skill",
    abilities: "ability",
  };

  const REQUIRED_FIELDS = {
    cast: [
      ["summary", "summary"],
      ["personality", "personality"],
      ["goals", "goals"],
      ["voiceProfile", "voice"],
      ["currentLocation", "current location"],
    ],
    locations: [
      ["summary", "summary"],
      ["description", "description"],
      ["parentId", "parent location"],
      ["placed", "Atlas placement"],
    ],
    items: [
      ["summary", "summary"],
      ["currentOwner", "owner"],
      ["currentLocation", "location"],
      ["status", "state"],
    ],
    quests: [
      ["summary", "summary"],
      ["goal", "goal"],
      ["steps", "steps"],
      ["status", "status"],
    ],
    events: [
      ["summary", "summary"],
      ["chapter", "chapter"],
      ["location", "location"],
      ["participants", "participants"],
    ],
    relationships: [
      ["fromId", "first side"],
      ["toId", "second side"],
      ["relationshipType", "relationship markers"],
      ["summary", "summary"],
    ],
    lore: [
      ["summary", "canon statement"],
      ["scope", "scope"],
      ["canon", "canon level"],
    ],
  };

  const IDEA_BANK = {
    cast: [
      {
        title: "The witness with the wrong memory",
        summary: "A witness remembers the same decisive event differently from everyone else, and both versions have evidence.",
        data: { role: "wildcard", personality: "precise, guarded, unexpectedly compassionate", goals: ["prove their memory is real"], fears: ["discovering they caused the contradiction"], secrets: "Their version of events protects somebody else.", writingInstructions: "Let certainty make them dangerous; avoid making them simply unreliable." },
        questions: ["Who benefits if this witness is believed?", "What physical evidence supports the impossible version?", "Which existing character knows more than they admit?"],
      },
      {
        title: "The person created by a promise",
        summary: "A new character exists because an established character once made a promise that has never been paid off on the page.",
        data: { role: "pressure point", personality: "patient until patience becomes leverage", goals: ["collect the promise"], fears: ["being dismissed as part of an old life"], writingInstructions: "Tie every scene to an existing obligation rather than coincidence." },
        questions: ["What was promised?", "Why has the character arrived now?", "What would fulfilling the promise destroy?"],
      },
      {
        title: "The loyal antagonist",
        summary: "An opposing character is absolutely loyal—to a person, belief, place, or future the protagonist threatens without realising it.",
        data: { role: "antagonist", personality: "disciplined, candid, difficult to hate", goals: ["protect the thing the protagonist endangers"], fears: ["winning too late"], writingInstructions: "Give them arguments the protagonist cannot easily dismiss." },
        questions: ["What are they protecting?", "Where are they morally right?", "What line will they still refuse to cross?"],
      },
    ],
    locations: [
      {
        title: "The place that remembers versions",
        summary: "A location visibly preserves incompatible versions of the story—old borders, erased names, rebuilt rooms, or routes that only some people remember.",
        data: { kind: "story site", history: "The site has been rewritten more than once.", currentStatus: "contested", placed: false },
        questions: ["Which version is physically visible?", "Who controls the official map?", "What changes when a character crosses the boundary?"],
      },
      {
        title: "The useful forbidden shortcut",
        summary: "A route solves an immediate problem but crosses a place whose rules expose a character secret or alter the cost of the journey.",
        data: { kind: "route", danger: "conditional", placed: false },
        questions: ["Why is it forbidden?", "What does the route demand?", "Who has used it before?"],
      },
      {
        title: "The ordinary room with political weight",
        summary: "A modest room becomes important because every faction can enter it but nobody can openly claim it.",
        data: { kind: "room", culture: "neutral ground maintained through ritual", placed: false },
        questions: ["What ritual keeps it neutral?", "Who secretly owns it?", "What happens when neutrality fails?"],
      },
    ],
    items: [
      {
        title: "The object that records use, not ownership",
        summary: "An object carries evidence of everyone who used it, making possession less important than its accumulated history.",
        data: { itemType: "story object", condition: "changes with every use", rarity: "singular", ownershipHistory: [] },
        questions: ["How does it record a user?", "Which past user must stay hidden?", "What false conclusion could the record create?"],
      },
      {
        title: "The gift that transfers a duty",
        summary: "Giving the item away also transfers an obligation, title, curse, access right, or social expectation.",
        data: { itemType: "symbolic", status: "transferable", restrictions: "The transfer is recognised even when the recipient refuses it." },
        questions: ["What duty moves with it?", "Who witnesses a valid transfer?", "Can the duty be broken without destroying the item?"],
      },
      {
        title: "The tool built for a missing problem",
        summary: "A specialised tool survives after its original purpose has been erased from common knowledge.",
        data: { itemType: "tool", condition: "functional but misunderstood", rarity: "uncommon" },
        questions: ["What problem was it designed for?", "Who recognises it?", "What modern use accidentally recreates the old danger?"],
      },
    ],
    quests: [
      {
        title: "The promise that keeps changing shape",
        summary: "A simple promise becomes a multi-stage story thread because every attempt to fulfil it reveals a more costly interpretation.",
        data: { questType: "promise", status: "Not started", steps: [{ id: "step-1", title: "Define what the promise originally meant", status: "Not started" }], branches: [] },
        questions: ["Who decides whether the promise is fulfilled?", "What is the cheapest interpretation?", "What is the honest interpretation?"],
      },
      {
        title: "The mystery whose answer is not the resolution",
        summary: "The truth can be discovered early; the real thread is deciding what to do with it and who is allowed to know.",
        data: { questType: "mystery", status: "Not started", steps: [{ id: "step-1", title: "Discover the truth", status: "Not started" }, { id: "step-2", title: "Choose who receives it", status: "Not started" }] },
        questions: ["Who is safer not knowing?", "What changes merely because the truth is known?", "What false solution remains attractive?"],
      },
      {
        title: "The victory that creates the next antagonist",
        summary: "Completing the objective solves the present conflict while creating a believable successor problem from its consequences.",
        data: { questType: "consequence chain", status: "Not started", steps: [{ id: "step-1", title: "Win the immediate conflict", status: "Not started" }, { id: "step-2", title: "Face the beneficiary of the victory", status: "Not started" }] },
        questions: ["Who gains power from success?", "Which ally becomes threatened?", "What resource is exhausted by winning?"],
      },
    ],
    events: [
      {
        title: "The public event with a private cause",
        summary: "A visible crisis is caused by a small private decision that only a few entities can trace.",
        data: { eventType: "turning point", cause: "A private choice with public consequences.", relationshipChanges: [], characterStateChanges: [], itemStateChanges: [], locationChanges: [], statChanges: [] },
        questions: ["Who knows the real cause?", "What official explanation replaces it?", "Which relationship changes first?"],
      },
      {
        title: "The same event happens twice",
        summary: "A later event deliberately mirrors an earlier one but changes one crucial participant, rule, or outcome.",
        data: { eventType: "callback", cause: "A previous pattern returns under changed conditions." },
        questions: ["What repeats exactly?", "What single difference changes the meaning?", "Who recognises the echo?"],
      },
      {
        title: "The quiet irreversible choice",
        summary: "A small decision creates a permanent world-state change before anybody understands its importance.",
        data: { eventType: "state change", immediateOutcome: "Almost nothing appears to happen.", longTermConsequence: "A later option no longer exists." },
        questions: ["What option disappears?", "When does the cast notice?", "Can the choice be traced back?"],
      },
    ],
    factions: [
      {
        title: "The faction united by incompatible reasons",
        summary: "Members agree on one action while holding motives that will split the group as soon as it succeeds.",
        data: { factionType: "coalition", goals: ["achieve the shared immediate aim"], secrets: "The alliance has several different definitions of victory." },
        questions: ["What single action unites them?", "Which motives cannot coexist afterward?", "Who is already planning for the split?"],
      },
    ],
    lore: [
      {
        title: "The rule everyone knows incorrectly",
        summary: "A widely repeated canon rule is almost right, but the missing condition matters more than the rule itself.",
        data: { canon: "character belief", scope: "world", confidence: "uncertain" },
        questions: ["What is the missing condition?", "Who profits from the simplified version?", "Where is the complete rule recorded?"],
      },
    ],
    bestiary: [
      {
        title: "The creature shaped by local history",
        summary: "A creature's behaviour is a biological or supernatural response to a specific past event in one location.",
        data: { creatureType: "regional", habitat: [], behaviour: "Re-enacts or avoids an old pattern." },
        questions: ["What event shaped it?", "What does it mistake characters for?", "How can understanding replace combat?"],
      },
    ],
  };

  function B() {
    return (typeof window !== "undefined") ? window.LoomwrightBackend : null;
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }

  function normalise(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function titleForType(type) {
    return TYPE_LABELS[type] || String(type || "entity").replace(/s$/, "");
  }

  function hasValue(value) {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  function readDismissed() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || "{}");
      const now = Date.now();
      return Object.fromEntries(Object.entries(parsed).filter(([, ts]) => now - Number(ts || 0) < 30 * DAY_MS));
    } catch (_) {
      return {};
    }
  }

  function writeDismissed(map) {
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(map || {})); } catch (_) {}
  }

  function collectCandidateIds(value, knownIds, nameToId, out = new Set(), seen = new Set()) {
    if (value == null) return out;
    if (typeof value === "string") {
      if (knownIds.has(value)) out.add(value);
      else {
        const byName = nameToId.get(normalise(value));
        if (byName) out.add(byName);
      }
      return out;
    }
    if (typeof value !== "object") return out;
    if (seen.has(value)) return out;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((v) => collectCandidateIds(v, knownIds, nameToId, out, seen));
      return out;
    }
    if (value.id && knownIds.has(value.id)) out.add(value.id);
    Object.values(value).forEach((v) => collectCandidateIds(v, knownIds, nameToId, out, seen));
    return out;
  }

  function collectDanglingObjectIds(value, knownIds, out = [], path = "", seen = new Set()) {
    if (!value || typeof value !== "object") return out;
    if (seen.has(value)) return out;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((v, i) => collectDanglingObjectIds(v, knownIds, out, `${path}[${i}]`, seen));
      return out;
    }
    for (const [key, child] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (child && typeof child === "object" && !Array.isArray(child) && typeof child.id === "string" && child.id && !knownIds.has(child.id)) {
        out.push({ id: child.id, path: nextPath, label: child.name || child.label || child.id });
      }
      if (/ids$/i.test(key) && Array.isArray(child)) {
        child.forEach((id, i) => {
          if (typeof id === "string" && id && !knownIds.has(id)) out.push({ id, path: `${nextPath}[${i}]`, label: id });
        });
      }
      collectDanglingObjectIds(child, knownIds, out, nextPath, seen);
    }
    return out;
  }

  function chapterText(chapter, manuscripts) {
    if (!chapter) return "";
    return chapter.bodyText
      || String(chapter.bodyHtml || "").replace(/<[^>]+>/g, " ")
      || manuscripts?.[chapter.id]?.text
      || "";
  }

  function buildSnapshot() {
    const backend = B();
    if (!backend?.EntityService) {
      return {
        entities: [], entityById: new Map(), chapters: [], chapterById: new Map(),
        occurrences: [], review: [], references: [], intel: {}, linksByEntity: new Map(), backlinks: new Map(),
      };
    }

    const raw = backend.EntityService.listAllSync() || {};
    const entities = [];
    for (const [type, byId] of Object.entries(raw)) {
      for (const entity of Object.values(byId || {})) {
        if (!entity || entity.status === "deleted") continue;
        entities.push({ ...entity, type: entity.type || type });
      }
    }
    const entityById = new Map(entities.map((e) => [e.id, e]));
    const knownIds = new Set(entityById.keys());
    const nameToId = new Map();
    for (const e of entities) {
      [e.name, e.title, ...(e.aliases || []), ...(e.data?.aliases || [])].filter(Boolean).forEach((n) => {
        const key = normalise(typeof n === "object" ? (n.name || n.label) : n);
        if (key && !nameToId.has(key)) nameToId.set(key, e.id);
      });
    }

    const manuscript = backend.ManuscriptChapterService?.loadSync?.() || {};
    const chapters = (manuscript.chapters || []).filter((c) => !c.reserved).map((c, index) => ({
      ...c,
      index,
      number: c.num || c.slotNumber || index + 1,
      text: chapterText(c, manuscript.manuscripts || {}),
    }));
    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    const occurrences = backend.OccurrenceService?.listAllSync?.() || [];
    const review = (backend.ReviewService?.listSync?.() || []).filter((r) => !["done", "accepted", "denied", "merged"].includes(r.status));
    const references = backend.ReferencesService?.listSync?.() || [];
    const intel = backend.ProjectIntelService?.loadSync?.() || {};

    const linksByEntity = new Map();
    const backlinks = new Map();
    for (const e of entities) {
      const ids = collectCandidateIds({ ...e, id: null }, knownIds, nameToId);
      ids.delete(e.id);
      linksByEntity.set(e.id, ids);
      for (const targetId of ids) {
        const incoming = backlinks.get(targetId) || new Set();
        incoming.add(e.id);
        backlinks.set(targetId, incoming);
      }
    }

    return {
      backend, raw, entities, entityById, knownIds, nameToId,
      manuscript, chapters, chapterById, occurrences, review, references, intel,
      linksByEntity, backlinks,
    };
  }

  function fieldValue(entity, field) {
    const data = entity?.data || {};
    return data[field] != null ? data[field] : entity?.[field];
  }

  function buildEntityProfile(entity, snapshot) {
    const occs = snapshot.occurrences.filter((o) => o.entityId === entity.id && !o.stale);
    const chapterIds = [...new Set(occs.map((o) => o.chapterId).filter(Boolean))];
    const chapterRows = chapterIds.map((id) => snapshot.chapterById.get(id)).filter(Boolean).sort((a, b) => a.index - b.index);
    const lastChapter = chapterRows[chapterRows.length - 1] || null;
    const firstChapter = chapterRows[0] || null;
    const latestStoryIndex = snapshot.chapters.length ? snapshot.chapters.length - 1 : -1;
    const dormantGap = lastChapter && latestStoryIndex >= 0 ? Math.max(0, latestStoryIndex - lastChapter.index) : (snapshot.chapters.length || 0);
    const requirements = REQUIRED_FIELDS[entity.type] || [["summary", "summary"], ["description", "description"]];
    const missing = requirements.filter(([field]) => !hasValue(fieldValue(entity, field))).map(([, label]) => label);
    const completeness = Math.max(0, Math.round(((requirements.length - missing.length) / Math.max(1, requirements.length)) * 100));
    const outgoing = [...(snapshot.linksByEntity.get(entity.id) || [])];
    const incoming = [...(snapshot.backlinks.get(entity.id) || [])];
    const dangling = collectDanglingObjectIds(entity.data || {}, snapshot.knownIds);
    const data = entity.data || {};
    const coords = data.coords || data.coordinates || null;
    const unplaced = entity.type === "locations"
      && data.placed !== true
      && !(coords && (Number.isFinite(coords.x) || Number.isFinite(coords.lat)))
      && !Number.isFinite(data.x)
      && !Number.isFinite(data.y);
    const isolated = outgoing.length === 0 && incoming.length === 0;

    return {
      entity,
      mentionCount: occs.length,
      chapterCount: chapterIds.length,
      chapterIds,
      firstChapter,
      lastChapter,
      dormantGap,
      completeness,
      missing,
      outgoing,
      incoming,
      linkedCount: new Set([...outgoing, ...incoming]).size,
      dangling,
      unplaced,
      isolated,
      riskScore: (missing.length * 4) + (dangling.length * 8) + (unplaced ? 10 : 0) + (isolated && occs.length > 0 ? 6 : 0),
    };
  }

  function buildProfiles(snapshot = buildSnapshot()) {
    return snapshot.entities.map((e) => buildEntityProfile(e, snapshot));
  }

  function buildReviewImpact(item, snapshot = buildSnapshot()) {
    const targetIds = collectCandidateIds({
      entityId: item.entityId,
      existingEntityId: item.existingEntityId,
      targetEntityId: item.targetEntityId,
      relatedEntityIds: item.relatedEntityIds,
      suggestedChanges: item.suggestedChanges,
      payload: item.payload,
      previousState: item.previousState,
    }, snapshot.knownIds, snapshot.nameToId);

    const direct = [...targetIds].map((id) => snapshot.entityById.get(id)).filter(Boolean);
    const affectedIds = new Set(targetIds);
    for (const id of targetIds) {
      for (const linked of snapshot.linksByEntity.get(id) || []) affectedIds.add(linked);
      for (const incoming of snapshot.backlinks.get(id) || []) affectedIds.add(incoming);
    }
    const affected = [...affectedIds].map((id) => snapshot.entityById.get(id)).filter(Boolean);
    const chapterIds = new Set();
    for (const id of affectedIds) {
      snapshot.occurrences.filter((o) => o.entityId === id).forEach((o) => { if (o.chapterId) chapterIds.add(o.chapterId); });
    }
    if (item.chapterId) chapterIds.add(item.chapterId);
    const chapterRows = [...chapterIds].map((id) => snapshot.chapterById.get(id)).filter(Boolean).sort((a, b) => a.index - b.index);
    const knockOnCount = Math.max(0, affected.length - direct.length);
    const score = direct.length * 2 + knockOnCount * 3 + chapterRows.length + (item.suggestedAction === "update" ? 2 : 0);
    const severity = score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "medium" : "low";

    return {
      item,
      direct,
      affected,
      knockOnCount,
      chapters: chapterRows,
      score,
      severity,
      summary: affected.length
        ? `${affected.length} linked ${affected.length === 1 ? "record" : "records"} · ${chapterRows.length} ${chapterRows.length === 1 ? "chapter" : "chapters"}`
        : "No existing linked records detected",
    };
  }

  function duplicateIdentityGroups(snapshot) {
    const buckets = new Map();
    for (const entity of snapshot.entities) {
      const keys = [entity.name, ...(entity.aliases || []), ...(entity.data?.aliases || [])]
        .map((v) => normalise(typeof v === "object" ? (v.name || v.label) : v))
        .filter((v) => v.length >= 3);
      for (const key of keys) {
        const list = buckets.get(key) || [];
        list.push(entity);
        buckets.set(key, list);
      }
    }
    return [...buckets.entries()]
      .filter(([, rows]) => new Set(rows.map((r) => r.id)).size > 1)
      .map(([key, rows]) => ({ key, rows: [...new Map(rows.map((r) => [r.id, r])).values()] }));
  }

  function suggestionBase(input) {
    return {
      confidence: "strong",
      priority: 50,
      related: [],
      chapter: "—",
      action: "Open",
      actionType: "open-entity",
      ...input,
    };
  }

  function buildSuggestions(opts = {}) {
    const snapshot = opts.snapshot || buildSnapshot();
    const profiles = buildProfiles(snapshot);
    const out = [];
    const add = (row) => out.push(suggestionBase(row));

    // Review work is enriched with a blast-radius summary so the user can see
    // the spiderweb of knock-on effects before accepting a major change.
    snapshot.review.slice(0, 12).forEach((item) => {
      const impact = buildReviewImpact(item, snapshot);
      const name = item.name || item.payload?.name || item.candidate?.name || "candidate";
      add({
        id: `intel-review-${item.id}`,
        section: impact.severity === "critical" || impact.severity === "high" ? "continuity" : "queue",
        title: `${impact.severity === "critical" ? "Major change" : "Review"}: ${name}`,
        why: `${item.sourceQuote || item.payload?.sourceQuote || item.reason || "Extracted change awaiting review."} · Impact: ${impact.summary}.`,
        related: impact.affected.slice(0, 5).map((e) => ({ id: e.id, type: e.type, label: e.name })),
        action: "Inspect change and knock-on effects",
        actionType: "open-review",
        reviewItemId: item.id,
        confidence: impact.severity === "critical" ? "high" : (item.confidenceBand === "red" ? "uncertain" : "strong"),
        priority: impact.severity === "critical" ? 100 : impact.severity === "high" ? 90 : 72,
        impact,
        chapter: impact.chapters.length ? impact.chapters.map((c) => `Ch. ${c.number}`).slice(0, 3).join(", ") : "—",
      });
    });

    // Chapters containing meaningful prose but no tracked occurrences are a
    // strong signal that extraction has not been run or needs refreshing.
    snapshot.chapters.forEach((chapter) => {
      const words = chapter.text.trim().split(/\s+/).filter(Boolean).length;
      const occCount = snapshot.occurrences.filter((o) => o.chapterId === chapter.id && !o.stale).length;
      if (words >= 120 && occCount === 0) {
        add({
          id: `intel-extract-${chapter.id}`,
          section: "threads",
          title: `Chapter ${chapter.number} has no tracked entities yet`,
          why: `${words.toLocaleString()} words are present, but no live entity occurrences are linked to this chapter.`,
          action: "Extract and build the chapter graph",
          actionType: "extract-chapter",
          chapterId: chapter.id,
          chapter: `Ch. ${chapter.number}`,
          confidence: "high",
          priority: 88,
        });
      }
    });

    // Open quests / story threads.
    profiles.filter((p) => p.entity.type === "quests").forEach((profile) => {
      const steps = fieldValue(profile.entity, "steps") || [];
      const open = Array.isArray(steps) ? steps.filter((s) => !["done", "complete", "completed", "failed", "skipped"].includes(normalise(s?.status))) : [];
      if (open.length) {
        add({
          id: `intel-quest-${profile.entity.id}`,
          section: "quests",
          title: `${profile.entity.name}: ${open.length} open ${open.length === 1 ? "step" : "steps"}`,
          why: profile.chapterCount
            ? `The thread appears across ${profile.chapterCount} chapters and still has unresolved movement.`
            : "This thread is planned but has not yet been connected to a manuscript occurrence.",
          related: [{ id: profile.entity.id, type: profile.entity.type, label: profile.entity.name }],
          action: "Open the story thread",
          actionType: "open-entity",
          priority: 76,
        });
      }
    });

    // Dormant cast and other established entities that have fallen out of the
    // manuscript. This is based on real occurrence history, never a fake date.
    profiles.filter((p) => p.entity.type === "cast" && p.chapterCount > 0 && p.dormantGap >= 3 && fieldValue(p.entity, "dormant") !== true).forEach((profile) => {
      add({
        id: `intel-dormant-${profile.entity.id}`,
        section: "untouched",
        title: `${profile.entity.name} has been absent for ${profile.dormantGap} chapters`,
        why: `Last tracked in Chapter ${profile.lastChapter?.number || "?"}. Review whether this is intentional, a missing callback, or a dormant arc.`,
        related: [{ id: profile.entity.id, type: profile.entity.type, label: profile.entity.name }],
        action: "Open dossier and history",
        actionType: "open-entity",
        chapter: profile.lastChapter ? `Last: Ch. ${profile.lastChapter.number}` : "—",
        confidence: "strong",
        priority: 68 + Math.min(12, profile.dormantGap),
      });
    });

    // Thin records that matter on the page deserve completion before the app
    // attempts deeper inference from them.
    profiles.filter((p) => p.mentionCount >= 2 && p.completeness < 60).slice(0, 10).forEach((profile) => {
      add({
        id: `intel-thin-${profile.entity.id}`,
        section: "intel",
        title: `${profile.entity.name} is important but under-described`,
        why: `${profile.mentionCount} manuscript mentions across ${profile.chapterCount} chapters. Missing: ${profile.missing.join(", ") || "deeper context"}.`,
        related: [{ id: profile.entity.id, type: profile.entity.type, label: profile.entity.name }],
        action: `Complete the ${titleForType(profile.entity.type)} dossier`,
        actionType: "edit-entity",
        confidence: "strong",
        priority: 66,
      });
    });

    // Atlas staging: locations can be discovered and tracked before the user
    // chooses coordinates. They should surface automatically rather than vanish.
    profiles.filter((p) => p.unplaced).slice(0, 8).forEach((profile) => {
      add({
        id: `intel-unplaced-${profile.entity.id}`,
        section: "untouched",
        title: `${profile.entity.name} is waiting in the Atlas staging tray`,
        why: `${Math.max(0, profile.mentionCount)} tracked mentions; no map placement has been committed yet.`,
        related: [{ id: profile.entity.id, type: "locations", label: profile.entity.name }],
        action: "Place or attach to a parent location",
        actionType: "open-atlas-location",
        confidence: profile.mentionCount >= 2 ? "high" : "strong",
        priority: 70 + Math.min(10, profile.mentionCount),
      });
    });

    // Dangling links and duplicate identities are immediate continuity risks.
    profiles.filter((p) => p.dangling.length).slice(0, 8).forEach((profile) => {
      add({
        id: `intel-dangling-${profile.entity.id}`,
        section: "continuity",
        title: `${profile.entity.name} contains ${profile.dangling.length} broken ${profile.dangling.length === 1 ? "link" : "links"}`,
        why: profile.dangling.slice(0, 3).map((d) => `${d.path} → ${d.label}`).join("; "),
        related: [{ id: profile.entity.id, type: profile.entity.type, label: profile.entity.name }],
        action: "Repair references",
        actionType: "edit-entity",
        confidence: "high",
        priority: 94,
      });
    });

    duplicateIdentityGroups(snapshot).slice(0, 6).forEach((group, index) => {
      add({
        id: `intel-duplicate-${group.key}-${index}`,
        section: "continuity",
        title: `Possible duplicate identity: ${group.rows.map((r) => r.name).join(" / ")}`,
        why: `The same name or alias resolves to ${group.rows.length} live entities. Compare and merge, or confirm they are distinct.`,
        related: group.rows.slice(0, 5).map((e) => ({ id: e.id, type: e.type, label: e.name })),
        action: "Compare identities",
        actionType: "open-entity",
        confidence: "uncertain",
        priority: 82,
      });
    });

    // Project Intelligence gaps.
    const canonRules = Array.isArray(snapshot.intel.canonRules) ? snapshot.intel.canonRules : [];
    if (!snapshot.intel.writingStyleGuide) {
      add({ id: "intel-style-gap", section: "intel", title: "No writing-style guide is active", why: "Voice analysis and AI writing tools have less reliable guidance without a confirmed style profile.", action: "Open Project Intelligence", actionType: "open-intel", confidence: "strong", priority: 62 });
    }
    if (!canonRules.length && snapshot.chapters.length) {
      add({ id: "intel-canon-gap", section: "intel", title: "The manuscript has no confirmed canon rules", why: "Promote important world rules and promises so continuity checks can distinguish fact, belief, rumour, and secret truth.", action: "Create first canon rules", actionType: "open-intel", confidence: "strong", priority: 64 });
    }

    // One local, free inspiration seed. The Idea Forge can generate more on
    // demand. This is intentionally a draft suggestion, never silently canon.
    if (snapshot.chapters.length || snapshot.entities.length) {
      const seedType = profiles.some((p) => p.entity.type === "cast") ? "quests" : "cast";
      const seed = generateEntitySeed({ type: seedType, mode: "gap", snapshot, nonce: snapshot.entities.length + snapshot.chapters.length });
      add({
        id: `intel-idea-${seed.type}-${normalise(seed.name).replace(/[^a-z0-9]+/g, "-")}`,
        section: "inspiration",
        title: `Idea Forge: ${seed.name}`,
        why: `${seed.summary} ${seed.rationale}`.trim(),
        related: (seed.suggestedLinks || []).map((e) => ({ id: e.id, type: e.type, label: e.name })),
        action: "Create as an editable draft",
        actionType: "create-idea",
        ideaSeed: seed,
        confidence: "uncertain",
        priority: 45,
      });
    }

    const dismissed = readDismissed();
    return out
      .filter((s) => !dismissed[s.id])
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.title).localeCompare(String(b.title)))
      .slice(0, opts.limit || 36);
  }

  function projectWords(snapshot) {
    return snapshot.chapters.reduce((sum, c) => sum + c.text.trim().split(/\s+/).filter(Boolean).length, 0);
  }

  function buildDashboard() {
    const snapshot = buildSnapshot();
    const profiles = buildProfiles(snapshot);
    const suggestions = buildSuggestions({ snapshot, limit: 36 });
    const avgCompleteness = profiles.length
      ? Math.round(profiles.reduce((sum, p) => sum + p.completeness, 0) / profiles.length)
      : 0;
    const draftedChapters = snapshot.chapters.filter((c) => c.text.trim()).length;
    const trackedChapters = snapshot.chapters.filter((c) => snapshot.occurrences.some((o) => o.chapterId === c.id && !o.stale)).length;
    const extractionCoverage = draftedChapters ? Math.round((trackedChapters / draftedChapters) * 100) : 0;
    const highImpactReview = snapshot.review.map((r) => buildReviewImpact(r, snapshot)).filter((i) => i.severity === "critical" || i.severity === "high");
    const danglingCount = profiles.reduce((sum, p) => sum + p.dangling.length, 0);
    const unplacedCount = profiles.filter((p) => p.unplaced).length;
    const dormantCount = profiles.filter((p) => p.entity.type === "cast" && p.chapterCount > 0 && p.dormantGap >= 3).length;
    const penalty = Math.min(55, highImpactReview.length * 4 + danglingCount * 3 + Math.round((100 - extractionCoverage) * 0.2));
    const storyHealth = snapshot.chapters.length || snapshot.entities.length
      ? Math.max(0, Math.min(100, Math.round((avgCompleteness * 0.45) + (extractionCoverage * 0.55) - penalty)))
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      storyHealth,
      avgCompleteness,
      extractionCoverage,
      words: projectWords(snapshot),
      chapterCount: snapshot.chapters.length,
      entityCount: snapshot.entities.length,
      occurrenceCount: snapshot.occurrences.length,
      pendingReviewCount: snapshot.review.length,
      highImpactReviewCount: highImpactReview.length,
      danglingCount,
      unplacedCount,
      dormantCount,
      profiles,
      suggestions,
      risks: suggestions.filter((s) => s.section === "continuity").slice(0, 8),
      opportunities: suggestions.filter((s) => ["threads", "untouched", "inspiration", "quests"].includes(s.section)).slice(0, 8),
      snapshot,
    };
  }

  function hashString(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(list, seed, offset = 0) {
    if (!list?.length) return null;
    return list[(Math.abs(seed + offset) % list.length)];
  }

  function generateName(type, seed, existingNames) {
    const starts = {
      cast: ["Mara", "Orin", "Vessa", "Calder", "Ilyra", "Tovan", "Nessa", "Rook", "Edrin", "Sable"],
      locations: ["The Quiet", "Ash", "Glass", "Hollow", "Red", "Salt", "Last", "Black", "Lantern", "Broken"],
      items: ["The Oath", "Memory", "Glass", "Hollow", "Last", "Salt", "Witness", "Thorn", "Night", "Cinder"],
      quests: ["The Debt of", "The Return to", "What Remains of", "The Promise Beneath", "The Last Road to", "The Silence After"],
      events: ["The Night of", "The Breaking of", "The Second", "The Quiet", "The Unmaking of", "The False"],
      factions: ["The Concord of", "The Keepers of", "The Unsworn", "The Last House of", "The Lantern Court of"],
      lore: ["The Rule of", "What Everyone Knows About", "The Hidden Condition of", "The First Lie of"],
      bestiary: ["Morrow", "Salt", "Glass", "Hollow", "Bell", "Cairn", "Ash", "Lantern"],
    };
    const ends = {
      cast: ["Vale", "Morrow", "Hess", "Renn", "Tarn", "Vey", "Crow", "Dane", "Rusk", "Mere"],
      locations: ["Crossing", "Court", "Reach", "House", "Road", "Vault", "Gate", "Shore", "District", "Room"],
      items: ["Key", "Ledger", "Blade", "Bell", "Mask", "Thread", "Seal", "Map", "Cup", "Crown"],
      quests: ["Winter", "the Empty Throne", "the Seventh Bell", "the Missing Witness", "the Broken Map", "the Unpaid Dead"],
      events: ["Bells", "Gate", "Witness", "Crown", "Road", "Oath", "Map", "Dawn"],
      factions: ["the Grey Road", "the Seventh Bell", "Morrow", "the Open Hand", "the Unmapped Coast"],
      lore: ["Names", "Debt", "Crossings", "Memory", "Inheritance", "Witnesses"],
      bestiary: ["Hound", "Moth", "Hart", "Wraith", "Crow", "Leech", "Stag", "Spider"],
    };
    const a = pick(starts[type] || ["New"], seed, 1);
    const b = pick(ends[type] || [titleForType(type)], seed, 7);
    let name = type === "cast" ? `${a} ${b}` : `${a} ${b}`;
    let suffix = 2;
    while (existingNames.has(normalise(name))) name = `${a} ${b} ${suffix++}`;
    return name;
  }

  function generateEntitySeed({ type = "cast", mode = "random", snapshot = buildSnapshot(), nonce = Date.now() } = {}) {
    const bank = IDEA_BANK[type] || IDEA_BANK.cast;
    const premise = snapshot.intel?.projectFoundation?.premise || snapshot.intel?.premise || "";
    const themes = snapshot.intel?.projectFoundation?.themes || snapshot.intel?.themes || [];
    const seedNumber = hashString(`${type}|${mode}|${nonce}|${premise}|${JSON.stringify(themes)}|${snapshot.entities.length}`);
    const pattern = pick(bank, seedNumber, 3) || bank[0];
    const existingNames = new Set(snapshot.entities.map((e) => normalise(e.name)));
    const name = generateName(type, seedNumber, existingNames);

    const eligibleLinks = snapshot.entities
      .filter((e) => e.type !== type || type === "events" || type === "quests")
      .sort((a, b) => (snapshot.backlinks.get(b.id)?.size || 0) - (snapshot.backlinks.get(a.id)?.size || 0));
    const suggestedLinks = [];
    if (eligibleLinks.length) suggestedLinks.push(eligibleLinks[seedNumber % eligibleLinks.length]);
    if (eligibleLinks.length > 1) {
      const second = eligibleLinks[(seedNumber + 5) % eligibleLinks.length];
      if (second && !suggestedLinks.some((e) => e.id === second.id)) suggestedLinks.push(second);
    }

    const themeText = Array.isArray(themes) ? themes.filter(Boolean).slice(0, 3).join(", ") : String(themes || "");
    return {
      type,
      name,
      summary: pattern.summary,
      data: {
        ...clone(pattern.data || {}),
        summary: pattern.summary,
        ideaQuestions: clone(pattern.questions || []),
        ideaMode: mode,
        suggestedLinks: suggestedLinks.map((e) => ({ id: e.id, name: e.name, type: e.type })),
        tags: ["idea-forge", "draft"],
      },
      questions: clone(pattern.questions || []),
      suggestedLinks,
      rationale: suggestedLinks.length
        ? `It can be tested against ${suggestedLinks.map((e) => e.name).join(" and ")}${themeText ? ` while reinforcing ${themeText}` : ""}.`
        : (themeText ? `It can reinforce ${themeText}.` : "It is deliberately uncommitted until the writer develops it."),
      source: "idea-forge",
      mode,
    };
  }

  async function createIdeaEntity(seed) {
    const backend = B();
    if (!backend?.EntityService || !seed?.type) throw new Error("Idea Forge is not ready.");
    const entity = await backend.EntityService.save(seed.type, {
      name: seed.name,
      source: "idea-forge",
      data: {
        ...(seed.data || {}),
        summary: seed.summary || seed.data?.summary || "",
        ideaQuestions: seed.questions || seed.data?.ideaQuestions || [],
        ideaRationale: seed.rationale || "",
        suggestedLinks: (seed.suggestedLinks || []).map((e) => ({ id: e.id, name: e.name, type: e.type })),
      },
    }, { status: "draft", sourceSurface: "idea-forge" });
    window.dispatchEvent(new CustomEvent("lw:story-intelligence-updated", { detail: { reason: "idea-created", entity } }));
    window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: `Idea draft created: ${entity.name}` } }));
    return entity;
  }

  function dismissSuggestion(id) {
    if (!id) return;
    const dismissed = readDismissed();
    dismissed[id] = Date.now();
    writeDismissed(dismissed);
    window.dispatchEvent(new CustomEvent("lw:story-intelligence-updated", { detail: { reason: "dismissed", id } }));
  }

  function restoreDismissedSuggestions() {
    writeDismissed({});
    window.dispatchEvent(new CustomEvent("lw:story-intelligence-updated", { detail: { reason: "dismissals-cleared" } }));
  }

  async function executeSuggestion(suggestion) {
    if (!suggestion) return null;
    const action = suggestion.actionType;
    if (action === "create-idea") {
      const entity = await createIdeaEntity(suggestion.ideaSeed || generateEntitySeed({ type: "cast" }));
      window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: entity.type, initial: entity } }));
      return entity;
    }
    if (action === "extract-chapter") {
      window.LoomwrightDispatchCallback?.("onOpenExtractionWizard", { detail: { scope: "chapter", chapterId: suggestion.chapterId } });
      return true;
    }
    if (action === "open-review") {
      window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: { type: "review", reviewItemId: suggestion.reviewItemId } }));
      return true;
    }
    if (action === "open-intel") {
      window.LoomwrightDispatchCallback?.("onOpenProjectIntelligenceFile", { detail: {} });
      return true;
    }
    if (action === "open-atlas-location") {
      const rel = suggestion.related?.[0];
      if (rel) {
        window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: { type: "entity", entityType: rel.type, entityId: rel.id } }));
        window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } }));
      }
      return true;
    }
    const rel = suggestion.related?.[0];
    if (rel) {
      if (action === "edit-entity") {
        const entity = B()?.EntityService?.getSync?.(rel.id, rel.type);
        window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: rel.type, initial: entity || { id: rel.id, name: rel.label } } }));
      } else {
        window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: { type: "entity", entityType: rel.type, entityId: rel.id } }));
      }
      return true;
    }
    return false;
  }

  const StoryIntelligenceService = {
    buildSnapshot,
    buildProfiles,
    buildEntityProfile,
    buildReviewImpact,
    buildSuggestions,
    buildDashboard,
    generateEntitySeed,
    createIdeaEntity,
    executeSuggestion,
    dismissSuggestion,
    restoreDismissedSuggestions,
    readDismissed,
  };

  function install() {
    const backend = B();
    if (!backend) return false;
    backend.StoryIntelligenceService = StoryIntelligenceService;
    window.StoryIntelligenceService = StoryIntelligenceService;
    window.dispatchEvent(new CustomEvent("lw:story-intelligence-ready", { detail: { service: StoryIntelligenceService } }));
    return true;
  }

  if (!install() && typeof window !== "undefined") {
    window.addEventListener("lw:backend-ready", install, { once: true });
  }
})();
