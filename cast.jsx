// =====================================================================
// cast.jsx — Cast panel body. Plugged into SlidingPanel/DockedPanel
// when entityType === "cast". Renders all cast UX modes:
//   - browse list (with filters, group-by, mention sparkline)
//   - detail (selected character: hero, identity, traits,
//     relationships, mention timeline, quotes)
//   - multi-select (bulk merge / tag / delete)
//   - edit form
//   - review queue (extraction-detected cast suggestions)
//   - suggestion strip
//   - empty / loading / error
// =====================================================================

const { useState: _us_cast, useMemo: _um_cast, useCallback: _uc_cast } = React;

// ---------------------------------------------------------------------
// Sample cast records — used only when panel.cast is undefined so the
// panel has something rich to show on first paint. App can override by
// setting panel.cast = [...].
// ---------------------------------------------------------------------
const CAST_SAMPLE = [
  {
    id: "c1", name: "Aelinor Vey", initials: "AV",
    role: "protagonist", status: "alive", queue: 0,
    title: "Queen of the Pale Reach",
    epithet: "the small dark queen of the Pale Reach",
    affiliation: "House Vey", origin: "Pale Reach",
    firstSeen: "Ch. 1, p. 12", lastSeen: "Ch. 7, p. 188",
    chapterRange: "Ch. 1–7",
    age: "twenty-nine winters", pronouns: "she/her",
    traits: [
      { label: "watchful", tone: "positive" },
      { label: "patient", tone: "positive" },
      { label: "secret-keeping", tone: "negative" },
      { label: "dry-witted" },
    ],
    relationships: [
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "rival", strength: 4 },
      { id: "c3", name: "Captain Brec", initials: "CB", kind: "loyal-to", strength: 3 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister-in-law", strength: 2 },
    ],
    mentionsByChapter: [12, 8, 4, 7, 3, 9, 14, 6, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "She had learned to wait. Pale Reach taught patience the way the sea taught salt.", cite: "Ch. 1, p. 14" },
      { text: "\"Bring me the auger,\" Aelinor said, \"and the man who carries it.\"", cite: "Ch. 7, p. 188" },
    ],
    summary: "Reigning queen of the Pale Reach. Inherits the Auger crisis from her father; opens negotiations with House Hess in Ch. 3 and breaks them in Ch. 7.",
    stats: [
      { k: "Resolve",   v: 9, max: 10 },
      { k: "Cunning",   v: 8, max: 10 },
      { k: "Compassion",v: 5, max: 10 },
      { k: "Martial",   v: 4, max: 10 },
    ],
    abilities: [
      { name: "Court tongue", desc: "Reads a room before a room knows it is read.", source: "Established Ch. 1" },
      { name: "Salt-bearing", desc: "Endures the Reach's winter without complaint.", source: "Implied Ch. 2" },
      { name: "Letter-locking", desc: "Can fold a paper such that no eye but the recipient's may open it whole.", source: "Ch. 5" },
    ],
    skillTree: {
      branches: [
        { name: "Diplomacy",  nodes: [
          { name: "Listen",       state: "mastered" },
          { name: "Hold the floor",state: "mastered" },
          { name: "Bind a treaty",state: "earned"   },
          { name: "Break a treaty",state: "emerging"},
        ]},
        { name: "Statecraft", nodes: [
          { name: "Read the ledger", state: "mastered" },
          { name: "Spend the granary",state: "earned" },
          { name: "Coin a new house", state: "locked" },
        ]},
      ],
    },
    inventory: [
      { name: "The Vey signet",     kind: "regalia",  notable: true,  note: "Worn since the coronation. Unbroken." },
      { name: "Father's bone-knife",kind: "weapon",   notable: true,  note: "Carried since Ch. 1. Drawn once, in Ch. 7." },
      { name: "Saren's first letter",kind: "document", notable: false, note: "Kept in the inner desk." },
      { name: "Salt cloak",          kind: "garment",  notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a1", label: "Pale Reach" }, { id: "a2", label: "Vraska Pass" }],
    relatedTimeline: [{ id: "t2", label: "Brec's letter" }],
  },
  {
    id: "c2", name: "Saren of Hess", initials: "SH",
    role: "antagonist", status: "alive", queue: 1,
    title: "Heir of Hess",
    epithet: "all teeth and tallow-smile",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 3, p. 67", lastSeen: "Ch. 7, p. 192",
    chapterRange: "Ch. 3–7",
    age: "thirty-four", pronouns: "he/him",
    traits: [
      { label: "ambitious", tone: "negative" },
      { label: "well-spoken", tone: "positive" },
      { label: "resentful", tone: "negative" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "rival", strength: 4 },
      { id: "c5", name: "Mara of Hess", initials: "MH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 6, 11, 5, 8, 9, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "\"The Reach has had its years,\" he told the auger. \"Now Hess takes the next.\"", cite: "Ch. 4, p. 102" },
    ],
    summary: "Heir to House Hess; gambit-runner. Suspected source of the leaked auger letters in Ch. 6.",
    stats: [
      { k: "Resolve",   v: 6, max: 10 },
      { k: "Cunning",   v: 9, max: 10 },
      { k: "Compassion",v: 2, max: 10 },
      { k: "Martial",   v: 7, max: 10 },
    ],
    abilities: [
      { name: "Tallow-smile", desc: "Disarms a stranger inside three sentences.", source: "Ch. 3" },
      { name: "Letter-cracking", desc: "Opens what was meant to be sealed; leaves no obvious mark.", source: "Ch. 6" },
    ],
    skillTree: {
      branches: [
        { name: "Court", nodes: [
          { name: "Charm",     state: "mastered" },
          { name: "Goad",      state: "mastered" },
          { name: "Conspire",  state: "earned" },
        ]},
        { name: "Blade", nodes: [
          { name: "Train",     state: "earned" },
          { name: "Best a peer",state: "emerging" },
        ]},
      ],
    },
    inventory: [
      { name: "Hess sigil-ring", kind: "regalia", notable: true, note: "Twin to Mara's." },
      { name: "Pale Reach map",  kind: "document", notable: true, note: "Annotated. How did he come by it?" },
      { name: "Slim dagger",      kind: "weapon", notable: false, note: null },
    ],
    relatedAtlas: [{ id: "a3", label: "Hess" }],
    relatedTimeline: [],
  },
  {
    id: "c3", name: "Captain Brec", initials: "CB",
    role: "supporting", status: "alive", queue: 0,
    title: "Captain of the Reach Watch",
    epithet: "broad as a barn-door, soft as wet rope",
    affiliation: "Pale Reach", origin: "Vraska Pass",
    firstSeen: "Ch. 2, p. 41", lastSeen: "Ch. 5, p. 144",
    chapterRange: "Ch. 2–5",
    age: "forty-one", pronouns: "he/him",
    traits: [
      { label: "loyal", tone: "positive" },
      { label: "homesick", tone: "negative" },
      { label: "blunt", tone: "positive" },
    ],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sworn-to", strength: 4 },
    ],
    mentionsByChapter: [0, 4, 6, 5, 7, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "Brec said nothing for a long while. Then: \"I'll go. I won't like it.\"", cite: "Ch. 5, p. 144" },
    ],
    summary: "Captain of the Reach Watch; Aelinor's right hand. Carries the Ch. 5 letter to Hess at personal cost.",
  },
  {
    id: "c4", name: "The Auger", initials: "TA",
    role: "minor", status: "unknown", queue: 0,
    title: null,
    epithet: "the man who reads the bone",
    affiliation: null, origin: null,
    firstSeen: "Ch. 7, p. 184", lastSeen: "Ch. 7, p. 199",
    chapterRange: "Ch. 7",
    age: "uncertain", pronouns: "they/them",
    traits: [{ label: "ominous" }, { label: "ambiguous" }],
    relationships: [],
    mentionsByChapter: [0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [
      { text: "The auger did not look at the queen. The auger did not look at anything one could name.", cite: "Ch. 7, p. 186" },
    ],
    summary: "Bone-reader summoned in Ch. 7. Identity, faction, and motive all unconfirmed.",
  },
  {
    id: "c5", name: "Mara of Hess", initials: "MH",
    role: "supporting", status: "alive", queue: 0,
    title: "Lady of the Hess",
    epithet: "kinder than her brother by half",
    affiliation: "House Hess", origin: "Hess",
    firstSeen: "Ch. 4, p. 91", lastSeen: "Ch. 4, p. 96",
    chapterRange: "Ch. 4",
    age: "twenty-six", pronouns: "she/her",
    traits: [{ label: "warm", tone: "positive" }, { label: "torn" }],
    relationships: [
      { id: "c1", name: "Aelinor Vey", initials: "AV", kind: "sister-in-law", strength: 2 },
      { id: "c2", name: "Saren of Hess", initials: "SH", kind: "sister", strength: 3 },
    ],
    mentionsByChapter: [0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [],
    summary: "Saren's younger sister. Possible bridge between the Houses; underused so far.",
  },
  {
    id: "c6", name: "Dav the Quiet", initials: "DQ",
    role: "minor", status: "dead", queue: 1,
    title: null,
    epithet: "the boy who carried letters",
    affiliation: "Pale Reach", origin: "Reach docks",
    firstSeen: "Ch. 6, p. 162", lastSeen: "Ch. 6, p. 171",
    chapterRange: "Ch. 6",
    age: "fifteen", pronouns: "he/him",
    traits: [{ label: "small" }, { label: "watchful", tone: "positive" }],
    relationships: [{ id: "c3", name: "Captain Brec", initials: "CB", kind: "ward-of", strength: 2 }],
    mentionsByChapter: [0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0],
    currentChapter: 7,
    quotes: [{ text: "Dav the Quiet was found at the dock-foot, the letter still in his collar.", cite: "Ch. 6, p. 171" }],
    summary: "Letter-runner. Killed in Ch. 6; the letter triggers Brec's ride.",
  },
];

// Suggestion items (extraction-detected cast not yet confirmed)
const CAST_SUGGESTIONS_SAMPLE = [
  { id: "s1", name: "The Auger of Hess", level: "uncertain", value: 61,
    excerpt: "She remembered now — the boy had spoken of <mark>the Auger of Hess</mark>, his eyes wide as plates.",
    cite: "Ch. 7, p. 191", reason: "Compound-name match with existing 'The Auger'. Possible merge." },
  { id: "s2", name: "Sister Vell", level: "strong", value: 84,
    excerpt: "<mark>Sister Vell</mark> brought tea and waited, hands folded in the way of the Order.",
    cite: "Ch. 5, p. 138", reason: "New named figure; appears once but addressed by title." },
  { id: "s3", name: "the bone-cutter", level: "weak", value: 31,
    excerpt: "Brec had once known <mark>the bone-cutter</mark> from his Vraska days, a man of small jokes.",
    cite: "Ch. 5, p. 142", reason: "Definite article + role; may be a referent rather than a person." },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const ROLE_ORDER = ["protagonist", "antagonist", "supporting", "minor"];
const ROLE_LABEL = {
  protagonist: "Protagonist",
  antagonist:  "Antagonist",
  supporting:  "Supporting",
  minor:       "Minor",
};
const REL_KIND_LABEL = {
  "rival":         "Rival",
  "loyal-to":      "Loyal to",
  "sworn-to":      "Sworn to",
  "sister":        "Sister",
  "sister-in-law": "Sister-in-law",
  "ward-of":       "Ward of",
  "family":        "Family",
  "lover":         "Lover",
  "ally":          "Ally",
  "mentor":        "Mentor",
  "enemy":         "Enemy",
};

// =====================================================================
// Live cast → dossier adapter
//
// A persisted cast entity from EntityService is shaped:
//   { id, name, type, glyphChar, status, data: { role, summary, personality,
//     stats, abilities, family, allies, ..., inventory, equippedItems, ... } }
// CastBrowse + CastDetail render a flatter dossier shape with `initials`,
// per-chapter `mentionsByChapter`, resolved `relationships`, etc. This
// adapter maps one live entity → dossier shape, deriving per-chapter
// mentions / quotes from OccurrenceService and resolving related-entity
// pickers into actual names + initials through the precomputed index.
// =====================================================================

const _castInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase() || "?";
};

const _CAST_ROLE_NORM = {
  protagonist: "protagonist", antagonist: "antagonist", supporting: "supporting", minor: "minor",
  hero: "protagonist", pov: "protagonist", central: "protagonist",
  villain: "antagonist", foil: "supporting", ally: "supporting", "supporting-cast": "supporting",
  "walk-on": "minor", background: "minor",
};
const _normCastRole = (role) => _CAST_ROLE_NORM[String(role || "").toLowerCase()] || (role ? "supporting" : "minor");

const _castEntityStatus = (e) => {
  const s = String((e && e.data && e.data.status) || (e && e.status) || "").toLowerCase();
  if (s === "deceased" || s === "dead") return "dead";
  if (s === "missing") return "missing";
  if (s === "unknown" || s === "draft") return "unknown";
  return "alive";
};

// Resolve related / related-multi values. Picker stores `{id,name,type}`,
// but older flows may store bare ids — handle both. Returns `[{id,name,type,_entity}]`.
const _resolveRelatedList = (raw, entityIndex) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of arr) {
    const id = typeof v === "string" ? v : (v && v.id) || null;
    const ent = id ? entityIndex.get(id) : null;
    const name = (v && typeof v === "object" && v.name) || ent?.name || (id ? "Unknown" : null);
    if (!name) continue;
    const type = (v && typeof v === "object" && v.type) || ent?.type || null;
    out.push({ id, name, type, _entity: ent || null });
  }
  return out;
};

// Build the per-render context once for a batch of dossiers — keeps
// occurrence + entity lookups O(n) instead of O(n²).
const buildCastDossierContext = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ctx = { occByEntity: new Map(), chapters: [], chapterIndex: new Map(), activeChapterId: null, entityIndex: new Map() };
  if (!B) return ctx;
  try {
    const all = B.EntityService?.listAllSync?.() || {};
    for (const byId of Object.values(all)) {
      for (const ent of Object.values(byId || {})) {
        if (ent && ent.id) ctx.entityIndex.set(ent.id, ent);
      }
    }
  } catch (_e) {}
  try {
    const occs = B.OccurrenceService?.listAllSync?.() || [];
    for (const o of occs) {
      if (!o || !o.entityId) continue;
      const list = ctx.occByEntity.get(o.entityId) || [];
      list.push(o);
      ctx.occByEntity.set(o.entityId, list);
    }
  } catch (_e) {}
  try {
    const state = B.ManuscriptChapterService?.loadSync?.() || {};
    ctx.chapters = (state.chapters || []).filter((c) => !c.reserved);
    ctx.chapters.forEach((c, i) => ctx.chapterIndex.set(c.id, { index: i, num: c.num || (i + 1), title: c.title || "", id: c.id }));
    ctx.activeChapterId = state.activeChapterId || null;
  } catch (_e) {}
  return ctx;
};

// Map of related-multi field id → human-facing relationship kind. Order matters:
// a person listed in `family` ranks ahead of the same id in `allies`.
const _CAST_REL_FIELDS = [
  ["family",  "family"],
  ["lovers",  "lover"],
  ["allies",  "ally"],
  ["mentors", "mentor"],
  ["rivals",  "rival"],
  ["enemies", "enemy"],
];

const liveCastToDossier = (entity, ctx = {}) => {
  if (!entity) return null;
  const d = entity.data || {};
  const chapterIndex = ctx.chapterIndex || new Map();
  const chapters = ctx.chapters || [];
  const entityIndex = ctx.entityIndex || new Map();

  // Sort this character's occurrences by chapter order, then offset.
  const myOccs = ((ctx.occByEntity && ctx.occByEntity.get(entity.id)) || [])
    .slice()
    .sort((a, b) => {
      const ai = chapterIndex.get(a.chapterId)?.index ?? 9999;
      const bi = chapterIndex.get(b.chapterId)?.index ?? 9999;
      if (ai !== bi) return ai - bi;
      return (a.startOffset || 0) - (b.startOffset || 0);
    });

  // Per-chapter mention counts + first/last seen + chapter range — derived
  // live from occurrences whenever the manuscript has any.
  let mentionsByChapter = null;
  let firstSeen = d.firstAppearance || "";
  let lastSeen  = d.lastAppearance || "";
  let chapterRange = "";
  if (chapters.length && myOccs.length) {
    mentionsByChapter = new Array(chapters.length).fill(0);
    for (const o of myOccs) {
      const ix = chapterIndex.get(o.chapterId);
      if (ix) mentionsByChapter[ix.index] = (mentionsByChapter[ix.index] || 0) + 1;
    }
    const f = chapterIndex.get(myOccs[0].chapterId);
    const l = chapterIndex.get(myOccs[myOccs.length - 1].chapterId);
    if (f) firstSeen = "Ch. " + f.num;
    if (l) lastSeen  = "Ch. " + l.num;
    if (f && l) chapterRange = f.num === l.num ? ("Ch. " + f.num) : ("Ch. " + f.num + "–" + l.num);
  }
  const currentChapter = (ctx.activeChapterId && chapterIndex.get(ctx.activeChapterId)?.num)
    || (mentionsByChapter ? mentionsByChapter.length : null);

  // Quotes from occurrences (exact text + chapter cite).
  const quoteFor = (o) => ({
    text: String(o.exactText || "").trim(),
    cite: "Ch. " + (chapterIndex.get(o.chapterId)?.num ?? "?"),
    chapterId: o.chapterId,
    occurrenceId: o.occurrenceId,
  });
  const allQuotes = myOccs.map(quoteFor).filter((q) => q.text);
  const quotes = allQuotes.slice(0, 3);

  // Identity / faction / location lookups via the entity index.
  const faction = _resolveRelatedList(d.faction, entityIndex)[0] || null;
  const home    = _resolveRelatedList(d.homeLocation, entityIndex)[0] || null;
  const cur     = _resolveRelatedList(d.currentLocation, entityIndex)[0] || null;
  const aliasList = Array.isArray(d.aliases) ? d.aliases.map((a) => typeof a === "string" ? a : (a && (a.name || a.label || a.id))).filter(Boolean) : [];

  // Traits — strengths(+) ∪ flaws(–) ∪ distinguishing marks ∪ tags.
  const traits = [];
  const pushChips = (v, tone) => {
    if (!v) return;
    const arr = Array.isArray(v) ? v : (typeof v === "string" ? v.split(/[,;]+/) : []);
    for (const x of arr) {
      const lbl = typeof x === "string" ? x.trim() : (x && (x.label || x.name));
      if (lbl) traits.push(tone ? { label: lbl, tone } : { label: lbl });
    }
  };
  pushChips(d.strengths, "positive");
  pushChips(d.flaws, "negative");
  pushChips(d.distinguishingMarks);
  pushChips(d.tags);

  // Relationships — gather from each related-multi field, dedupe.
  const relationships = [];
  const seenRel = new Set();
  for (const [fieldId, kind] of _CAST_REL_FIELDS) {
    for (const r of _resolveRelatedList(d[fieldId], entityIndex)) {
      if (!r.id || seenRel.has(r.id)) continue;
      seenRel.add(r.id);
      relationships.push({
        id: r.id,
        name: r.name,
        initials: r._entity?.glyphChar || _castInitials(r.name),
        kind,
        strength: 2,
      });
    }
  }

  // Stats — data.stats persisted as [{name,value,min,max}] by EEStatGrid.
  const stats = (Array.isArray(d.stats) ? d.stats : []).map((s) => ({
    k:   s.name || s.k || "Stat",
    v:   typeof s.value === "number" ? s.value : (typeof s.v === "number" ? s.v : 0),
    max: typeof s.max === "number" && s.max > 0 ? s.max : 10,
  })).filter((s) => s.k);

  // Abilities — chips of strings (or richer objects when seeded that way).
  const abilities = (Array.isArray(d.abilities) ? d.abilities : []).map((a) => {
    if (typeof a === "string") return { name: a, desc: "", source: "" };
    if (a && typeof a === "object") return { name: a.name || a.label || "Ability", desc: a.desc || a.description || "", source: a.source || a.cite || "" };
    return null;
  }).filter(Boolean);

  // Inventory — resolve linked items, attach kind/notable/note from the item entity.
  const inventoryRaw = [
    ..._resolveRelatedList(d.inventory, entityIndex),
    ..._resolveRelatedList(d.equippedItems, entityIndex),
  ];
  const invSeen = new Set();
  const inventory = inventoryRaw.filter((it) => { if (!it.id || invSeen.has(it.id)) return false; invSeen.add(it.id); return true; }).map((it) => {
    const dd = (it._entity && it._entity.data) || {};
    return {
      id: it.id,
      name: it.name,
      kind: dd.kind || dd.itemType || "item",
      notable: !!dd.notable || dd.rarity === "unique" || dd.rarity === "legendary",
      note: dd.note || dd.notes || "",
    };
  });

  // Equipped items keyed by slot id (when the item carries data.slot).
  const equippedBySlot = {};
  for (const it of _resolveRelatedList(d.equippedItems, entityIndex)) {
    const dd = (it._entity && it._entity.data) || {};
    const slot = dd.slot || dd.equipSlot || null;
    if (!slot) continue;
    equippedBySlot[slot] = {
      name: it.name,
      itemId: it.id,
      condition: dd.condition || "",
      chapter: null,
      warning: dd.warning || "",
    };
  }

  // Related-tab links: locations → Atlas, timeline events → Timeline.
  const relatedAtlas = [];
  const pushLoc = (loc) => { if (loc && loc.id && !relatedAtlas.some((r) => r.id === loc.id)) relatedAtlas.push({ id: loc.id, label: loc.name }); };
  pushLoc(home); pushLoc(cur);
  for (const loc of _resolveRelatedList(d.travelHistory, entityIndex)) pushLoc(loc);
  const relatedTimeline = _resolveRelatedList(d.timelineEvents, entityIndex).map((e) => ({ id: e.id, label: e.name }));

  return {
    id: entity.id,
    name: entity.name,
    initials: entity.glyphChar || _castInitials(entity.name),
    role: _normCastRole(d.role),
    status: _castEntityStatus(entity),
    queue: entity.reviewQueueCount || 0,
    title: d.title || "",
    epithet: aliasList[0] || d.epithet || "",
    aliases: aliasList,
    affiliation: faction?.name || d.affiliation || "",
    origin: home?.name || cur?.name || d.origin || "",
    currentLocation: cur?.name || "",
    age: d.age || d.ageRange || "",
    pronouns: d.pronouns || "",
    summary: d.summary || d.description || "",
    arcSummary: d.arcSummary || "",
    backstory: d.backstory || "",
    personality: d.personality || "",
    voiceProfile: d.voiceProfile || "",
    speechStyle: d.speechStyle || "",
    goals: Array.isArray(d.goals) ? d.goals : [],
    fears: Array.isArray(d.fears) ? d.fears : [],
    writingInstructions: d.writingInstructions || "",
    traits,
    relationships,
    mentionsByChapter,
    currentChapter,
    chapterRange,
    firstSeen,
    lastSeen,
    quotes,
    _allQuotes: allQuotes,
    stats,
    abilities,
    skillTree: d.skillTree || null,
    inventory,
    equippedBySlot,
    relatedAtlas,
    relatedTimeline,
    _entity: entity,
  };
};

// Sparkline (12 chapters)
const CastSpark = ({ data, current }) => {
  const max = Math.max(1, ...data);
  return (
    <div className="cast-row__spark" aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className="cast-row__spark__bar"
          style={{ height: Math.max(2, (v / max) * 14) + "px", opacity: v === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastRow — single character row in the browse list
// ---------------------------------------------------------------------
const CastRow = ({ c, isSelected, isMulti, multiMode, onSelect, onToggleMulti }) => {
  const onClick = (e) => {
    if (multiMode) { onToggleMulti && onToggleMulti(c); return; }
    if (e.metaKey || e.ctrlKey) { onToggleMulti && onToggleMulti(c, true); return; }
    onSelect && onSelect(c);
  };
  return (
    <div
      className={"cast-row" + (isSelected ? " is-selected" : "") + (isMulti ? " is-multi" : "")}
      data-ui="CastRow"
      data-cast-id={c.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      <div className="cast-row__check" aria-hidden>{isMulti && <Icon name="check" size={10}/>}</div>
      <div className={"cast-row__monogram" + (c.status === "unknown" ? " cast-row__monogram--unknown" : "")}>
        {c.initials || "?"}
        <span className={"cast-row__monogram__status cast-row__monogram__status--" + c.status}/>
      </div>
      <div className="cast-row__identity">
        <span className="cast-row__name">{c.name}</span>
        <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role] || c.role}</span>
      </div>
      <div className="cast-row__subline">{c.epithet || c.title || c.summary}</div>
      <div className="cast-row__meta">
        <span className="cast-row__chapters">{c.chapterRange}</span>
        <CastSpark data={c.mentionsByChapter || []} current={c.currentChapter}/>
        <div className="cast-row__badges">
          {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastBrowse — the list with filters + group-by-role + multi-select bar
// ---------------------------------------------------------------------
const CastBrowse = ({ cast, suggestions = [], selectedId, multiSelected, multiMode, onSelect, onToggleMulti, onClearMulti, onMergeMulti, onTagMulti, onDeleteMulti, onCreate, onEnterMultiMode }) => {
  const [statusFilter, setStatusFilter] = _us_cast("all"); // all | alive | dead | missing | unknown
  const [groupBy, setGroupBy] = _us_cast("role"); // role | none | status

  const filtered = _um_cast(() => {
    if (statusFilter === "all") return cast;
    return cast.filter((c) => c.status === statusFilter);
  }, [cast, statusFilter]);

  const grouped = _um_cast(() => {
    if (groupBy === "none") return [{ key: "all", label: null, items: filtered }];
    if (groupBy === "status") {
      const order = ["alive", "missing", "unknown", "dead"];
      const lbl = { alive: "Living", missing: "Missing", unknown: "Unconfirmed", dead: "Dead" };
      return order.map((k) => ({ key: k, label: lbl[k], items: filtered.filter((c) => c.status === k) }))
                  .filter((g) => g.items.length);
    }
    return ROLE_ORDER.map((r) => ({ key: r, label: ROLE_LABEL[r], items: filtered.filter((c) => c.role === r) }))
                     .filter((g) => g.items.length);
  }, [filtered, groupBy]);

  // Pending cast candidates live in the central extractions review queue —
  // surface a count chip that opens it scoped to Cast.
  const pendingReviewCount = _um_cast(() => {
    try {
      const RS = window.LoomwrightBackend?.ReviewService;
      return RS ? RS.listSync("cast").filter((q) => q.status === "pending").length : 0;
    } catch (_) { return 0; }
  }, [cast]);
  const openReviewQueueForCast = () => {
    try {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review", entityType: "cast" } }));
    } catch (_) {}
  };

  return (
    <div className={"cast" + (multiMode ? " is-multi-mode" : "")}>
      {pendingReviewCount > 0 && (
        <div className="cast__review-cta" data-ui="CastReviewCta"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", margin: "0 0 var(--sp-3)", border: "1px solid var(--line, #e3dac6)", borderRadius: 8, background: "rgba(46,95,168,0.04)", fontSize: 12 }}>
          <Icon name="bell" size={11}/>
          <span style={{ flex: 1 }}>
            <strong>{pendingReviewCount}</strong> cast candidate{pendingReviewCount === 1 ? "" : "s"} pending in the extractions review queue.
          </span>
          <Btn variant="outline" size="sm" icon="arrow-right" onClick={openReviewQueueForCast}>Open review queue</Btn>
        </div>
      )}

      {/* Filter bar */}
      <div className="cast__filterbar">
        <span className="cast__filterbar__lbl">Status</span>
        {["all", "alive", "missing", "unknown", "dead"].map((s) => (
          <button key={s}
            className={"cast__filter-chip" + (statusFilter === s ? " is-active" : "")}
            onClick={() => setStatusFilter(s)}
          >{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>
        ))}
        <span style={{ flex: 1 }}/>
        <span className="cast__filterbar__lbl">Group</span>
        {[["role","Role"], ["status","Status"], ["none","Flat"]].map(([k, l]) => (
          <button key={k}
            className={"cast__filter-chip" + (groupBy === k ? " is-active" : "")}
            onClick={() => setGroupBy(k)}
          >{l}</button>
        ))}
      </div>

      {/* Groups & rows */}
      {grouped.map((g) => (
        <div key={g.key}>
          {g.label && (
            <div className="cast__group-label">
              <span>{g.label}</span>
              <span className="cast__group-label__count">{g.items.length}</span>
              <span className="cast__group-label__rule"/>
            </div>
          )}
          <div className="cast__list">
            {g.items.map((c) => (
              <CastRow key={c.id} c={c}
                isSelected={c.id === selectedId}
                isMulti={multiSelected && multiSelected.has(c.id)}
                multiMode={multiMode}
                onSelect={onSelect}
                onToggleMulti={(c, enterMulti) => {
                  if (enterMulti && !multiMode) onEnterMultiMode && onEnterMultiMode();
                  onToggleMulti && onToggleMulti(c);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Multi-select sticky action bar */}
      {multiMode && multiSelected && multiSelected.size > 0 && (
        <div className="cast-multibar" data-ui="CastMultiBar">
          <div className="cast-multibar__count"><strong>{multiSelected.size}</strong> selected</div>
          <Btn variant="outline" size="sm" icon="link" onClick={onMergeMulti} data-callback="onMergeEntity">Merge</Btn>
          <Btn variant="outline" size="sm" icon="bookmark" onClick={onTagMulti} data-callback="onTagEntities">Tag</Btn>
          <Btn variant="ghost" size="sm" icon="trash" onClick={onDeleteMulti} data-callback="onDeleteEntities">Delete</Btn>
          <Btn variant="ghost" size="sm" icon="close" onClick={onClearMulti} title="Cancel multi-select"/>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// CastDetail — selected character page
// ---------------------------------------------------------------------
// Cite parser: pulls a chapter number out of strings like "Ch. 7" / "Ch. 1, p. 12".
const _citeToChapterNum = (cite) => {
  if (!cite) return null;
  const m = String(cite).match(/Ch\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};

const CastDetail = ({
  c, chapters, onBack, onEdit,
  onAddTrait, onAddRelationship, onAddAbility, onEditStats, onCastMore,
  onJumpManuscript, onJumpQuote, onShowAllQuotes, showAllQuotes,
  onSelectRelated, onOpenSkillTree, onOpenAtlasFor, onOpenTimelineFor,
}) => {
  if (!c) return null;
  const totalChapters = (chapters && chapters.length) || (c.mentionsByChapter ? c.mentionsByChapter.length : 0);
  // Chapter scrubber: 1..totalChapters. Defaults to "now" (last chapter).
  const [scrub, setScrub] = _us_cast(totalChapters || 1);
  React.useEffect(() => { setScrub(totalChapters || 1); }, [c.id, totalChapters]);
  const atEnd = !totalChapters || scrub === totalChapters;

  // Mentions chart filtered to scrubbed chapter (later chapters dim out).
  const mentionsForChart = c.mentionsByChapter ? c.mentionsByChapter.map((v, i) => (i + 1 <= scrub ? v : 0)) : null;
  const totalMentions = (c.mentionsByChapter || []).reduce((a, b) => a + b, 0);

  // Quotes filtered to scrubbed chapter, with optional "show all" expansion.
  const allQuotes = c._allQuotes || c.quotes || [];
  const scrubbedQuotes = allQuotes.filter((q) => {
    const n = _citeToChapterNum(q.cite);
    return n == null || n <= scrub;
  });
  const visibleQuotes = showAllQuotes ? scrubbedQuotes : scrubbedQuotes.slice(0, 3);

  return (
    <div className="cast cast-detail" data-ui="CastDetail" data-cast-id={c.id}>
      <button className="cast-detail__back" onClick={onBack}>
        <Icon name="close" size={9}/> Back to all cast
      </button>

      {/* Hero */}
      <div className="cast-detail__hero">
        <div className="cast-detail__portrait">{c.initials}</div>
        <div className="cast-detail__hero__body">
          <div className="cast-detail__name">{c.name}</div>
          <div className="cast-detail__title-line">{c.epithet || c.title}</div>
          <div className="cast-detail__meta-row">
            <span className={"cast-row__role cast-row__role--" + c.role}>{ROLE_LABEL[c.role]}</span>
            {c.chapterRange && <span className="chip chip--neutral">{c.chapterRange}</span>}
            <span className="chip chip--neutral">{totalMentions} mention{totalMentions === 1 ? "" : "s"}</span>
            {!atEnd && <span className="chip chip--neutral" data-testid="cast-scrub-state">As of Ch. {scrub}</span>}
            {c.queue ? <ReviewCountBadge count={c.queue}/> : null}
          </div>
        </div>
      </div>

      {/* Chapter scrubber — only when there's more than one chapter to scrub */}
      {totalChapters > 1 && (
        <div className="cast-section" data-ui="CastChapterScrubber">
          <div className="cast-section__head">
            <span className="cast-section__title">Chapter history</span>
            <span className="cast-section__hint" style={{ fontSize: 11, color: "var(--ink-4)" }}>
              Drag to see this character as of any chapter.
            </span>
            <span className="cast-section__action" style={{ pointerEvents: "none" }}>Ch. {scrub} / {totalChapters}</span>
          </div>
          <input
            type="range"
            min={1}
            max={totalChapters}
            value={scrub}
            data-testid="cast-scrubber"
            onChange={(e) => setScrub(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent, #9a7b3a)" }}
            aria-label={"Scrub through chapters for " + c.name}
          />
        </div>
      )}

      {/* Summary */}
      {c.summary && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Summary</span>
            <button className="cast-section__action" onClick={onEdit}>Edit</button>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
            {c.summary}
          </div>
        </div>
      )}

      {/* Arc */}
      {c.arcSummary && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Arc</span>
            <button className="cast-section__action" onClick={onEdit}>Edit</button>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.55 }}>
            {c.arcSummary}
          </div>
        </div>
      )}

      {/* Identity facts */}
      <div className="cast-section">
        <div className="cast-section__head">
          <span className="cast-section__title">Identity</span>
          <button className="cast-section__action" onClick={onEdit}>Edit</button>
        </div>
        <div className="cast-fields">
          {c.title       && (<><div className="cast-fields__k">Title</div><div className="cast-fields__v">{c.title}</div></>)}
          {c.affiliation && (<><div className="cast-fields__k">Affiliation</div><div className="cast-fields__v">{c.affiliation}</div></>)}
          {c.origin      && (<><div className="cast-fields__k">Origin</div><div className="cast-fields__v">{c.origin}</div></>)}
          {c.currentLocation && (<><div className="cast-fields__k">Currently</div><div className="cast-fields__v">{c.currentLocation}</div></>)}
          {c.age         && (<><div className="cast-fields__k">Age</div><div className="cast-fields__v">{c.age}</div></>)}
          {c.pronouns    && (<><div className="cast-fields__k">Pronouns</div><div className="cast-fields__v">{c.pronouns}</div></>)}
          {c.aliases?.length > 1 && (<><div className="cast-fields__k">Aliases</div><div className="cast-fields__v">{c.aliases.slice(1).join(", ")}</div></>)}
          {c.firstSeen && (<><div className="cast-fields__k">First seen</div><div className="cast-fields__v">{c.firstSeen}</div></>)}
          {c.lastSeen && (<><div className="cast-fields__k">Last seen</div><div className="cast-fields__v">{c.lastSeen}</div></>)}
        </div>
      </div>

      {/* Traits */}
      {c.traits && c.traits.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Traits</span>
            <button className="cast-section__action" onClick={onAddTrait}>+ Add</button>
          </div>
          <div className="cast-traits">
            {c.traits.map((t, i) => (
              <span key={i} className={"cast-trait" + (t.tone ? " cast-trait--" + t.tone : "")}>{t.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {c.relationships && c.relationships.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Relationships</span>
            <button className="cast-section__action" onClick={onAddRelationship}>+ Link</button>
          </div>
          <div className="cast-rels">
            {c.relationships.map((r) => (
              <button
                key={r.id}
                className="cast-rel"
                data-testid={"cast-rel-" + r.id}
                onClick={() => onSelectRelated && onSelectRelated(r)}
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "inherit" }}
                title={"Open " + r.name + "'s dossier"}
              >
                <div className="cast-rel__avatar">{r.initials}</div>
                <div className="cast-rel__lbl">
                  <span className="cast-rel__name">{r.name}</span>
                  <span className="cast-rel__kind">{REL_KIND_LABEL[r.kind] || r.kind}</span>
                </div>
                <div className="cast-rel__strength" title={"Strength " + r.strength + "/4"}>
                  {[1,2,3,4].map((i) => (
                    <span key={i} className={"cast-rel__strength__pip" + (i <= r.strength ? " is-on" : "")}/>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mention timeline (live, scrubber-aware) */}
      {mentionsForChart && totalMentions > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Mentions across the manuscript</span>
            <button className="cast-section__action" onClick={onJumpManuscript}>Jump to first</button>
          </div>
          <div className="cast-mentions">
            <div className="cast-mentions__strip">
              {mentionsForChart.map((v, i) => {
                const max = Math.max(1, ...mentionsForChart);
                const h = v === 0 ? 8 : Math.max(8, (v / max) * 28);
                return (
                  <div key={i}
                    className={"cast-mentions__bar" + (v === 0 ? " is-empty" : "") + ((i + 1) === scrub ? " is-current" : "")}
                    style={{ height: h + "px" }}
                    title={"Ch. " + (i + 1) + " — " + v + " mention" + (v === 1 ? "" : "s")}
                  />
                );
              })}
            </div>
            <div className="cast-mentions__axis">
              <span>Ch. 1</span>
              <span>Ch. {mentionsForChart.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quotes (live, scrubber-aware) */}
      {visibleQuotes.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Selected lines</span>
            {scrubbedQuotes.length > 3 && (
              <button className="cast-section__action" onClick={onShowAllQuotes}>
                {showAllQuotes ? "Show fewer" : "All (" + scrubbedQuotes.length + ")"}
              </button>
            )}
          </div>
          <div className="cast-quotes">
            {visibleQuotes.map((q, i) => (
              <button
                key={i}
                className="cast-quote"
                onClick={() => onJumpQuote && onJumpQuote(q)}
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "inherit", width: "100%" }}
                title="Jump to this line in the manuscript"
              >
                "{q.text}"
                <span className="cast-quote__cite">{q.cite}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {c.stats && c.stats.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Stats</span>
            <button className="cast-section__action" onClick={onEditStats}>Edit</button>
          </div>
          <CastStats stats={c.stats}/>
        </div>
      )}

      {/* Abilities */}
      {c.abilities && c.abilities.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Abilities</span>
            <button className="cast-section__action" onClick={onAddAbility}>+ Add</button>
          </div>
          <CastShowMore threshold={2}>
            {c.abilities.map((a, i) => (
              <CastAbilities key={i} items={[a]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Skill tree */}
      {c.skillTree && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Skill tree</span>
            <button className="cast-section__action" onClick={onOpenSkillTree}>Open full tree →</button>
          </div>
          <CastSkillTree tree={c.skillTree}/>
        </div>
      )}

      {/* Equipment Slots — live equippedBySlot from item.data.slot */}
      <div className="cast-section">
        <div className="cast-section__head">
          <span className="cast-section__title">Equipment</span>
          <span className="cast-section__hint" style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>Drag items here</span>
          <button className="cast-section__action"
            onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>
            Open in Items →
          </button>
        </div>
        <CastEquipmentSlots cast={c}/>
      </div>

      {/* Inventory */}
      {c.inventory && c.inventory.length > 0 && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Carried inventory</span>
            <button className="cast-section__action"
              onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>
              Open in Items →
            </button>
          </div>
          <CastShowMore threshold={3}>
            {c.inventory.map((it, i) => (
              <CastInventory key={i} items={[it]}/>
            ))}
          </CastShowMore>
        </div>
      )}

      {/* Open related tab links */}
      {((c.relatedAtlas && c.relatedAtlas.length) || (c.relatedTimeline && c.relatedTimeline.length)) && (
        <div className="cast-section">
          <div className="cast-section__head">
            <span className="cast-section__title">Open related tab</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.relatedAtlas && c.relatedAtlas.map((r) => (
              <Btn key={"a-"+r.id} variant="outline" size="sm" icon="map" onClick={() => onOpenAtlasFor && onOpenAtlasFor(r)}>{r.label} in Atlas →</Btn>
            ))}
            {c.relatedTimeline && c.relatedTimeline.map((r) => (
              <Btn key={"t-"+r.id} variant="outline" size="sm" icon="clock" onClick={() => onOpenTimelineFor && onOpenTimelineFor(r)}>{r.label} on Timeline →</Btn>
            ))}
          </div>
        </div>
      )}

      {/* Character brain / voice chat — BYOK with free-tier fallback */}
      <CastBrain c={c} scrubChapter={scrub}/>

      {/* Footer actions */}
      <div style={{ display: "flex", gap: 6, paddingTop: "var(--sp-4)", borderTop: "1px dashed var(--line-2)" }}>
        <Btn variant="primary" size="sm" icon="paper" onClick={onJumpManuscript}>Open in manuscript</Btn>
        <Btn variant="outline" size="sm" icon="link" data-callback="onLinkEntity">Link…</Btn>
        <Btn variant="ghost" size="sm" icon="more" onClick={onCastMore} title="More"/>
      </div>
    </div>
  );
};

// =====================================================================
// CastBrain — "Talk to character" chat. Builds an in-voice system prompt
// from the dossier (personality, voice, goals, fears, recent lines, project
// intel) and routes through AIService. Falls back to a configure-AI notice
// if no provider is available (Free tier needs a local provider like
// Ollama; BYOK needs an API key). Includes browser-native text-to-speech
// for the "voice" side.
// =====================================================================
const CastBrain = ({ c, scrubChapter }) => {
  const [messages, setMessages] = _us_cast([]);
  const [draft, setDraft] = _us_cast("");
  const [busy, setBusy] = _us_cast(false);
  const [error, setError] = _us_cast(null);

  React.useEffect(() => { setMessages([]); setError(null); }, [c.id]);

  const buildSystem = () => {
    const intel = (window.LoomwrightBackend?.ProjectIntelService?.loadSync?.()) || {};
    const lines = [
      "You are role-playing as the character below from a work-in-progress novel.",
      "Stay in voice. Reply in 1–3 short sentences. Do not break character or explain.",
      "If asked something your character couldn't know, deflect in voice.",
      "",
      "CHARACTER",
      "Name: " + c.name,
      c.title       && ("Title: " + c.title),
      c.epithet     && ("Epithet / alias: " + c.epithet),
      c.role        && ("Story role: " + c.role),
      c.personality && ("Personality: " + c.personality),
      c.voiceProfile && ("Voice: " + c.voiceProfile),
      c.speechStyle && ("Speech style: " + c.speechStyle),
      (c.goals && c.goals.length) && ("Goals: " + c.goals.join(", ")),
      (c.fears && c.fears.length) && ("Fears: " + c.fears.join(", ")),
      c.arcSummary  && ("Arc: " + c.arcSummary),
      c.writingInstructions && ("Author's instructions: " + c.writingInstructions),
      "State as of: Ch. " + (scrubChapter || "now"),
      "",
      intel.projectFoundation && "PROJECT",
      intel.projectFoundation && intel.projectFoundation.slice(0, 600),
      intel.writingStyleGuide && ("Style: " + String(intel.writingStyleGuide).slice(0, 400)),
    ].filter(Boolean);
    const quotes = (c._allQuotes || []).filter((q) => {
      const n = _citeToChapterNum(q.cite);
      return n == null || !scrubChapter || n <= scrubChapter;
    }).slice(0, 5);
    if (quotes.length) {
      lines.push("", "RECENT LINES (from the manuscript)");
      for (const q of quotes) lines.push('- "' + q.text + '" — ' + q.cite);
    }
    return lines.join("\n");
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setDraft("");
    setBusy(true);
    try {
      const B = window.LoomwrightBackend;
      if (!B || !B.AIService || !B.AIRoutingService) throw new Error("AI services unavailable");
      const routing = B.AIRoutingService;
      // Honour Local-only mode (hard block on external AI).
      if (routing.isLocalOnly && routing.isLocalOnly()) {
        setError("AI is disabled (Local-only mode). Enable a provider in Settings to chat with your characters.");
        setBusy(false);
        return;
      }
      const route = routing.resolveRoute ? routing.resolveRoute("characterChat") : null;
      if (!route || !route.providerId) {
        setError("Configure an AI provider in Settings to chat with your characters. Free tier needs a local provider (e.g. Ollama); BYOK needs an API key.");
        setBusy(false);
        return;
      }
      let cfg = null;
      try { cfg = await B.AIService.getProviderConfig(route.providerId); } catch (_e) {}
      if (!cfg || (cfg.needsKey && !cfg.apiKey)) {
        setError("Add an API key for this provider in Settings (or switch to a local provider for the Free tier).");
        setBusy(false);
        return;
      }
      const convo = messages.map((m) => (m.role === "user" ? "Reader: " : c.name + ": ") + m.text).join("\n");
      const prompt = (convo ? convo + "\n" : "") + "Reader: " + text + "\n" + c.name + ":";
      const reply = await B.AIService.complete({
        providerId: route.providerId,
        model: route.model || cfg.model,
        prompt,
        system: buildSystem(),
        purpose: "characterChat",
      });
      const clean = String(reply || "").trim();
      setMessages((m) => [...m, { role: "char", text: clean || "(silence)" }]);
    } catch (e) {
      setError("Couldn't reach the AI provider" + (e && e.message ? (" — " + e.message) : "") + ".");
    } finally {
      setBusy(false);
    }
  };

  const speak = (text) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96; u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (_e) {}
  };

  const styles = {
    section: { display: "flex", flexDirection: "column", gap: 8 },
    thread: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", padding: 8, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-3, 8px)" },
    hint: { fontSize: "var(--fs-xs)", color: "var(--ink-3)", fontStyle: "italic" },
    msg: (role) => ({ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: role === "user" ? "row-reverse" : "row" }),
    avatar: (role) => ({ width: 22, height: 22, borderRadius: 11, background: role === "user" ? "var(--accent-soft, #d8c89a)" : "var(--accent, #9a7b3a)", color: role === "user" ? "var(--ink-1)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flex: "0 0 auto" }),
    body: (role) => ({ flex: 1, fontSize: "var(--fs-sm)", background: role === "user" ? "var(--bg-elev, #fff)" : "var(--bg-tint, #f5eede)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.45 }),
    voice: { marginLeft: 8, fontSize: 10, color: "var(--ink-3)", background: "transparent", border: "1px solid var(--line-2)", borderRadius: 10, padding: "1px 6px", cursor: "pointer" },
    compose: { display: "flex", gap: 6, alignItems: "stretch" },
    input: { flex: 1, padding: "6px 10px", border: "1px solid var(--line-2)", borderRadius: "var(--r-2, 6px)", fontSize: "var(--fs-sm)", background: "var(--bg-elev, #fff)" },
    error: { fontSize: "var(--fs-xs)", color: "var(--danger, #c14e3e)", display: "flex", alignItems: "center", gap: 8 },
  };

  return (
    <div className="cast-section" data-ui="CastBrain" data-testid="cast-brain" style={styles.section}>
      <div className="cast-section__head">
        <span className="cast-section__title">Talk to {c.name}</span>
        <span className="cast-section__hint" style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>In-character chat · voice readback</span>
      </div>
      <div style={styles.thread} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div style={styles.hint}>
            Ask {c.name} about a scene, their motives, or a choice. They answer in voice, using their personality, voice profile, and recent lines from the manuscript.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={styles.msg(m.role)} data-msg-role={m.role}>
            <div style={styles.avatar(m.role)} aria-hidden>{m.role === "user" ? "You" : c.initials}</div>
            <div style={styles.body(m.role)}>
              {m.text}
              {m.role === "char" && typeof window !== "undefined" && window.speechSynthesis && (
                <button onClick={() => speak(m.text)} style={styles.voice} title="Read aloud" aria-label={"Read " + c.name + "'s reply aloud"}>▶ Voice</button>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div style={styles.msg("char")}>
            <div style={styles.avatar("char")} aria-hidden>{c.initials}</div>
            <div style={{ ...styles.body("char"), color: "var(--ink-3)" }}>thinking…</div>
          </div>
        )}
        {error && (
          <div style={styles.error} role="alert">
            <span>{error}</span>
            <Btn size="xs" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "settings" } }))}>Configure AI →</Btn>
          </div>
        )}
      </div>
      <div style={styles.compose}>
        <input
          type="text"
          style={styles.input}
          placeholder={"Ask " + c.name + " a question…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={busy}
          data-testid="cast-brain-input"
          aria-label={"Message " + c.name}
        />
        <Btn variant="primary" size="sm" icon="sparkle" onClick={send} disabled={busy || !draft.trim()} data-testid="cast-brain-send">Send</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastEdit — edit form for a character
// ---------------------------------------------------------------------
const CastEdit = ({ c, onCancel, onSave }) => {
  const [form, setForm] = _us_cast({
    name:        c?.name        || "",
    title:       c?.title       || "",
    epithet:     c?.epithet     || "",
    role:        c?.role        || "supporting",
    status:      c?.status      || "alive",
    affiliation: c?.affiliation || "",
    origin:      c?.origin      || "",
    pronouns:    c?.pronouns    || "",
    summary:     c?.summary     || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="cast cast-edit" data-ui="CastEdit">
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Name<span className="cast-edit__lbl__req">*</span></label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="As they appear in the manuscript"/>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Title</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Queen of the Pale Reach"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Pronouns</label>
          <input value={form.pronouns} onChange={(e) => set("pronouns", e.target.value)} placeholder="she/her"/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Epithet</label>
        <input value={form.epithet} onChange={(e) => set("epithet", e.target.value)} placeholder="A line that captures them"/>
        <span className="cast-edit__hint">Shown as the italic subline in lists.</span>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Role</label>
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="protagonist">Protagonist</option>
            <option value="antagonist">Antagonist</option>
            <option value="supporting">Supporting</option>
            <option value="minor">Minor</option>
          </select>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="alive">Alive</option>
            <option value="missing">Missing</option>
            <option value="unknown">Unconfirmed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
      </div>
      <div className="cast-edit__row">
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Affiliation</label>
          <input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="House, faction, order…"/>
        </div>
        <div className="cast-edit__field">
          <label className="cast-edit__lbl">Origin</label>
          <input value={form.origin} onChange={(e) => set("origin", e.target.value)}/>
        </div>
      </div>
      <div className="cast-edit__field">
        <label className="cast-edit__lbl">Summary</label>
        <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Two sentences. Who they are; what they want."/>
      </div>
      <div className="cast-edit__actions">
        <Btn variant="ghost" size="sm" onClick={onCancel} data-callback="onCancelEdit">Cancel</Btn>
        <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Save + Extract more</Btn>
        <Btn variant="primary" size="sm" onClick={() => onSave && onSave(form)} data-callback="onSave">Save</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CastEmpty — no cast at all yet
// ---------------------------------------------------------------------
const CastEmpty = ({ onCreate, onExtract }) => (
  <div className="cast-empty" data-ui="CastEmpty">
    <div className="cast-empty__seal">◐</div>
    <div className="cast-empty__title">No cast yet</div>
    <div className="cast-empty__body">Add the people who walk through your story — or run extraction over the manuscript and let Loomwright find them.</div>
    <div className="cast-empty__actions">
      <Btn variant="primary" size="sm" icon="plus" onClick={onCreate} data-callback="onCreateEntity">Add a character</Btn>
      <Btn variant="outline" size="sm" icon="sparkle" onClick={onExtract} data-callback="onExtractCast">Extract from manuscript</Btn>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// CastPanelBody — top-level dispatcher. Replaces the generic state
// switch when entityType === "cast".
// ---------------------------------------------------------------------
const _castNotice = (message) => {
  try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_e) {}
};

const CastPanelBody = ({ panel, onSelectEntity }) => {
  // Always render the LIVE store — never the CAST_SAMPLE demo. The decorator
  // sets panel.cast from EntityService; we re-listSync as a fallback.
  const liveEntities = (panel && Array.isArray(panel.cast))
    ? panel.cast
    : (window.LoomwrightBackend?.EntityService?.listSync("cast") || []);
  const incomingState = panel?.state || "overview";

  // Bump on entity / occurrence / manuscript / review events so derived
  // dossiers refresh in place (mentions, relationships, queue counts).
  const [storeVersion, setStoreVersion] = _us_cast(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated", "lw:occurrences-updated", "lw:review-queue-updated", "lw:set-active-chapter", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  // Live dossier list (browse + detail share one shape).
  const dossierCtx = _um_cast(() => buildCastDossierContext(), [storeVersion]);
  const dossierList = _um_cast(
    () => liveEntities.map((e) => liveCastToDossier(e, dossierCtx)).filter(Boolean),
    [liveEntities, dossierCtx]
  );

  // Local UI state.
  // Map legacy "review" / "suggestion" panel states to "overview" — those
  // states used to render cast-local triage lists, but all cast candidates
  // now live in the central extractions review queue. The dossier always
  // shows here; the review queue stays in its own panel.
  const _normalizeView = (s) => (s === "review" || s === "suggestion") ? "overview" : s;
  const [view, setView] = _us_cast(_normalizeView(incomingState)); // overview | selected | edit | empty | loading | error | multi
  const [selectedId, setSelectedId] = _us_cast(
    panel?.selected?.id
      || dossierList.find((c) => c.role === "protagonist")?.id
      || dossierList[0]?.id
      || null
  );
  const [multi, setMulti] = _us_cast(() => new Set());

  // Follow host-driven panel.state.
  React.useEffect(() => { setView(_normalizeView(incomingState)); }, [incomingState]);

  const selected = _um_cast(() => dossierList.find((c) => c.id === selectedId), [dossierList, selectedId]);

  const onSelect = (c) => {
    setSelectedId(c.id);
    setView("selected");
    onSelectEntity && onSelectEntity({ id: c.id, label: c.name, entityType: "cast" });
  };
  const onToggleMulti = (c) => {
    setMulti((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
      return n;
    });
    setView("multi");
  };

  // ----- Dossier action handlers (every button is wired live) ----------
  const openFullEditor = (id, sectionId) => {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: "cast", initial: { id }, mode: "full", sectionId: sectionId || undefined },
    }));
  };
  const onEditFromDossier   = () => selected && openFullEditor(selected.id);
  const onAddTrait          = () => selected && openFullEditor(selected.id, "psychology");
  const onAddRelationship   = () => selected && openFullEditor(selected.id, "relationships");
  const onAddAbility        = () => selected && openFullEditor(selected.id, "rpg");
  const onEditStats         = () => selected && openFullEditor(selected.id, "rpg");
  const onCastMore          = () => selected && openFullEditor(selected.id, "review-save");

  const onJumpToOccurrence = (chapterId, occurrenceId) => {
    if (!chapterId) { _castNotice("This character has no manuscript mentions yet."); return; }
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room", chapterId, occurrenceId } }));
    window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId, occurrenceId } }));
  };
  const onJumpManuscript = () => {
    if (!selected) return;
    const first = selected._allQuotes?.[0] || (selected.quotes && selected.quotes[0]);
    if (first) onJumpToOccurrence(first.chapterId, first.occurrenceId);
    else _castNotice("This character has no manuscript mentions yet.");
  };
  const onJumpQuote   = (q) => onJumpToOccurrence(q && q.chapterId, q && q.occurrenceId);
  const onShowAllQuotes = () => {
    if (!selected) return;
    setView("selected"); // ensure detail
    setShowAllQuotes((v) => !v);
  };
  const [showAllQuotes, setShowAllQuotes] = _us_cast(false);
  React.useEffect(() => { setShowAllQuotes(false); }, [selectedId]);

  const onSelectRelated = (r) => {
    if (!r || !r.id) return;
    setSelectedId(r.id);
    setView("selected");
    onSelectEntity && onSelectEntity({ id: r.id, label: r.name, entityType: "cast" });
  };

  const onOpenSkillTree = () => {
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "skillTrees" } }));
  };
  const onOpenAtlasFor = (loc) => {
    if (loc && loc.id) window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas", focus: { entityId: loc.id, entityType: "locations", label: loc.label } } }));
    else window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } }));
  };
  const onOpenTimelineFor = (ev) => {
    if (ev && ev.id) window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline", focus: { entityId: ev.id, entityType: "events", label: ev.label } } }));
    else window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } }));
  };

  // ----- Empty / error / loading states --------------------------------
  if (view === "loading") return <LoadingState title="Reading the cast register…" lines={5}/>;
  if (view === "error")   return <ErrorState title="Couldn't load cast" body="Local index unreachable. Your characters are safe." onRetry={() => setView("overview")}/>;
  if (view === "empty" || (!dossierList.length && view !== "edit")) {
    return <CastEmpty
      onCreate={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast", mode: "full" } }))}
      onExtract={() => window.dispatchEvent(new CustomEvent("lw:open-extraction-wizard", { detail: { scope: "manuscript", typeFocus: "cast" } }))}
    />;
  }
  if (view === "edit")    return <CastEdit c={selected} onCancel={() => setView("selected")} onSave={() => setView("selected")}/>;
  if (view === "selected" && selected) {
    return (
      <CastDetail
        c={selected}
        chapters={dossierCtx.chapters}
        onBack={() => setView("overview")}
        onEdit={onEditFromDossier}
        onAddTrait={onAddTrait}
        onAddRelationship={onAddRelationship}
        onAddAbility={onAddAbility}
        onEditStats={onEditStats}
        onCastMore={onCastMore}
        onJumpManuscript={onJumpManuscript}
        onJumpQuote={onJumpQuote}
        onShowAllQuotes={onShowAllQuotes}
        showAllQuotes={showAllQuotes}
        onSelectRelated={onSelectRelated}
        onOpenSkillTree={onOpenSkillTree}
        onOpenAtlasFor={onOpenAtlasFor}
        onOpenTimelineFor={onOpenTimelineFor}
      />
    );
  }
  // Default: browse with optional multi-select
  return (
    <CastBrowse
      cast={dossierList}
      selectedId={selectedId}
      multiSelected={multi}
      multiMode={view === "multi"}
      onEnterMultiMode={() => setView("multi")}
      onSelect={onSelect}
      onToggleMulti={onToggleMulti}
      onClearMulti={() => { setMulti(new Set()); setView("overview"); }}
      onMergeMulti={() => _castNotice("Merge multiple — coming with the Review queue tools.")}
      onTagMulti={() => _castNotice("Tag multiple — coming with the entity tabs pass.")}
      onDeleteMulti={() => _castNotice("Delete multiple — coming with the entity tabs pass.")}
      onCreate={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast", mode: "full" } }))}
    />
  );
};

// ---------------------------------------------------------------------
// Small dossier sub-components
// ---------------------------------------------------------------------
const CastStats = ({ stats }) => (
  <div className="cast-stats">
    {stats.map((s) => (
      <div key={s.k} className="cast-stat">
        <span className="cast-stat__k">{s.k}</span>
        <div className="cast-stat__bar"><div className="cast-stat__bar__fill" style={{ width: ((s.v / s.max) * 100) + "%" }}/></div>
        <span className="cast-stat__v">{s.v}<span className="cast-stat__max">/{s.max}</span></span>
      </div>
    ))}
  </div>
);

const CastAbilities = ({ items }) => (
  <div className="cast-abilities">
    {items.map((a, i) => (
      <div key={i} className="cast-ability">
        <div className="cast-ability__head">
          <span className="cast-ability__name">{a.name}</span>
          <span className="cast-ability__src">{a.source}</span>
        </div>
        <div className="cast-ability__desc">{a.desc}</div>
      </div>
    ))}
  </div>
);

const CastSkillTree = ({ tree }) => (
  <div className="cast-tree">
    {tree.branches.map((b) => (
      <div key={b.name} className="cast-tree__branch">
        <div className="cast-tree__branch-name">{b.name}</div>
        <div className="cast-tree__nodes">
          {b.nodes.map((n, i) => (
            <React.Fragment key={n.name}>
              <div className={"cast-tree__node cast-tree__node--" + n.state} title={n.state}>
                <span className="cast-tree__node__pip"/>
                <span className="cast-tree__node__lbl">{n.name}</span>
              </div>
              {i < b.nodes.length - 1 && <span className="cast-tree__link"/>}
            </React.Fragment>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// CastEquipmentSlots — RPG-style equipment slots; accepts item drops.
// Display-only here; the real wiring goes through onEquipItem callbacks.
// ---------------------------------------------------------------------
const CAST_EQUIP_SLOTS = [
  { id: "head",       label: "Head",        glyph: "◯" },
  { id: "body",       label: "Body",        glyph: "▦" },
  { id: "hands",      label: "Hands",       glyph: "✋" },
  { id: "main-hand",  label: "Main Hand",   glyph: "🗡" },
  { id: "off-hand",   label: "Off Hand",    glyph: "◐" },
  { id: "accessory",  label: "Accessory",   glyph: "◊" },
  { id: "tool",       label: "Tool",        glyph: "⚙" },
  { id: "relic",      label: "Relic",       glyph: "✦" },
  { id: "pack",       label: "Pack",        glyph: "▤" },
  { id: "quest",      label: "Quest",       glyph: "❖" },
];

const CastEquipmentSlots = ({ cast }) => {
  // Live equipment — items linked via data.equippedItems whose item entity
  // carries data.slot are placed in their slot. Otherwise the slot stays
  // empty (ready to accept a drag-drop, which the existing handler wires up).
  const equipped = (cast && cast.equippedBySlot) || {};

  return (
    <div className="cast-equip" data-ui="CastEquipmentSlots">
      {CAST_EQUIP_SLOTS.map((slot) => {
        const item = equipped[slot.id];
        return (
          <div
            key={slot.id}
            className={"cast-equip__slot " + (item ? "is-filled" : "is-empty")}
            data-ent-drop="cast"
            onDragOver={(e) => {
              try {
                const types = e.dataTransfer.types;
                if (types && Array.from(types).some((t) => t === "application/x-loom-entity" || t === "text/loomwright-entity")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  e.currentTarget.classList.add("is-over");
                }
              } catch (_err) {}
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove("is-over")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("is-over");
            }}
          >
            <div className="cast-equip__slot__lbl">{slot.label}</div>
            <div className="cast-equip__slot__glyph">{slot.glyph}</div>
            {item ? (
              <>
                <div className="cast-equip__slot__name">{item.name}</div>
                <div className="cast-equip__slot__sub">
                  {item.condition}
                  {item.warning && <span className="cast-equip__slot__warn" title={item.warning}>⚠</span>}
                </div>
                <div className="cast-equip__slot__actions">
                  <button title="Show item dossier" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } }))}>Open</button>
                  <button title="Unequip / move to pack" data-callback="onUnequipItem">Unequip</button>
                </div>
              </>
            ) : (
              <div className="cast-equip__slot__hint">empty</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CastInventory = ({ items }) => (
  <div className="cast-inv">
    {items.map((it, i) => (
      <div key={i} className={"cast-inv__item" + (it.notable ? " is-notable" : "")}>
        <span className={"cast-inv__kind cast-inv__kind--" + it.kind} title={it.kind}/>
        <div className="cast-inv__body">
          <div className="cast-inv__name">{it.name}{it.notable && <span className="cast-inv__star" title="Plot-significant">★</span>}</div>
          {it.note && <div className="cast-inv__note">{it.note}</div>}
        </div>
        <span className="cast-inv__kind-lbl">{it.kind}</span>
      </div>
    ))}
  </div>
);

// Section wrapper with optional Show More collapse
const CastShowMore = ({ children, threshold = 3, more = "Show all", less = "Show less" }) => {
  const [open, setOpen] = _us_cast(false);
  const arr = React.Children.toArray(children);
  if (arr.length <= threshold) return <>{children}</>;
  return (
    <>
      {open ? arr : arr.slice(0, threshold)}
      <button className="cast-section__action" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setOpen(!open)}>
        {open ? less : (more + " (" + arr.length + ")")}
      </button>
    </>
  );
};

Object.assign(window, {
  CastPanelBody, CastBrowse, CastDetail, CastEdit, CastEmpty,
  CastStats, CastAbilities, CastSkillTree, CastInventory, CastEquipmentSlots, CastShowMore,
  CAST_SAMPLE, CAST_SUGGESTIONS_SAMPLE,
});
