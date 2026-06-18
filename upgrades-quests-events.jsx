// =====================================================================
// upgrades-quests-events.jsx — Quests + Events upgrade
//
// Quests and Events share visual vocabulary (status chips, step rows,
// consequence chains) so they live together. Each has:
//   - bespoke PanelBody for side-panel
//   - bespoke detail dossier registered in RPG_DETAIL_RENDERERS
//   - full-screen overlay (Quests log / Events ledger)
// =====================================================================

const { useState: _qe_us, useMemo: _qe_um, useCallback: _qe_uc } = React;

// ---------------------------------------------------------------------
// Quest sample data
// ---------------------------------------------------------------------
const QUEST_STATUS_TONES = {
  "active":     "status-active",
  "completed":  "status-done",
  "failed":     "status-failed",
  "future":     "status-future",
  "abandoned":  "status-abandoned",
  "optional":   "status-active",
  "recurring":  "status-active",
  "hidden":     "status-future",
  "not-started":"status-future",
};

const QUESTS_DATA = [
  {
    id: "q1", type: "quests", name: "The Auger Wake", glyphChar: "Aw",
    subtitle: "Open thread, Acts I–III",
    summary: "The funeral-rite that opens the manuscript and seeds every later break. Aelinor inherits the Bone Auger; Brec's family is named the witness.",
    goal: "Carry the Bone Auger through the rite without breaking the chain of witness.",
    status: "active", queue: 2,
    chapterRange: "Ch. 1–7",
    optional: false,
    rewards: "Aelinor recognized as Auger-keeper.",
    consequences: "Hess is owed witness; the Court can demand it.",
    mentionsByChapter: [6,1,0,1,0,2,4,0,0,0,0,0],
    participants: [
      { id: "c1", type: "cast",     label: "Aelinor Vey" },
      { id: "c3", type: "cast",     label: "Captain Brec" },
      { id: "f1", type: "factions", label: "House Vey" },
    ],
    locations: [
      { id: "a1",  type: "locations", label: "Pale Reach Hold" },
      { id: "loc-vey-hall", type: "locations", label: "Vey Hall" },
    ],
    items: [
      { id: "i1", type: "items", label: "Bone Auger" },
      { id: "i2", type: "items", label: "Vey Signet" },
    ],
    factions: [
      { id: "f1", type: "factions", label: "House Vey" },
      { id: "f2", type: "factions", label: "House Hess" },
    ],
    relatedEvents: [{ id: "e1", type: "events", label: "Hess negotiation" }],
    conditions: [
      "The Auger must not be lowered in public.",
      "A witness from House Hess must be present.",
    ],
    steps: [
      { id: "qs1", title: "Open the rite at the Hold",     status: "done",    chapter: "Ch. 1", location: "Pale Reach Hold", participants: ["Aelinor", "Brec"], cite: "Ch. 1, p. 14" },
      { id: "qs2", title: "Carry the Auger to the Pass",   status: "done",    chapter: "Ch. 4", location: "Vraska Pass",     participants: ["Aelinor"],         cite: "Ch. 4, p. 96" },
      { id: "qs3", title: "Present at the Glass Court",    status: "active",  chapter: "Ch. 7", location: "Glass Court",     participants: ["Aelinor", "Saren"], cite: "Ch. 7, p. 184" },
      { id: "qs4", title: "Return the Auger to the vault", status: "not-started", chapter: "—", location: "Reachstone Keep", participants: [] },
    ],
    branches: [
      { id: "qb1", label: "Refuse the witness",   outcome: "Hess withdraws; war becomes likely.", chapter: "Ch. 7", chosen: false },
      { id: "qb2", label: "Accept witness as bound", outcome: "Aelinor's standing rises; Hess gains leverage.", chapter: "Ch. 7", chosen: false },
    ],
    consequenceChain: [
      { kind: "cause",    body: "Aelinor inherits the Bone Auger." },
      { kind: "event",    body: "The rite is opened publicly at the Hold." },
      { kind: "outcome",  body: "House Vey owes Hess a witness — the negotiation is set." },
    ],
    sourceMentions: [
      { id: "m1", excerpt: "She set the case on the table.",                 cite: "Ch. 1, p. 14" },
      { id: "m2", excerpt: "the Auger Wake came through here last week.",     cite: "Ch. 7, p. 187" },
    ],
    contradictions: [
      { id: "qc1", note: "Brec was supposed to be the named witness — but Ch. 7 has Mara of Hess." },
    ],
  },
  {
    id: "q2", type: "quests", name: "Brec's Letter", glyphChar: "Bl",
    subtitle: "Resolved — Ch. 5",
    summary: "A letter from Brec to Aelinor; sealed with the Hess Letter-key. The seal breaks at the Brittlewood crossing.",
    goal: "Deliver the letter intact.",
    status: "completed",
    chapterRange: "Ch. 2–5",
    mentionsByChapter: [0,2,1,1,3,0,0,0,0,0,0,0],
    participants: [
      { id: "c3", type: "cast", label: "Captain Brec" },
      { id: "c1", type: "cast", label: "Aelinor Vey" },
    ],
    locations: [
      { id: "loc-watchhouse", type: "locations", label: "Watchhouse" },
      { id: "bw", type: "locations", label: "Brittlewood" },
    ],
    items: [{ id: "i4", type: "items", label: "Hess Letter-key" }],
    factions: [],
    relatedEvents: [],
    conditions: ["Letter must reach Aelinor unopened."],
    steps: [
      { id: "qs5", title: "Lock the letter at the Watchhouse", status: "done", chapter: "Ch. 2", location: "Watchhouse",  cite: "Ch. 2, p. 32" },
      { id: "qs6", title: "Cross the Brittlewood",            status: "done", chapter: "Ch. 5", location: "Brittlewood", cite: "Ch. 5, p. 134" },
      { id: "qs7", title: "Hand to Aelinor",                  status: "done", chapter: "Ch. 5", location: "Pale Reach Hold", cite: "Ch. 5, p. 142" },
    ],
    branches: [],
    consequenceChain: [
      { kind: "cause",   body: "Brec writes to Aelinor in private code." },
      { kind: "event",   body: "Key is lost in the Brittlewood." },
      { kind: "outcome", body: "Letter opens unsealed — the secret is known." },
    ],
    sourceMentions: [
      { id: "m3", excerpt: "She had not slept since Brec's letter.", cite: "Ch. 7, p. 184" },
    ],
    contradictions: [],
  },
  {
    id: "q3", type: "quests", name: "The Hess negotiation", glyphChar: "Hn",
    subtitle: "Active — Acts II–III",
    summary: "Three-day audience in the Glass Court. Frame for the political beat of Acts II–III.",
    goal: "Secure a treaty without ceding the Auger.",
    status: "active", queue: 1,
    chapterRange: "Ch. 3–7",
    mentionsByChapter: [0,0,3,1,0,1,5,0,0,0,0,0],
    participants: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c2", type: "cast", label: "Saren of Hess" },
    ],
    locations: [{ id: "a3", type: "locations", label: "Glass Court" }],
    items: [{ id: "i2", type: "items", label: "Vey Signet" }],
    factions: [
      { id: "f1", type: "factions", label: "House Vey" },
      { id: "f2", type: "factions", label: "House Hess" },
    ],
    relatedEvents: [{ id: "e1", type: "events", label: "Hess negotiation" }],
    conditions: ["Audience lasts exactly three days.", "No edged weapons admitted."],
    steps: [
      { id: "qs8", title: "Day one — open the audience",  status: "done",    chapter: "Ch. 3", location: "Glass Court", cite: "Ch. 3, p. 78" },
      { id: "qs9", title: "Day two — make the ask",        status: "done",    chapter: "Ch. 6", location: "Glass Court", cite: "Ch. 6, p. 168" },
      { id: "qs10",title: "Day three — break or bind",     status: "active",  chapter: "Ch. 7", location: "Glass Court", cite: "Ch. 7, p. 188" },
    ],
    branches: [
      { id: "qb3", label: "Bind treaty with Auger as bond",      outcome: "Hess gets witness rights to the Auger.", chosen: false },
      { id: "qb4", label: "Break and withdraw to Pale Reach",    outcome: "War becomes likely; the Hold prepares.", chosen: false },
    ],
    consequenceChain: [
      { kind: "cause",   body: "House Vey owes Hess witness." },
      { kind: "event",   body: "Saren formally asks for the Auger." },
      { kind: "outcome", body: "Aelinor must choose — bind or break." },
    ],
    sourceMentions: [
      { id: "m4", excerpt: "Glass Throne audiences last exactly three days.", cite: "Bk I · Ch. 11" },
    ],
    contradictions: [],
  },
  {
    id: "q4", type: "quests", name: "The Salt Watch",  glyphChar: "Sw",
    subtitle: "Optional — unresolved",
    summary: "An old watch-tower north of the Hold. Reach folk say it 'still calls.' Aelinor has heard it twice.",
    goal: "Decide if the Salt Watch is real.",
    status: "optional", queue: 1,
    chapterRange: "Ch. 2, 6",
    mentionsByChapter: [0,1,0,0,0,2,0,0,0,0,0,0],
    participants: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
    locations: [{ id: "sw", type: "locations", label: "Salt Watch" }],
    items: [], factions: [], relatedEvents: [],
    conditions: [],
    steps: [{ id: "qs11", title: "Aelinor hears the tower call", status: "done", chapter: "Ch. 2", location: "Pale Reach", cite: "Ch. 2, p. 38" }],
    branches: [],
    consequenceChain: [],
    sourceMentions: [],
    contradictions: [{ id: "qc2", note: "Salt Watch is unplaced on the Atlas." }],
  },
  {
    id: "q5", type: "quests", name: "Track of the wolfhound", glyphChar: "Tw",
    subtitle: "Hidden — future",
    summary: "The grey hound at the Glass Court door — who sent it?",
    goal: "Identify the hound's owner.",
    status: "hidden",
    chapterRange: "Ch. 3",
    mentionsByChapter: [0,0,1,0,0,0,0,0,0,0,0,0],
    participants: [], locations: [{ id: "a3", type: "locations", label: "Glass Court" }],
    items: [], factions: [], relatedEvents: [],
    conditions: [], steps: [], branches: [], consequenceChain: [],
    sourceMentions: [], contradictions: [],
  },
];


// ---------------------------------------------------------------------
// Events sample data
// ---------------------------------------------------------------------
const EVENT_TYPES = [
  "battle","meeting","discovery","death","betrayal","travel","trade",
  "duel","ritual","accident","reveal","promise","challenge","conflict",
  "celebration","disaster","custom",
];

const EVENTS_DATA = [
  {
    id: "e1", type: "events", name: "Hess negotiation break", glyphChar: "Hn",
    subtitle: "Ch. 7 set-piece",
    summary: "On the third day of the Glass Court audience the negotiation breaks. Brec leaves first. Aelinor holds the floor.",
    eventType: "conflict", chapter: "Ch. 7", date: "3rd day of audience",
    mentionsByChapter: [0,0,0,0,0,0,5,0,0,0,0,0],
    location: { id: "a3", type: "locations", label: "Glass Court" },
    participants: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c2", type: "cast", label: "Saren of Hess" },
      { id: "c3", type: "cast", label: "Captain Brec" },
    ],
    cause: "Saren formally asks for the Bone Auger as bond.",
    immediateOutcome: "Aelinor refuses; the audience is paused.",
    longTermConsequence: "House Vey and House Hess move toward war.",
    quests:   [{ id: "q3", type: "quests", label: "The Hess negotiation" }],
    items:    [{ id: "i1", type: "items",  label: "Bone Auger" }],
    factions: [
      { id: "f1", type: "factions", label: "House Vey" },
      { id: "f2", type: "factions", label: "House Hess" },
    ],
    relationshipChanges: [
      { left: "Aelinor", right: "Saren", change: "ally → wary",        chapter: "Ch. 7" },
      { left: "Brec",    right: "Aelinor", change: "trusted → loyal but absent", chapter: "Ch. 7" },
    ],
    locationChanges: [{ where: "Glass Court", change: "audience paused on day three" }],
    characterChanges: [{ who: "Aelinor", change: "Resolve −2", cite: "Ch. 7, p. 188" }],
    consequenceChain: [
      { kind: "cause",   body: "Hess asks for the Auger as bond." },
      { kind: "event",   body: "Aelinor refuses publicly." },
      { kind: "outcome", body: "Audience pauses; Hess withdraws." },
      { kind: "long",    body: "Both houses move toward war." },
    ],
    sourceMentions: [
      { id: "m5", excerpt: "Today, or not at all.",            cite: "Ch. 7, p. 188" },
      { id: "m6", excerpt: "Brec did not look at the case.",    cite: "Ch. 7, p. 187" },
    ],
    contradictions: [],
  },
  {
    id: "e2", type: "events", name: "First salt-storm", glyphChar: "Fs",
    subtitle: "Ch. 2 disaster",
    summary: "Salt-cold storm batters the Hold. Two are taken by salt-wraiths.",
    eventType: "disaster", chapter: "Ch. 2", date: "Winter's third week",
    mentionsByChapter: [0,5,0,0,0,0,0,0,0,0,0,0],
    location: { id: "a1", type: "locations", label: "Pale Reach Hold" },
    participants: [
      { id: "c3", type: "cast", label: "Captain Brec" },
      { id: "b1", type: "bestiary", label: "Salt-wraith" },
    ],
    cause: "Salt-storm from the Auger Cliffs.",
    immediateOutcome: "Two casualties; outer wall breached.",
    longTermConsequence: "The Hold's defences are weakened; salt-wraith canon is reaffirmed.",
    quests:   [], items: [],
    factions: [{ id: "f1", type: "factions", label: "House Vey" }],
    relationshipChanges: [],
    locationChanges: [{ where: "Pale Reach Hold", change: "outer wall breached" }],
    characterChanges: [],
    consequenceChain: [
      { kind: "cause",   body: "Storm rolls in off the Auger Cliffs." },
      { kind: "event",   body: "Salt-wraiths come down the wind." },
      { kind: "outcome", body: "Two watchers taken; wall breached." },
    ],
    sourceMentions: [{ id: "m7", excerpt: "It came in on the salt.", cite: "Ch. 2, p. 41" }],
    contradictions: [],
  },
  {
    id: "e3", type: "events", name: "Brec's letter sealed", glyphChar: "Bs",
    subtitle: "Ch. 2 ritual",
    summary: "Brec uses the Letter-key to seal the letter to Aelinor.",
    eventType: "ritual", chapter: "Ch. 2", date: "Night before the storm",
    mentionsByChapter: [0,2,0,0,0,0,0,0,0,0,0,0],
    location: { id: "loc-watchhouse", type: "locations", label: "Watchhouse" },
    participants: [{ id: "c3", type: "cast", label: "Captain Brec" }],
    cause: "Brec writes to Aelinor in private code.",
    immediateOutcome: "Letter is sealed.",
    longTermConsequence: "Key is later lost at the Brittlewood.",
    quests: [{ id: "q2", type: "quests", label: "Brec's Letter" }],
    items: [{ id: "i4", type: "items", label: "Hess Letter-key" }],
    factions: [], relationshipChanges: [],
    locationChanges: [], characterChanges: [],
    consequenceChain: [
      { kind: "cause",   body: "Brec writes the letter." },
      { kind: "event",   body: "Letter-key folds the single sheet." },
      { kind: "outcome", body: "Letter is now tamper-evident." },
    ],
    sourceMentions: [{ id: "m8", excerpt: "She had not slept since Brec's letter.", cite: "Ch. 7, p. 184" }],
    contradictions: [],
  },
  {
    id: "e4", type: "events", name: "Crossing of Vraska Pass", glyphChar: "Cv",
    subtitle: "Ch. 4 travel",
    summary: "Aelinor crosses the Pass with the Bone Auger. The pass is closing.",
    eventType: "travel", chapter: "Ch. 4", date: "Late autumn",
    mentionsByChapter: [0,0,0,4,0,0,0,0,0,0,0,0],
    location: { id: "a2", type: "locations", label: "Vraska Pass" },
    participants: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
    cause: "Hess audience set.",
    immediateOutcome: "Aelinor arrives at the Glass Court.",
    longTermConsequence: "Pass is unwalkable until spring.",
    quests: [{ id: "q1", type: "quests", label: "The Auger Wake" }],
    items: [{ id: "i1", type: "items", label: "Bone Auger" }],
    factions: [], relationshipChanges: [],
    locationChanges: [{ where: "Vraska Pass", change: "closed for winter" }],
    characterChanges: [{ who: "Aelinor", change: "Standing → Court-recognized" }],
    consequenceChain: [
      { kind: "cause",   body: "Audience is set in Hess." },
      { kind: "event",   body: "Aelinor walks the pass." },
      { kind: "outcome", body: "Aelinor arrives recognised as Vey." },
    ],
    sourceMentions: [{ id: "m9", excerpt: "the road through the Vraska Pass is still walkable.", cite: "Ch. 7, p. 187" }],
    contradictions: [],
  },
];


// ---------------------------------------------------------------------
// Shared visuals
// ---------------------------------------------------------------------
const QuestStepRow = ({ step, idx, total, onComplete, onFail, onEdit, onOpenSource }) => {
  const cls = "qe-step" + (step.status === "done" ? " qe-step--done" : step.status === "failed" ? " qe-step--failed" : step.status === "active" ? " qe-step--active" : "");
  return (
    <li className={cls} data-ui="QuestStepRow">
      <div className="qe-step__n">{idx + 1}</div>
      <div className="qe-step__body">
        <span className="qe-step__title">{step.title}</span>
        <span className="qe-step__meta">
          <span>{step.chapter}</span>
          {step.location && <span>· {step.location}</span>}
          {step.participants && step.participants.length > 0 && <span>· {step.participants.join(", ")}</span>}
          {step.cite && <button className="qe-step__cite" data-callback="onOpenQuestSourceMention" onClick={() => onOpenSource && onOpenSource(step)}>{step.cite}</button>}
        </span>
      </div>
      <div className="qe-step__actions">
        {step.status !== "done" && step.status !== "failed" && (
          <>
            <button className="rpg-btn rpg-btn--small" data-callback="onCompleteQuestStep" onClick={() => onComplete && onComplete(step)}>Complete</button>
            <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onFailQuestStep" onClick={() => onFail && onFail(step)}>Fail</button>
          </>
        )}
        <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onEditQuestStep" onClick={() => onEdit && onEdit(step)}>Edit</button>
      </div>
    </li>
  );
};

const ConsequenceChainBlock = ({ rows }) => (
  <div className="qe-chain" data-ui="ConsequenceChain">
    {rows.map((r, i) => (
      <div className="qe-chain__row" key={i}>
        <span className="qe-chain__kind">{r.kind}</span>
        <span className="qe-chain__body">{r.body}</span>
      </div>
    ))}
  </div>
);

const StatusChip = ({ status }) => {
  const tone = QUEST_STATUS_TONES[status] || "status-active";
  return (
    <span className={"qe-meta__chip qe-meta__chip--" + tone} data-ui="StatusChip">
      {status.replace("-", " ")}
    </span>
  );
};

// ---------------------------------------------------------------------
// Live-data adapters
//
// Live quest/event entities keep identity fields top-level (name/title,
// status, summary…) and ALL custom fields under entity.data.* using the
// editor's field ids. QuestDetail/EventDetail were written against flat
// demo objects, so a real quest/event rendered nearly empty. These map
// data.* into the flat shape, resolve related-entity refs, normalise
// step/branch/change rows, and derive mentions from the occurrence index.
// Mirrors liveBestiaryToDetail etc.
// ---------------------------------------------------------------------
const _qeB = () => (typeof window !== "undefined") && window.LoomwrightBackend;
function _qeResolveRef(r, ty) {
  if (!r) return null;
  if (typeof r === "object") return { id: r.id, name: r.name || r.label || r.id, label: r.name || r.label || r.id, type: r.type || ty || "" };
  let nm = r, t = ty || "";
  try { const B = _qeB(); const ent = B && B.EntityService && B.EntityService.getSync(r); if (ent) { nm = ent.name || ent.title || r; t = ent.type || ty || ""; } } catch (_e) {}
  return { id: r, name: nm, label: nm, type: t };
}
function _qeRefList(arr, ty) { return (Array.isArray(arr) ? arr : []).map((r) => _qeResolveRef(r, ty)).filter(Boolean); }
function _qeRuleStrings(arr) {
  return (Array.isArray(arr) ? arr : []).map((r) => {
    if (r == null) return ""; if (typeof r === "string") return r;
    if (typeof r === "object") {
      const a = r.target || r.stat || r.name || r.label || r.left || "";
      const d = (r.delta != null ? r.delta : (r.value != null ? r.value : r.amount));
      const n = r.note || r.detail || r.text || r.change || "";
      const ds = (d != null && d !== "") ? (typeof d === "number" ? (d > 0 ? "+" + d : String(d)) : String(d)) : "";
      return [a, ds, n].filter(Boolean).join(" ").trim();
    }
    return String(r);
  }).filter(Boolean);
}
function _qeMentions(id) {
  const B = _qeB(); let occ = [], chapters = [];
  try { occ = (B && B.OccurrenceService && (B.OccurrenceService.listByEntitySync ? B.OccurrenceService.listByEntitySync(id) : (B.OccurrenceService.listAllSync() || []).filter((o) => o.entityId === id))) || []; } catch (_e) {}
  try { chapters = ((B && B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync().chapters) || []).filter((c) => c && !c.reserved); } catch (_e) {}
  const numById = new Map(); chapters.forEach((c, i) => numById.set(c.id, c.num || i + 1));
  const maxNum = chapters.reduce((m, c) => Math.max(m, numById.get(c.id) || 0), 0);
  const mentionsByChapter = maxNum ? new Array(maxNum).fill(0) : [];
  const sourceMentions = [];
  for (const o of occ) {
    if (!o || o.isPronounResolution) continue;
    const n = numById.get(o.chapterId);
    if (n != null && mentionsByChapter[n - 1] != null) mentionsByChapter[n - 1] += 1;
    if (sourceMentions.length < 8 && o.exactText) sourceMentions.push({ id: o.occurrenceId || ("occ-" + sourceMentions.length), cite: n != null ? "Ch. " + n : "—", excerpt: o.exactText, chapterId: o.chapterId });
  }
  return { mentionsByChapter, sourceMentions };
}
function liveQuestToDetail(entity) {
  if (!entity) return entity;
  const top = entity, d = entity.data || {};
  const steps = (Array.isArray(d.steps) ? d.steps : []).map((s, i) => ({
    id: s.id || ("step-" + i),
    title: s.title || s.label || s.text || ("Step " + (i + 1)),
    status: s.status || "todo",
    chapter: s.chapter || "", location: s.location || "",
    participants: Array.isArray(s.participants) ? s.participants : [],
    cite: s.cite || "",
  }));
  const branches = (Array.isArray(d.branches) ? d.branches : []).map((b, i) => ({ id: b.id || ("br-" + i), label: b.label || b.title || ("Branch " + (i + 1)), chapter: b.chapter || "", outcome: b.outcome || b.note || "" }));
  const m = _qeMentions(entity.id);
  const cr = [d.startChapter, d.completionChapter].filter(Boolean).join("–");
  return {
    ...entity,
    name: top.name || top.title || "Untitled",
    questType: d.questType || "",
    chapterRange: cr || d.timelinePosition || "",
    optional: /side|optional/i.test(d.questType || ""),
    queue: top.reviewQueueCount || top.queue || 0,
    summary: top.summary || d.summary || "",
    goal: d.goal || "",
    steps, branches,
    conditions: _qeRuleStrings(d.conditions),
    participants: [..._qeRefList(d.owner ? [d.owner] : [], "cast"), ..._qeRefList(d.participants, "cast")],
    locations: _qeRefList(d.locations, "locations"),
    items: _qeRefList(d.items, "items"),
    factions: _qeRefList(d.factions, "factions"),
    relatedEvents: _qeRefList(d.relatedEvents, "events"),
    consequenceChain: Array.isArray(d.consequenceChain) ? d.consequenceChain : [],
    contradictions: Array.isArray(d.contradictions) ? d.contradictions : [],
    mentionsByChapter: m.mentionsByChapter,
    sourceMentions: m.sourceMentions,
  };
}
function liveEventToDetail(entity) {
  if (!entity) return entity;
  const top = entity, d = entity.data || {};
  const loc = _qeResolveRef(d.location, "locations");
  const m = _qeMentions(entity.id);
  const relChanges = (Array.isArray(d.relationshipChanges) ? d.relationshipChanges : []).map((r) => {
    if (r && typeof r === "object" && (r.left || r.right)) return { left: r.left || "", right: r.right || "", change: r.change || r.note || "", chapter: r.chapter || "" };
    const s = _qeRuleStrings([r])[0] || ""; const parts = s.split(/↔|<->|\//).map((x) => x.trim());
    return { left: parts[0] || s, right: parts[1] || "", change: parts[2] || "", chapter: "" };
  });
  const charChanges = (Array.isArray(d.characterStateChanges) ? d.characterStateChanges : (Array.isArray(d.characterChanges) ? d.characterChanges : [])).map((c) => {
    if (c && typeof c === "object" && (c.who || c.change)) return { who: c.who || c.target || "", change: c.change || c.note || "", cite: c.cite || "" };
    return { who: (c && (c.target || c.name)) || "", change: (c && (c.note || c.detail)) || _qeRuleStrings([c])[0] || "", cite: "" };
  });
  const locChanges = (Array.isArray(d.locationChanges) ? d.locationChanges : []).map((l) => {
    if (l && typeof l === "object" && (l.where || l.change)) return { where: l.where || l.target || "", change: l.change || l.note || "" };
    return { where: (l && (l.target || l.name)) || "", change: (l && (l.note || l.detail)) || _qeRuleStrings([l])[0] || "" };
  });
  return {
    ...entity,
    name: top.name || top.title || "Untitled",
    eventType: d.eventType || "",
    chapter: d.chapter || "",
    date: d.timelinePosition || d.date || "",
    location: loc ? { ...loc, label: loc.name } : null,
    summary: top.summary || d.summary || "",
    cause: d.cause || "", immediateOutcome: d.immediateOutcome || "", longTermConsequence: d.longTermConsequence || "",
    participants: _qeRefList(d.participants, "cast"),
    factions: _qeRefList(d.factions, "factions"),
    quests: _qeRefList(d.relatedQuests, "quests"),
    items: _qeRefList(d.relatedItems, "items"),
    relationshipChanges: relChanges,
    characterChanges: charChanges,
    locationChanges: locChanges,
    mentionsByChapter: m.mentionsByChapter,
    sourceMentions: m.sourceMentions,
  };
}

// ---------------------------------------------------------------------
// QuestDetail
// ---------------------------------------------------------------------
const QuestDetail = ({ entity, onSelectEntity, onOpenSourceMention, onOpenRelatedTab, onOpenFullScreen }) => {
  const raw = entity || {};
  const e = liveQuestToDetail(raw);
  const rawSteps = Array.isArray(raw.data?.steps) ? raw.data.steps : [];
  // Persist step status toggles to entity.data.steps (was an inert no-op).
  const persistSteps = (steps) => { try { const B = window.LoomwrightBackend; if (B?.EntityService && raw.id) { B.EntityService.update("quests", raw.id, { data: { ...(raw.data || {}), steps } }); window.dispatchEvent(new CustomEvent("lw:entity-store-updated")); } } catch (_e) {} };
  const setStepByIdx = (idx, status) => persistSteps(rawSteps.map((s, i) => i === idx ? { ...s, status } : s));
  const openQuestEditor = () => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "quests", initial: { id: raw.id }, mode: "full" } }));
  const stepsDone = (e.steps || []).filter((s) => s.status === "done").length;

  return (
    <div className="rpg-detail qe-detail" data-ui="QuestDetail" data-entity-id={raw.id} data-entity-type="quests">
      <div className="qe-meta">
        <StatusChip status={e.status || "active"}/>
        {e.chapterRange && <span className="qe-meta__chip">{e.chapterRange}</span>}
        <span className="qe-meta__chip">{stepsDone}/{(e.steps || []).length} steps</span>
        {e.optional && <span className="qe-meta__chip">Optional</span>}
        {(e.queue || 0) > 0 && <span className="qe-meta__chip">Review: {e.queue}</span>}
      </div>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {e.goal && (
        <RpgSection title="Goal">
          <p className="rpg-prose" style={{ fontStyle: "italic" }}>{e.goal}</p>
        </RpgSection>
      )}

      <RpgSection title="Steps"
                  action={{ label: "+ Add step", callback: "onAddQuestStep" }}>
        {(e.steps || []).length > 0 ? (
          <ol className="qe-steps">
            {e.steps.map((s, i) => (
              <QuestStepRow
                key={s.id} step={s} idx={i} total={e.steps.length}
                onComplete={() => setStepByIdx(i, "done")} onFail={() => setStepByIdx(i, "failed")} onEdit={openQuestEditor}
                onOpenSource={onOpenSourceMention}
              />
            ))}
          </ol>
        ) : <span className="rpg-empty">No steps yet.</span>}
      </RpgSection>

      {(e.branches || []).length > 0 && (
        <RpgSection title="Branches"
                    action={{ label: "+ Branch", callback: "onBranchQuest" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {e.branches.map((b) => (
              <div key={b.id} className="qe-branch">
                <div className="qe-branch__head">{b.label}{b.chapter ? " · " + b.chapter : ""}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>{b.outcome}</div>
              </div>
            ))}
          </div>
        </RpgSection>
      )}

      {(e.consequenceChain || []).length > 0 && (
        <RpgSection title="Cause → outcome">
          <ConsequenceChainBlock rows={e.consequenceChain}/>
        </RpgSection>
      )}

      {(e.conditions || []).length > 0 && (
        <RpgSection title="Required conditions">
          <ul className="rpg-bullets">{e.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </RpgSection>
      )}

      {(e.participants || []).length > 0 && (
        <RpgSection title="Participants">
          <RpgChipRow items={e.participants} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.locations || []).length > 0 && (
        <RpgSection title="Locations"
                    action={{ label: "Show on Atlas →", callback: "onShowQuestOnAtlas" }}>
          <RpgChipRow items={e.locations} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.items || []).length > 0 && (
        <RpgSection title="Items involved">
          <RpgChipRow items={e.items} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.factions || []).length > 0 && (
        <RpgSection title="Factions involved">
          <RpgChipRow items={e.factions} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.relatedEvents || []).length > 0 && (
        <RpgSection title="Related events"
                    action={{ label: "Open Timeline →", callback: "onOpenQuestTimeline" }}>
          <RpgChipRow items={e.relatedEvents} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.mentionsByChapter || []).length > 0 && (
        <RpgSection title="Chapter appearances">
          <RpgChapterSpark mentions={e.mentionsByChapter}/>
        </RpgSection>
      )}

      {(e.sourceMentions || []).length > 0 && (
        <RpgSection title="Source mentions">
          <ul className="loc-mentions">
            {e.sourceMentions.map((m) => (
              <li key={m.id} className="loc-mention">
                <button className="loc-mention__cite" data-callback="onOpenQuestSourceMention" onClick={() => onOpenSourceMention && onOpenSourceMention(m)}>{m.cite}</button>
                <span className="loc-mention__quote">"{m.excerpt}"</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.contradictions || []).length > 0 && (
        <RpgSection title="Unresolved">
          <ul className="loc-warn">{e.contradictions.map((c) => <li key={c.id} className="loc-warn__row">⚠ {c.note}</li>)}</ul>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAddQuestStep">+ Add step</button>
        <button className="rpg-btn" data-callback="onBranchQuest">Branch</button>
        <button className="rpg-btn" data-testid="quest-edit"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "quests", initial: { id: e.id }, mode: "full" } }))}>Edit</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onShowQuestOnAtlas">Show on Atlas</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenQuestTimeline">Open Timeline</button>
        {onOpenFullScreen && (
          <button className="rpg-btn" data-callback="onOpenQuestLog" onClick={onOpenFullScreen}>Open Quest Log →</button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EventDetail
// ---------------------------------------------------------------------
const EventDetail = ({ entity, onSelectEntity, onOpenSourceMention, onOpenRelatedTab, onOpenFullScreen }) => {
  const e = liveEventToDetail(entity || {});
  return (
    <div className="rpg-detail qe-detail" data-ui="EventDetail" data-entity-id={e.id} data-entity-type="events">
      <div className="qe-meta">
        <span className="qe-meta__chip">{e.eventType || "custom"}</span>
        {e.chapter && <span className="qe-meta__chip">{e.chapter}</span>}
        {e.date && <span className="qe-meta__chip">{e.date}</span>}
        {e.location && <span className="qe-meta__chip">@ {e.location.label}</span>}
      </div>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      <RpgSection title="Cause → outcome">
        <ConsequenceChainBlock rows={[
          ...(e.cause            ? [{ kind: "cause",   body: e.cause }] : []),
          { kind: "event",   body: e.summary || e.name },
          ...(e.immediateOutcome ? [{ kind: "outcome", body: e.immediateOutcome }] : []),
          ...(e.longTermConsequence ? [{ kind: "long-term", body: e.longTermConsequence }] : []),
        ]}/>
      </RpgSection>

      {(e.participants || []).length > 0 && (
        <RpgSection title="Participants">
          <RpgChipRow items={e.participants} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {e.location && (
        <RpgSection title="Location"
                    action={{ label: "Show on Atlas →", callback: "onShowEventOnAtlas" }}>
          <RpgChipRow items={[e.location]} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.relationshipChanges || []).length > 0 && (
        <RpgSection title="Relationship changes"
                    action={{ label: "Open Relationships →", callback: "onPinRelatedPanel" }}>
          <ul className="fac-rel-list">
            {e.relationshipChanges.map((r, i) => (
              <li key={i} className="fac-rel-list__row">
                <span className="fac-rel-list__kind">{r.left} ↔ {r.right}</span>
                <span className="fac-rel-list__name">{r.change}</span>
                <span className="fac-rel-list__note">{r.chapter}</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.characterChanges || []).length > 0 && (
        <RpgSection title="Character state changes">
          <ul className="rpg-history">
            {e.characterChanges.map((c, i) => (
              <li key={i} className="rpg-history__row">
                <span className="rpg-history__what"><b>{c.who}</b> — {c.change}</span>
                {c.cite && <button className="rpg-history__cite" onClick={() => onOpenSourceMention && onOpenSourceMention(c)}>{c.cite}</button>}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.locationChanges || []).length > 0 && (
        <RpgSection title="Location changes">
          <ul className="rpg-bullets">{e.locationChanges.map((l, i) => <li key={i}><b>{l.where}</b> — {l.change}</li>)}</ul>
        </RpgSection>
      )}

      {(e.quests || []).length > 0 && (
        <RpgSection title="Related quests"
                    action={{ label: "Open Quests →", callback: "onPinRelatedPanel" }}>
          <RpgChipRow items={e.quests} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.items || []).length > 0 && (
        <RpgSection title="Related items">
          <RpgChipRow items={e.items} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.factions || []).length > 0 && (
        <RpgSection title="Related factions">
          <RpgChipRow items={e.factions} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.sourceMentions || []).length > 0 && (
        <RpgSection title="Source mentions">
          <ul className="loc-mentions">
            {e.sourceMentions.map((m) => (
              <li key={m.id} className="loc-mention">
                <button className="loc-mention__cite" data-callback="onOpenEventSourceMention" onClick={() => onOpenSourceMention && onOpenSourceMention(m)}>{m.cite}</button>
                <span className="loc-mention__quote">"{m.excerpt}"</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-testid="event-edit"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "events", initial: { id: e.id }, mode: "full" } }))}>Edit</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onShowEventOnAtlas">Show on Atlas</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenEventTimeline">Open Timeline</button>
        {onOpenFullScreen && (
          <button className="rpg-btn" data-callback="onOpenEventsLedger" onClick={onOpenFullScreen}>Open Event Ledger →</button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Quests full-screen overlay — three-column quest log
// ---------------------------------------------------------------------
const QuestsFullScreen = ({ onClose }) => {
  const [activeId, setActiveId] = _qe_us("q1");
  const [filter, setFilter] = _qe_us("all"); // all | active | completed | optional | hidden | review
  const _qsrc = (window.LoomwrightBackend?.EntityService?.listSync("quests")) || [];
  const quests = _qsrc.filter((q) => {
    if (filter === "all") return true;
    if (filter === "review") return (q.queue || 0) > 0;
    return q.status === filter;
  });
  const active = _qsrc.find((q) => q.id === activeId) || quests[0] || null;

  return (
    <div className="qe-fs" data-ui="QuestsFullScreen" role="dialog" aria-label="Quest log">
      <button className="rpg-btn rpg-btn--small qe-fs__close" data-callback="onCloseQuestLog" onClick={onClose}>Close ✕</button>

      <aside className="qe-fs__left">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Quest log</div>
          <div className="qe-fs__head-title">All quests</div>
          <div className="qe-fs__head-sub">{quests.length} of {QUESTS_DATA.length}</div>
        </header>
        <div style={{ display: "flex", gap: 4, padding: "8px 14px", flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["active", "Active"],
            ["completed", "Done"],
            ["optional", "Optional"],
            ["hidden", "Hidden"],
            ["review", "Review"],
          ].map(([k, l]) => (
            <button key={k} className={"today__filter" + (filter === k ? " is-active" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="qe-fs__list">
          {quests.map((q) => (
            <div key={q.id}
                 className={"qe-fs__list-row" + (q.id === activeId ? " is-active" : "")}
                 onClick={() => setActiveId(q.id)}>
              <div className="qe-fs__list-row-top">
                <span className="qe-fs__list-row-name">{q.name}</span>
                {(q.queue || 0) > 0 && <ReviewCountBadge count={q.queue}/>}
              </div>
              <div className="qe-fs__list-row-meta">
                <span>{q.status}</span>
                {q.chapterRange && <span> · {q.chapterRange}</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="qe-fs__center">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Quest</div>
          <div className="qe-fs__head-title">{active?.name || "—"}</div>
          {active?.subtitle && <div className="qe-fs__head-sub">{active.subtitle}</div>}
        </header>
        <div className="qe-fs__center-body">
          {active ? (
            <QuestDetail
              entity={active}
              onSelectEntity={() => {}}
              onOpenSourceMention={() => {}}
              onOpenRelatedTab={() => {}}
            />
          ) : <EmptyState icon="scroll" title="No quest" body="Pick a quest from the list."/>}
        </div>
      </section>

      <aside className="qe-fs__right">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Review queue</div>
          <div className="qe-fs__head-title">Quests</div>
          <div className="qe-fs__head-sub">{(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("quests") || []).length} pending</div>
        </header>
        <div className="qe-fs__right-body">
          {(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("quests") || []).map((r) => (
            <LocReviewCard key={r.id} item={r}
              onAccept={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onAcceptQuestQueueItem", detail: { id: it.id } } }))}
              onDeny={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onDenyQuestQueueItem", detail: { id: it.id } } }))}/>
          ))}
        </div>
      </aside>
    </div>
  );
};

// ---------------------------------------------------------------------
// Events full-screen overlay — three-column ledger
// ---------------------------------------------------------------------
const EventsFullScreen = ({ onClose }) => {
  const [activeId, setActiveId] = _qe_us("e1");
  const [typeFilter, setTypeFilter] = _qe_us("all");
  const _esrc = (window.LoomwrightBackend?.EntityService?.listSync("events")) || [];
  const events = _esrc.filter((e) => typeFilter === "all" ? true : e.eventType === typeFilter);
  const active = _esrc.find((e) => e.id === activeId) || events[0] || null;

  return (
    <div className="qe-fs" data-ui="EventsFullScreen" role="dialog" aria-label="Event ledger">
      <button className="rpg-btn rpg-btn--small qe-fs__close" data-callback="onCloseEventsLedger" onClick={onClose}>Close ✕</button>

      <aside className="qe-fs__left">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Event ledger</div>
          <div className="qe-fs__head-title">Chronicle</div>
          <div className="qe-fs__head-sub">{events.length} events</div>
        </header>
        <div style={{ padding: "8px 14px" }}>
          <select className="loc-body__filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
            <option value="all">All event types</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="qe-fs__list">
          {events.map((ev) => (
            <div key={ev.id}
                 className={"qe-fs__list-row" + (ev.id === activeId ? " is-active" : "")}
                 onClick={() => setActiveId(ev.id)}>
              <div className="qe-fs__list-row-top">
                <span className="qe-fs__list-row-name">{ev.name}</span>
              </div>
              <div className="qe-fs__list-row-meta">
                <span>{ev.eventType}</span>
                {ev.chapter && <span> · {ev.chapter}</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="qe-fs__center">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Event</div>
          <div className="qe-fs__head-title">{active?.name || "—"}</div>
          {active?.subtitle && <div className="qe-fs__head-sub">{active.subtitle}</div>}
        </header>
        <div className="qe-fs__center-body">
          {active ? (
            <EventDetail
              entity={active}
              onSelectEntity={() => {}}
              onOpenSourceMention={() => {}}
              onOpenRelatedTab={() => {}}
            />
          ) : <EmptyState icon="bolt" title="No event" body="Pick an event from the ledger."/>}
        </div>
      </section>

      <aside className="qe-fs__right">
        <header className="qe-fs__head">
          <div className="qe-fs__head-eyebrow">Review queue</div>
          <div className="qe-fs__head-title">Events</div>
          <div className="qe-fs__head-sub">{(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("events") || []).length} pending</div>
        </header>
        <div className="qe-fs__right-body">
          {(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("events") || []).map((r) => (
            <LocReviewCard key={r.id} item={r}
              onAccept={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onAcceptEventQueueItem", detail: { id: it.id } } }))}
              onDeny={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onDenyEventQueueItem", detail: { id: it.id } } }))}/>
          ))}
        </div>
      </aside>
    </div>
  );
};

// ---------------------------------------------------------------------
// QuestsPanelBody — side panel for Quests
// ---------------------------------------------------------------------
const QuestsPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [selectedId, setSelectedId] = _qe_us(panel?.selected?.id || "");
  const [search, setSearch] = _qe_us("");
  const [statusFilter, setStatusFilter] = _qe_us("all");
  const [fullScreen, setFullScreen] = _qe_us(false);
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  // Cross-tab focus: keep quests that reference the focused entity.
  const ff = panelContext?.focusedEntity || null;

  const _qsrc = (window.LoomwrightBackend?.EntityService?.listSync("quests")) || [];
  const filtered = _qsrc.filter((q) => {
    if (search && !(q.name || q.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (ff && typeof _fwReferencesEntity !== "undefined" && !_fwReferencesEntity(q, ff.id)) return false;
    return true;
  });
  const selected = _qsrc.find((q) => q.id === selectedId) || filtered[0] || null;
  const selChapterRange = selected ? [selected.data?.startChapter, selected.data?.completionChapter].filter(Boolean).join("–") : "";
  const openSource = (m) => { const cid = m && (m.chapterId || m.chapter); if (cid) { window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: cid } })); window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })); } };

  return (
    <div className="loc-body" data-ui="QuestsPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search quests…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <select className="loc-body__filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="optional">Optional</option>
            <option value="hidden">Hidden</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <Btn variant="ghost" size="sm" icon="plus"   data-callback="onCreateQuest" title="Create quest"/>
          <Btn variant="ghost" size="sm" icon="bell"   data-callback="onOpenQuestsReviewQueue" title="Review queue"/>
          <Btn variant="ghost" size="sm" icon="expand" data-callback="onOpenQuestLog" onClick={() => setFullScreen(true)} title="Open quest log"/>
        </div>
      </div>

      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Quest log</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="loc-tree">
            {filtered.map((q) => (
              <div key={q.id}
                   className={"loc-tree__row" + (q.id === selectedId ? " is-selected" : "")}
                   onClick={() => { setSelectedId(q.id); onSelectEntity && onSelectEntity({ id: q.id, type: "quests", label: q.name }); }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #8a3a4f)" }}>
                  {q.status === "completed" ? "✓" : q.status === "failed" ? "✗" : q.status === "hidden" ? "?" : "▸"}
                </span>
                <span className="loc-tree__name">{q.name || q.title}</span>
                {((q.reviewQueueCount || q.queue) || 0) > 0 && <span className="loc-tree__queue">{q.reviewQueueCount || q.queue}</span>}
              </div>
            ))}
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Quest · {selChapterRange || "—"}</div>
                  <div className="loc-body__detail-title">{selected.name || selected.title}</div>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                <QuestDetail
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenSourceMention={openSource}
                  onOpenRelatedTab={onSelectEntity}
                  onOpenFullScreen={() => setFullScreen(true)}
                />
              </div>
            </>
          ) : <EmptyState icon="scroll" title="No quest selected" body="Pick a quest to inspect."/>}
        </section>
      </div>

      {fullScreen && <QuestsFullScreen onClose={() => setFullScreen(false)}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// EventsPanelBody — side panel for Events
// ---------------------------------------------------------------------
const EventsPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [selectedId, setSelectedId] = _qe_us(panel?.selected?.id || "e1");
  const [search, setSearch] = _qe_us("");
  const [typeFilter, setTypeFilter] = _qe_us("all");
  const [fullScreen, setFullScreen] = _qe_us(false);
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  // Cross-tab focus: keep events that reference the focused entity.
  const ff = panelContext?.focusedEntity || null;

  const _esrc = (window.LoomwrightBackend?.EntityService?.listSync("events")) || [];
  const filtered = _esrc.filter((e) => {
    if (search && !(e.name || e.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && (e.data?.eventType || e.eventType) !== typeFilter) return false;
    if (ff && typeof _fwReferencesEntity !== "undefined" && !_fwReferencesEntity(e, ff.id)) return false;
    return true;
  });
  const selected = _esrc.find((e) => e.id === selectedId) || filtered[0] || null;
  const openSource = (m) => { const cid = m && (m.chapterId || m.chapter); if (cid) { window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: { chapterId: cid } })); window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })); } };

  return (
    <div className="loc-body" data-ui="EventsPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search events…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <select className="loc-body__filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Btn variant="ghost" size="sm" icon="plus"   data-callback="onCreateEvent" title="Create event"/>
          <Btn variant="ghost" size="sm" icon="bell"   data-callback="onOpenEventsReviewQueue" title="Review queue"/>
          <Btn variant="ghost" size="sm" icon="expand" data-callback="onOpenEventsLedger" onClick={() => setFullScreen(true)} title="Open ledger"/>
        </div>
      </div>

      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Event ledger</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="loc-tree">
            {filtered.map((ev) => (
              <div key={ev.id}
                   className={"loc-tree__row" + (ev.id === selectedId ? " is-selected" : "")}
                   onClick={() => { setSelectedId(ev.id); onSelectEntity && onSelectEntity({ id: ev.id, type: "events", label: ev.name || ev.title }); }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #c79545)" }}>◈</span>
                <span className="loc-tree__name">{ev.name || ev.title}</span>
                {ev.data?.chapter ? <span className="loc-tree__children">{ev.data.chapter}</span> : null}
                {((ev.reviewQueueCount || ev.queue) || 0) > 0 && <span className="loc-tree__queue">{ev.reviewQueueCount || ev.queue}</span>}
              </div>
            ))}
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Event · {selected.data?.chapter || selected.data?.eventType || "—"}</div>
                  <div className="loc-body__detail-title">{selected.name || selected.title}</div>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                <EventDetail
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenSourceMention={openSource}
                  onOpenRelatedTab={onSelectEntity}
                  onOpenFullScreen={() => setFullScreen(true)}
                />
              </div>
            </>
          ) : <EmptyState icon="bolt" title="No event selected" body="Pick an event to inspect."/>}
        </section>
      </div>

      {fullScreen && <EventsFullScreen onClose={() => setFullScreen(false)}/>}
    </div>
  );
};

// ---------------------------------------------------------------------
// Register everything
// ---------------------------------------------------------------------
window.QUESTS_DATA = QUESTS_DATA;
window.EVENTS_DATA = EVENTS_DATA;

window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};

window.RPG_DETAIL_RENDERERS = window.RPG_DETAIL_RENDERERS || {};
window.RPG_DETAIL_RENDERERS.quests = (entity, ctx) => <QuestDetail entity={entity} {...ctx}/>;
window.RPG_DETAIL_RENDERERS.events = (entity, ctx) => <EventDetail entity={entity} {...ctx}/>;

window.RPG_FILTERS = window.RPG_FILTERS || {};
window.RPG_FILTERS.quests = [
  { key: "status:active",    label: "Active" },
  { key: "status:completed", label: "Completed" },
  { key: "status:failed",    label: "Failed" },
  { key: "status:hidden",    label: "Hidden" },
  { key: "status:optional",  label: "Optional" },
  { key: "queue:any",        label: "Has review" },
  { key: "link:character",   label: "Linked to character" },
  { key: "link:item",        label: "Linked to item" },
];
window.RPG_FILTERS.events = [
  { key: "type:battle",   label: "Battle" },
  { key: "type:meeting",  label: "Meeting" },
  { key: "type:reveal",   label: "Reveal" },
  { key: "type:travel",   label: "Travel" },
  { key: "type:conflict", label: "Conflict" },
  { key: "link:relchange",label: "Has relationship change" },
  { key: "queue:any",     label: "Has review" },
];

Object.assign(window, {
  QuestDetail, EventDetail, QuestsPanelBody, EventsPanelBody,
  QuestsFullScreen, EventsFullScreen, QuestStepRow, ConsequenceChainBlock, StatusChip,
});
