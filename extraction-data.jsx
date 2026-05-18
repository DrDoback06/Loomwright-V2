// =====================================================================
// extraction-data.jsx — All placeholder data for extraction & review UI.
// Every record is tagged _mock: true so it can be stripped in one pass.
// Replace with backend data; the UI shapes are documented at file end.
// =====================================================================

// ---------------------------------------------------------------------
// Extraction stages — order matters; the UI walks this list.
// ---------------------------------------------------------------------
const EXTRACTION_STAGES = [
  { id: "snapshot",   label: "Saving manuscript snapshot",  hint: "Freezing the page state…" },
  { id: "scan",       label: "Scanning known entities",     hint: "Re-confirming names you've already approved." },
  { id: "detect",     label: "Detecting new entities",      hint: "Looking for unfamiliar proper nouns and concepts." },
  { id: "alias",      label: "Matching aliases",            hint: "Reconciling nicknames, titles, and short-forms." },
  { id: "rel",        label: "Checking relationships",      hint: "Tracing who-knows-whom and how." },
  { id: "loc",        label: "Checking locations / travel", hint: "Following characters across the atlas." },
  { id: "items",      label: "Checking items / inventory",  hint: "Tracking artefacts, gear, and possessions." },
  { id: "stats",      label: "Checking stats & abilities",  hint: "Picking up combat lines and skill use." },
  { id: "quests",     label: "Checking quests & events",    hint: "Aligning beats against your structure." },
  { id: "queues",     label: "Building review queues",      hint: "Routing candidates to the right tabs." },
  { id: "complete",   label: "Complete",                    hint: "Ready for review." },
];

// ---------------------------------------------------------------------
// Mock review queue items.
// Shape: see __SHAPES__ at end.
// ---------------------------------------------------------------------
const MOCK_QUEUE_ITEMS = [
  // ----- CAST -----
  { _mock: true, id: "q-cast-1", entityType: "cast", confidence: { band: "high", value: 96 }, status: "auto-added",
    suggestion: "create",
    candidate: { name: "Captain Brec", aliases: ["Brec", "the Captain"], summary: "Watch captain at Pale Reach. Four winters' service. Familiar to Aelinor." },
    mention: "He looked the same as he had four winters ago, except for the way the cold had settled into his face.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" },
    sourceParagraph: "p3",
    matched: null,
    conflict: null,
    rationale: "Speaker tag 'said Captain Brec' + dialogue attribution + 7 prior mentions in Bk I.",
    sessionId: "ses-2026-05-06-0917",
    extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-2", entityType: "cast", confidence: { band: "strong", value: 84 },  status: "pending",
    suggestion: "enrich",
    candidate: { name: "Aelinor Vey", aliases: ["the small dark queen"], summary: "Add new attribute: 'salt-air tremor'. Confirms long sleeplessness." },
    mention: "three nights of refusing the dreams had given her hands a fine, undignified tremor.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: { id: "e-aelinor", name: "Aelinor Vey", confidence: 99 },
    conflict: null,
    rationale: "Subject pronoun chain resolves to Aelinor; new physical detail.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-3", entityType: "cast", confidence: { band: "uncertain", value: 61 }, status: "pending",
    suggestion: "merge",
    candidate: { name: "Saren", aliases: ["Saren of Hess"], summary: "Possibly the same as 'Saren of Hess' from Ch. 3." },
    mention: "what Saren of Hess sent me to bring.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p6",
    matched: { id: "e-saren-hess", name: "Saren of Hess", confidence: 78 },
    conflict: { kind: "alias-collision", note: "Bk I has 'Saren the Quiet'. Three Sarens now." },
    rationale: "String-similarity 0.82 + locative phrase 'of Hess' shared.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-cast-4", entityType: "cast", confidence: { band: "weak", value: 38 }, status: "pending",
    suggestion: "create",
    candidate: { name: "the lieutenant", aliases: [], summary: "Possible new background character. Mentioned only by role." },
    mention: "the brazier had been pulled close to the lieutenant's table.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p4",
    matched: null,
    conflict: { kind: "common-noun", note: "Could be a role, not a person." },
    rationale: "Definite article + occupation. No prior naming.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- LOCATIONS -----
  { _mock: true, id: "q-loc-1", entityType: "locations", confidence: { band: "high", value: 94 }, status: "auto-added",
    suggestion: "enrich",
    candidate: { name: "Pale Reach", aliases: ["the Pale Reach"], summary: "New attribute: salt flats and tin-coloured winter light." },
    mention: "The light over Pale Reach was the colour of cooled tin.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p1",
    matched: { id: "e-pale-reach", name: "Pale Reach", confidence: 100 },
    conflict: null,
    rationale: "Exact-match existing canonical name; one new descriptor.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
  { _mock: true, id: "q-loc-2", entityType: "locations", confidence: { band: "weak", value: 41 }, status: "pending",
    suggestion: "merge",
    candidate: { name: "Vraska Pass", aliases: [], summary: "Possibly 'the Vraska' road from Ch. 2." },
    mention: "the road through the Vraska Pass is still walkable.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p7",
    matched: { id: "e-vraska", name: "the Vraska", confidence: 52 },
    conflict: { kind: "low-similarity", note: "Possessive form 'the Vraska' vs 'Vraska Pass'." },
    rationale: "Shared root 'Vraska' + travel verb; low surface match.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- ITEMS -----
  { _mock: true, id: "q-item-1", entityType: "items", confidence: { band: "strong", value: 88 }, status: "pending",
    suggestion: "update state",
    candidate: { name: "Auger of Hess", aliases: [], summary: "State change: in Saren's keeping → carried by Aelinor." },
    mention: "She carried the Auger of Hess in a felt-lined case slung across her back.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: { id: "e-auger", name: "Auger of Hess", confidence: 100 },
    conflict: null,
    rationale: "Possession verb + carrier change vs last-known location.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- EVENTS -----
  { _mock: true, id: "q-evt-1", entityType: "events", confidence: { band: "uncertain", value: 67 }, status: "pending",
    suggestion: "create",
    candidate: { name: "The Auger Wake", aliases: [], summary: "Recent event. Two casualties + livestock at Pale Reach. ~ a week ago." },
    mention: "The Auger Wake came through here last week. Took two of mine, and a goat.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: null,
    rationale: "Capitalised noun phrase + temporal anchor + casualty count.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- FACTIONS -----
  { _mock: true, id: "q-fac-1", entityType: "factions", confidence: { band: "uncertain", value: 58 }, status: "pending",
    suggestion: "enrich",
    candidate: { name: "The Grey Coats", aliases: [], summary: "Canon-shift: lowered banner. Bk I established 'never lower'." },
    mention: "The Grey Coats had left only the one banner.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p4",
    matched: { id: "e-greycoats", name: "The Grey Coats", confidence: 100 },
    conflict: { kind: "canon-shift", note: "Bk I §14: 'they would never lower it.'" },
    rationale: "Canonical fact contradiction; flag for author confirmation.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- LORE -----
  { _mock: true, id: "q-lore-1", entityType: "lore", confidence: { band: "strong", value: 79 }, status: "pending",
    suggestion: "create",
    candidate: { name: "The Hollowing", aliases: [], summary: "Implied event/condition. Possibly canonical." },
    mention: "We're not pretending anymore.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: null,
    rationale: "Speaker tone shift + admission language; aligns with Bk I lore tag 'Hollowing'.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- BESTIARY -----
  { _mock: true, id: "q-best-1", entityType: "bestiary", confidence: { band: "weak", value: 44 }, status: "pending",
    suggestion: "create",
    candidate: { name: "Auger Wake (creature?)", aliases: [], summary: "Unclear if creature, weather, or event. Disambiguate." },
    mention: "The Auger Wake came through here last week.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p5",
    matched: null,
    conflict: { kind: "ambiguous-type", note: "May overlap with Events queue (q-evt-1)." },
    rationale: "Verb 'came through' suggests entity with motion.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- ABILITIES -----
  { _mock: true, id: "q-abil-1", entityType: "abilities", confidence: { band: "high", value: 95 }, status: "auto-added",
    suggestion: "link",
    candidate: { name: "Salt-Reading", aliases: [], summary: "Re-uses ability already in dossier; mention adds chapter to mention list." },
    mention: "she could feel the flats before she could see them.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p1",
    matched: { id: "e-saltread", name: "Salt-Reading", confidence: 100 },
    conflict: null,
    rationale: "Pattern-match against ability description.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- RELATIONSHIPS -----
  { _mock: true, id: "q-rel-1", entityType: "relationships", confidence: { band: "strong", value: 81 }, status: "pending",
    suggestion: "create",
    candidate: { name: "Aelinor ⇄ Brec (familiarity)", aliases: [], summary: "Long-standing acquaintance; warm-cold tone." },
    mention: "He looked the same as he had four winters ago.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p3",
    matched: null,
    conflict: null,
    rationale: "Temporal anchor + recognition cue.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },

  // ----- TIMELINE -----
  { _mock: true, id: "q-tl-1", entityType: "timeline", confidence: { band: "high", value: 92 }, status: "auto-added",
    suggestion: "create",
    candidate: { name: "Brec's letter (3 nights ago)", aliases: [], summary: "Anchor event preceding chapter open." },
    mention: "She had not slept since Brec's letter.",
    sourceChapter: { id: "c7", num: 7, title: "Ash & Auger" }, sourceParagraph: "p2",
    matched: null,
    conflict: null,
    rationale: "Possessive anchor + duration cue.",
    sessionId: "ses-2026-05-06-0917", extractedAt: "2m ago",
  },
];

// ---------------------------------------------------------------------
// Extraction sessions (history)
// ---------------------------------------------------------------------
const MOCK_SESSIONS = [
  { _mock: true,
    id: "ses-2026-05-06-0917", chapterId: "c7", chapterLabel: "Ch. 7 — Ash & Auger",
    mode: "deep", privacy: "local",
    startedAt: "9:17 AM", completedAt: "9:18 AM", duration: "1m 12s",
    totals: { candidates: 14, accepted: 0, merged: 0, denied: 0, autoAdded: 4, failed: 0 },
    note: "Most recent run.",
    state: "complete",
  },
  { _mock: true,
    id: "ses-2026-05-04-1432", chapterId: "c3", chapterLabel: "Ch. 3 — Saren's Bargain",
    mode: "quick", privacy: "local",
    startedAt: "May 4 · 2:32 PM", completedAt: "May 4 · 2:32 PM", duration: "18s",
    totals: { candidates: 6, accepted: 5, merged: 1, denied: 0, autoAdded: 2, failed: 0 },
    note: "Routine sweep; clean pass.",
    state: "complete",
  },
  { _mock: true,
    id: "ses-2026-05-02-1108", chapterId: "c2", chapterLabel: "Ch. 2 — Pale Reach",
    mode: "deep", privacy: "ai",
    startedAt: "May 2 · 11:08 AM", completedAt: "May 2 · 11:11 AM", duration: "2m 47s",
    totals: { candidates: 22, accepted: 18, merged: 3, denied: 1, autoAdded: 6, failed: 0 },
    note: "Heavy lore session.",
    state: "complete",
  },
];

// ---------------------------------------------------------------------
// Auto-added (blue) history items (already in canon, still reviewable)
// ---------------------------------------------------------------------
const MOCK_AUTOADDED = [
  { _mock: true, id: "a1", entityType: "cast",      name: "Captain Brec",        addedAt: "2m ago",  confidence: 96, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a2", entityType: "locations", name: "Pale Reach",          addedAt: "2m ago",  confidence: 94, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a3", entityType: "abilities", name: "Salt-Reading",        addedAt: "2m ago",  confidence: 95, sessionId: "ses-2026-05-06-0917" },
  { _mock: true, id: "a4", entityType: "timeline",  name: "Brec's letter",       addedAt: "2m ago",  confidence: 92, sessionId: "ses-2026-05-06-0917" },
];

// ---------------------------------------------------------------------
// Per-entity queue counts (for Global Review Overview cards)
// ---------------------------------------------------------------------
const MOCK_OVERVIEW_COUNTS = {
  cast:          { pending: 4,  high: 1, strong: 1, uncertain: 1, weak: 1, autoAdded: 1, lastUpdated: "2m ago" },
  bestiary:      { pending: 1,  high: 0, strong: 0, uncertain: 0, weak: 1, autoAdded: 0, lastUpdated: "2m ago" },
  locations:     { pending: 2,  high: 1, strong: 0, uncertain: 0, weak: 1, autoAdded: 1, lastUpdated: "2m ago" },
  items:         { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  classes:       { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  races:         { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  stats:         { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  abilities:     { pending: 1,  high: 1, strong: 0, uncertain: 0, weak: 0, autoAdded: 1, lastUpdated: "2m ago" },
  skillTrees:    { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
  quests:        { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "yest." },
  events:        { pending: 1,  high: 0, strong: 0, uncertain: 1, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  factions:      { pending: 1,  high: 0, strong: 0, uncertain: 1, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  lore:          { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  relationships: { pending: 1,  high: 0, strong: 1, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "2m ago" },
  timeline:      { pending: 1,  high: 1, strong: 0, uncertain: 0, weak: 0, autoAdded: 1, lastUpdated: "2m ago" },
  references:    { pending: 0,  high: 0, strong: 0, uncertain: 0, weak: 0, autoAdded: 0, lastUpdated: "—" },
};

// ---------------------------------------------------------------------
// __SHAPES__ (for Claude Code hookup — duplicated in handoff notes)
// ---------------------------------------------------------------------
//
// QueueItem {
//   id: string,
//   entityType: keyof ENTITY_TYPES,
//   confidence: { band: "high"|"strong"|"uncertain"|"weak", value: number /* 0-100 */ },
//   status: "pending"|"auto-added"|"accepted"|"edited"|"merged"|"denied"|"needs-attention",
//   suggestion: "create"|"enrich"|"link"|"merge"|"update state",
//   candidate: { name: string, aliases: string[], summary: string },
//   mention: string,                  // raw extracted span
//   sourceChapter: { id, num, title },
//   sourceParagraph: string,          // anchor id
//   matched: null | { id, name, confidence },
//   conflict: null | { kind, note },
//   rationale: string,                // "why detected"
//   sessionId: string,
//   extractedAt: string,
// }
//
// ExtractionSession {
//   id, chapterId, chapterLabel, mode: "quick"|"deep", privacy: "local"|"cloud"|"ai",
//   startedAt, completedAt, duration,
//   totals: { candidates, accepted, merged, denied, autoAdded, failed },
//   state: "running"|"complete"|"error"|"cancelled",
//   note, error?,
// }
//

Object.assign(window, {
  EXTRACTION_STAGES,
  MOCK_QUEUE_ITEMS,
  MOCK_SESSIONS,
  MOCK_AUTOADDED,
  MOCK_OVERVIEW_COUNTS,
});
