// =====================================================================
// entity-editor-configs-extended.jsx
//
// Adds bespoke editor configs for entity types that previously fell
// through to EE_GENERIC (Cast, Bestiary, Lore, References, Factions,
// Relationships, Timeline Events) and registers them.
//
// Also exports:
//   eeJsonTemplate(type)        — placeholder-hint skeleton for AI handoff
//   eeJsonCurrent(data)         — strip metadata, keep field values
//   eeAIFillPrompt(type, partial?) — "fill this template for me" prompt
//
// All configs follow the same shape as the originals in
// entity-editor-configs.jsx and slot into the same registry.
//
// Cast uses `layout: "sidebar"` so the editor renders a left section
// nav + scrollable detail (the rest still use stacked sections).
// =====================================================================

// ---------------------------------------------------------------------
// Helper vocabularies (extending the originals)
// ---------------------------------------------------------------------
const EE_PRONOUN_OPTIONS = ["she/her","he/him","they/them","xe/xem","ze/zir","it/its","other","unknown"];
const EE_AGE_RANGES      = ["child","teen","young adult","adult","middle-aged","elderly","ancient","timeless","unknown"];
const EE_CAST_ROLES      = ["Protagonist","Co-protagonist","Antagonist","Deuteragonist","Mentor","Foil","Ally","Rival","Love interest","Family","Background","Walk-on","Narrator","Unknown"];
const EE_VOICE_PROFILES  = ["terse","lyrical","blunt","wry","formal","colloquial","archaic","performative","clipped","quiet","over-precise","stream-of-consciousness"];

const EE_BESTIARY_TIERS  = ["mundane","minor","moderate","major","apex","mythic","unique","unknown"];
const EE_BESTIARY_DISP   = ["docile","wary","hostile","ambush","territorial","intelligent","unknowable","corrupted"];

const EE_LORE_KINDS      = ["fact","rule","prohibition","historical event","cosmology","cultural belief","prophecy","language fact","custom","other"];
const EE_LORE_BANDS      = ["canon","provisional","contradicted","retconned","working theory"];

const EE_REFERENCE_KINDS = ["website","document","image","video","audio","manuscript excerpt","style sample","canon source","research note","onboarding answer","AI instruction","other"];

const EE_FACTION_KINDS   = ["house","order","guild","clan","cult","army","council","cabal","network","movement","other"];

// ---------------------------------------------------------------------
// CAST CONFIG  (deep — 13 sections, sidebar layout)
// ---------------------------------------------------------------------
const EE_CAST = {
  type: "cast",
  icon: "user",
  displayName: "Character",
  eyebrow: "New entry · Cast",
  defaultSummary: "A person the story walks beside. Start with name + role + one sentence of who they are right now.",
  compositionRoles: ["POV","central","foil","ally","antagonist","walk-on","background"],
  layout: "sidebar",
  sections: [
    { id: "basics", title: "Basics", icon: "user", fields: [
      { id: "name",    label: "Name",    kind: "text",     required: true, placeholder: "e.g. Aelinor Vey", span: 2 },
      { id: "aliases", label: "Aliases", kind: "chips",    hint: "Nicknames, titles, code names.", span: 2 },
      { id: "summary", label: "Summary", kind: "textarea", placeholder: "One-line who-and-why.", span: 2 },
      { id: "description", label: "Biographical description", kind: "longtext", span: 2 },
    ]},
    { id: "identity", title: "Identity", icon: "spark", fields: [
      { id: "role",       label: "Role in story", kind: "pills", options: EE_CAST_ROLES, span: 2 },
      { id: "pronouns",   label: "Pronouns",      kind: "pills", options: EE_PRONOUN_OPTIONS },
      { id: "ageRange",   label: "Age range",     kind: "pills", options: EE_AGE_RANGES },
      { id: "age",        label: "Age (number)",  kind: "text",  placeholder: "31" },
      { id: "title",      label: "Title / honorific", kind: "text", placeholder: "Lady, Captain, Apprentice…" },
      { id: "species",    label: "Species / race", kind: "related", related: "races" },
      { id: "class",      label: "Class / archetype", kind: "related", related: "classes" },
      { id: "faction",    label: "Faction",       kind: "related", related: "factions" },
      { id: "occupation", label: "Occupation / profession", kind: "text" },
    ]},
    { id: "appearance", title: "Appearance", icon: "eye", fields: [
      { id: "portrait",          label: "Portrait", kind: "image-placeholder", hint: "Drop or paste a reference image." },
      { id: "physicalDescription", label: "Physical description", kind: "longtext", span: 2 },
      { id: "clothing",          label: "Clothing / equipment visual notes", kind: "textarea", span: 2 },
      { id: "distinguishingMarks", label: "Distinguishing marks", kind: "chips" },
    ]},
    { id: "voice", title: "Voice", icon: "quill", fields: [
      { id: "voiceProfile", label: "Voice profile",  kind: "pills", options: EE_VOICE_PROFILES, span: 2 },
      { id: "speechStyle",  label: "Speech style",   kind: "textarea", placeholder: "Sentence rhythm. Vocabulary. Do they swear, hedge, evade?", span: 2 },
      { id: "verbalTics",   label: "Verbal tics / repeated phrases", kind: "chips" },
      { id: "languages",    label: "Languages spoken", kind: "chips" },
    ]},
    { id: "psychology", title: "Psychology", icon: "spark", fields: [
      { id: "personality", label: "Personality",   kind: "textarea", span: 2 },
      { id: "goals",       label: "Goals",         kind: "chips",   hint: "What they want — short, declarative.", span: 2 },
      { id: "fears",       label: "Fears",         kind: "chips",   span: 2 },
      { id: "secrets",     label: "Secrets",       kind: "textarea", hint: "Reader-facing AND character-facing.", span: 2 },
      { id: "flaws",       label: "Flaws",         kind: "chips" },
      { id: "strengths",   label: "Strengths",     kind: "chips" },
      { id: "moralCompass", label: "Moral compass", kind: "text", placeholder: "Where do they draw lines?" },
    ]},
    { id: "story-role", title: "Story role", icon: "scroll", fields: [
      { id: "arcSummary",    label: "Arc summary",     kind: "longtext", placeholder: "Where do they start? Where do they end?", span: 2 },
      { id: "backstory",     label: "Backstory",       kind: "longtext", span: 2 },
      { id: "currentStatus", label: "Current status in narrative", kind: "textarea", span: 2 },
      { id: "presence",      label: "Presence",        kind: "pills",   options: ["on-stage","off-stage","mentioned only","absent","dead","missing"] },
    ]},
    { id: "rpg", title: "RPG systems", icon: "shield", fields: [
      { id: "stats",       label: "Stats",       kind: "stat-grid", hint: "Stat name · value · min · max" },
      { id: "skills",      label: "Skills",      kind: "related-multi", related: "skills" },
      { id: "abilities",   label: "Special abilities", kind: "chips" },
      { id: "statusEffects", label: "Status effects", kind: "chips" },
    ]},
    { id: "equipment", title: "Equipment", icon: "gem", fields: [
      { id: "inventory",     label: "Inventory",     kind: "related-multi", related: "items" },
      { id: "equippedItems", label: "Equipped items", kind: "related-multi", related: "items" },
      { id: "wealth",        label: "Wealth / coin", kind: "text" },
      { id: "carryingNotes", label: "Carrying notes", kind: "textarea" },
    ]},
    { id: "relationships", title: "Relationships", icon: "link", fields: [
      { id: "family",     label: "Family",      kind: "related-multi", related: "cast" },
      { id: "allies",     label: "Allies",      kind: "related-multi", related: "cast" },
      { id: "enemies",    label: "Enemies",     kind: "related-multi", related: "cast" },
      { id: "lovers",     label: "Lovers / romantic interests", kind: "related-multi", related: "cast" },
      { id: "rivals",     label: "Rivals",      kind: "related-multi", related: "cast" },
      { id: "mentors",    label: "Mentors / mentees", kind: "related-multi", related: "cast" },
      { id: "relationshipNotes", label: "Relationship notes", kind: "textarea", span: 2 },
    ]},
    { id: "timeline-locations", title: "Timeline / Locations", icon: "compass", fields: [
      { id: "currentLocation", label: "Current location", kind: "related", related: "locations" },
      { id: "homeLocation",    label: "Home location",    kind: "related", related: "locations" },
      { id: "travelHistory",   label: "Travel history",   kind: "related-multi", related: "locations" },
      { id: "firstAppearance", label: "First appearance (chapter)", kind: "text", placeholder: "Ch. 1, p. 4" },
      { id: "lastAppearance",  label: "Last appearance",  kind: "text" },
      { id: "timelineEvents",  label: "Timeline events",  kind: "related-multi", related: "events" },
      { id: "quests",          label: "Quests involved in", kind: "related-multi", related: "quests" },
    ]},
    { id: "sources", title: "Source mentions", icon: "paper", fields: [
      { id: "sourceMentions", label: "Source mentions", kind: "textarea", placeholder: "Quotes / passages where this character appears.", span: 2 },
      { id: "references",     label: "Related references", kind: "related-multi", related: "references" },
    ]},
    { id: "ai-profile", title: "AI interview profile", icon: "sparkle", fields: [
      { id: "writingInstructions", label: "Writing instructions for AI", kind: "longtext", placeholder: "How should AI handle this character? POV rules, voice notes, things to avoid.", span: 2 },
      { id: "aiInterview",         label: "AI interview / dossier",       kind: "longtext", placeholder: "Free-form Q&A or character bible.", span: 2 },
      { id: "avoidTropes",         label: "Avoid these tropes",           kind: "chips" },
      { id: "preferredScenes",     label: "Scenes that work well for them", kind: "chips" },
    ]},
    { id: "review-save", title: "Review / save", icon: "check", fields: [
      { id: "tags",          label: "Tags",            kind: "chips" },
      { id: "status",        label: "Status",          kind: "pills",  options: ["active","important","needs-review","dormant","draft","hidden","archived","deceased"] },
      { id: "doNotSuggest",  label: "Do not suggest",  kind: "toggle", hint: "Excluded from AI suggestions" },
      { id: "dormant",       label: "Dormant",         kind: "toggle", hint: "Hidden from default surfaces" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// BESTIARY CONFIG (with threatLevel, habitat, etc — field parity)
// ---------------------------------------------------------------------
const EE_BESTIARY = {
  type: "bestiary",
  icon: "claw",
  displayName: "Creature",
  eyebrow: "New entry · Bestiary",
  defaultSummary: "A creature the story can meet. Anchor it with shape, habit, and one true sentence about how it hunts or hides.",
  compositionRoles: ["featured creature","background fauna","environmental hazard"],
  sections: [
    { id: "basics", title: "Basics", fields: [
      { id: "name",      label: "Name",        kind: "text",     required: true, placeholder: "e.g. Auger Wake", span: 2 },
      { id: "aliases",   label: "Aliases",     kind: "chips",    span: 2 },
      { id: "speciesType", label: "Type / species", kind: "text", placeholder: "e.g. Spirit-beast" },
      { id: "category", label: "Category", kind: "pills", options: ["Beast","Spirit","Construct","Undead","Plant","Aberration","Hybrid","Sapient","Unique","Other"] },
      { id: "summary",   label: "Summary",     kind: "textarea", span: 2 },
      { id: "description", label: "Description", kind: "longtext", span: 2 },
    ]},
    { id: "threat", title: "Threat & encounter", fields: [
      { id: "threatLevel", label: "Threat level",  kind: "pills", options: EE_BESTIARY_TIERS, required: true },
      { id: "disposition", label: "Disposition",   kind: "pills", options: EE_BESTIARY_DISP },
      { id: "challenge",   label: "Challenge rating / notes", kind: "text", placeholder: "e.g. CR 8 / Apex pack" },
      { id: "fightOrFlight", label: "Encounter posture", kind: "text", placeholder: "Stalks · ambushes · negotiates · flees" },
    ]},
    { id: "habitat", title: "Habitat & range", fields: [
      { id: "habitat",     label: "Habitat",     kind: "text", span: 2, placeholder: "Salt flats, frostlight forest, brine caves." },
      { id: "regions",     label: "Regions",     kind: "chips", span: 2 },
      { id: "encounterLocations", label: "Encounter locations", kind: "related-multi", related: "locations", span: 2 },
      { id: "activeTimes", label: "Active times", kind: "chips", hint: "When is it active? e.g. dusk, winter, after auger-storms." },
    ]},
    { id: "behaviour", title: "Behaviour & abilities", fields: [
      { id: "behaviour",   label: "Behaviour",   kind: "textarea", span: 2 },
      { id: "abilities",   label: "Abilities / skills", kind: "chips", span: 2 },
      { id: "weaknesses",  label: "Weaknesses",  kind: "chips", span: 2 },
      { id: "diet",        label: "Diet / sustenance", kind: "text" },
      { id: "lifecycle",   label: "Lifecycle",   kind: "textarea" },
    ]},
    { id: "links", title: "Story links", fields: [
      { id: "relatedRace",      label: "Related race / species", kind: "related-multi", related: "races" },
      { id: "relatedFactions",  label: "Related factions",       kind: "related-multi", related: "factions" },
      // Distinct from `encounterLocations` (Habitat) — these are
      // lore-tied places (ancestral grounds, places of power, etc).
      { id: "relatedLocations", label: "Related locations",      kind: "related-multi", related: "locations" },
      { id: "relatedQuests",    label: "Related quests",         kind: "related-multi", related: "quests" },
      { id: "relatedEvents",    label: "Related events",         kind: "related-multi", related: "events" },
      { id: "lore",             label: "Lore / canon facts",     kind: "related-multi", related: "lore" },
    ]},
    { id: "tracking", title: "Tracking", fields: [
      { id: "chapterAppearances", label: "Chapter appearances", kind: "chips", placeholder: "Ch. 2 · Ch. 7 · Ch. 9" },
      { id: "sourceMentions",     label: "Source mentions",     kind: "textarea", span: 2 },
      { id: "references",         label: "References",          kind: "related-multi", related: "references" },
    ]},
    { id: "status", title: "Status & visibility", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","hidden","archived","extinct"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
      { id: "dormant",      label: "Dormant",        kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// LORE / CANON FACT CONFIG
// ---------------------------------------------------------------------
const EE_LORE = {
  type: "lore",
  icon: "scroll",
  displayName: "Lore / Canon",
  eyebrow: "New entry · Lore / Canon",
  defaultSummary: "A ratified fact about your world. Phrase it as a sentence the narrator could quote.",
  compositionRoles: ["canon rule","background lore","contested fact"],
  sections: [
    { id: "basics", title: "Basics", fields: [
      { id: "title",   label: "Title / statement", kind: "text",     required: true, span: 2 },
      { id: "kind",    label: "Kind",              kind: "pills",    options: EE_LORE_KINDS },
      { id: "band",    label: "Confidence band",   kind: "pills",    options: EE_LORE_BANDS },
      { id: "summary", label: "Summary",           kind: "textarea", span: 2 },
      { id: "body",    label: "Full statement",    kind: "longtext", span: 2 },
    ]},
    { id: "scope", title: "Scope & subject", fields: [
      { id: "subjects",       label: "Subjects",       kind: "chips" },
      { id: "appliesTo",      label: "Applies to",     kind: "chips", hint: "e.g. The Pale Reach · Hess Court · Augers" },
      { id: "relatedEntities", label: "Related entities", kind: "related-multi", related: "any" },
    ]},
    { id: "sources", title: "Sources", fields: [
      { id: "sourceQuotes",  label: "Source quotes",  kind: "textarea", span: 2 },
      { id: "chapters",      label: "Established in chapters", kind: "chips" },
      { id: "references",    label: "References",     kind: "related-multi", related: "references" },
    ]},
    { id: "contradictions", title: "Contradictions / review", fields: [
      { id: "contradictedBy", label: "Contradicted by", kind: "textarea", span: 2 },
      { id: "ratifiedAt",     label: "Ratified at",     kind: "text", placeholder: "Ch. 3 / Author note" },
    ]},
    { id: "status", title: "Status", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["canon","provisional","retconned","contradicted","needs-review","dormant"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// REFERENCE / RESEARCH CONFIG
// ---------------------------------------------------------------------
const EE_REFERENCE = {
  type: "references",
  icon: "paper",
  displayName: "Reference",
  eyebrow: "New entry · References / Research",
  defaultSummary: "External source material — research, style sample, canon source, or onboarding answer.",
  compositionRoles: ["style sample","canon source","research note","onboarding answer"],
  sections: [
    { id: "basics", title: "Basics", fields: [
      { id: "title",   label: "Title",   kind: "text", required: true, span: 2 },
      { id: "kind",    label: "Kind",    kind: "pills", options: EE_REFERENCE_KINDS },
      { id: "url",     label: "URL",     kind: "text", placeholder: "https://…", span: 2 },
      { id: "author",  label: "Author / source name", kind: "text" },
      { id: "summary", label: "Summary", kind: "textarea", span: 2 },
      { id: "body",    label: "Body / excerpt", kind: "longtext", span: 2 },
    ]},
    { id: "use", title: "Use in project", fields: [
      { id: "useFor",          label: "Use for",          kind: "chips", hint: "e.g. style, canon, world, research" },
      { id: "includeInAI",     label: "Include in AI context", kind: "toggle" },
      { id: "isStyleSample",   label: "Style sample",     kind: "toggle" },
      { id: "isCanonSource",   label: "Canon source",     kind: "toggle" },
      { id: "isResearchNote",  label: "Research note",    kind: "toggle", hint: "Source the manuscript draws on but doesn't have to obey." },
      { id: "isOnboardingAnswer", label: "Onboarding answer", kind: "toggle" },
    ]},
    { id: "links", title: "Links", fields: [
      { id: "relatedEntities", label: "Related entities", kind: "related-multi", related: "any" },
      { id: "tags",            label: "Tags",             kind: "chips" },
    ]},
    { id: "status", title: "Status", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// FACTION CONFIG
// ---------------------------------------------------------------------
const EE_FACTION = {
  type: "factions",
  icon: "shield",
  displayName: "Faction",
  eyebrow: "New entry · Factions",
  defaultSummary: "A group with a name, a stake, and at least one enemy.",
  compositionRoles: ["allied","opposed","neutral","contested","background"],
  sections: [
    { id: "basics", title: "Basics", fields: [
      { id: "name",    label: "Name",    kind: "text", required: true, placeholder: "e.g. The Grey Coats", span: 2 },
      { id: "aliases", label: "Aliases", kind: "chips", span: 2 },
      { id: "kind",    label: "Kind",    kind: "pills", options: EE_FACTION_KINDS },
      { id: "summary", label: "Summary", kind: "textarea", span: 2 },
      { id: "description", label: "Description", kind: "longtext", span: 2 },
    ]},
    { id: "structure", title: "Structure", fields: [
      { id: "leader",     label: "Leader",     kind: "related", related: "cast" },
      { id: "members",    label: "Notable members", kind: "related-multi", related: "cast" },
      { id: "size",       label: "Size / scale", kind: "text", placeholder: "Small · regional · imperial" },
      { id: "structure",  label: "Internal structure", kind: "textarea" },
      { id: "headquarters", label: "Headquarters", kind: "related", related: "locations" },
    ]},
    { id: "world", title: "World position", fields: [
      { id: "goals",     label: "Goals",     kind: "chips", span: 2 },
      { id: "methods",   label: "Methods",   kind: "chips" },
      { id: "ideology",  label: "Ideology",  kind: "textarea" },
      { id: "allies",    label: "Allied factions",   kind: "related-multi", related: "factions" },
      { id: "enemies",   label: "Enemy factions",    kind: "related-multi", related: "factions" },
      { id: "controlsLocations", label: "Locations under control", kind: "related-multi", related: "locations" },
    ]},
    { id: "story", title: "Story links", fields: [
      { id: "quests",  label: "Quests",  kind: "related-multi", related: "quests" },
      { id: "events",  label: "Events",  kind: "related-multi", related: "events" },
      { id: "lore",    label: "Lore",    kind: "related-multi", related: "lore" },
    ]},
    { id: "status", title: "Status", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","hidden","archived","dissolved"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// RELATIONSHIP CONFIG
// ---------------------------------------------------------------------
const EE_RELATIONSHIP = {
  type: "relationships",
  icon: "link",
  displayName: "Relationship",
  eyebrow: "New entry · Relationships",
  defaultSummary: "An edge between two characters. Name the bond, the weight, and the current temperature.",
  sections: [
    { id: "edges", title: "Edges", fields: [
      { id: "from",     label: "From character",  kind: "related", related: "cast", required: true },
      { id: "to",       label: "To character",    kind: "related", related: "cast", required: true },
      { id: "bondType", label: "Bond type",       kind: "pills", options: ["family","ally","enemy","lover","rival","mentor","debt","oath","stranger","other"] },
      { id: "directionality", label: "Directionality", kind: "pills", options: ["mutual","one-way","conflicted"] },
    ]},
    { id: "tone", title: "Tone & temperature", fields: [
      { id: "intensity",  label: "Intensity (0–100)", kind: "text", placeholder: "0–100" },
      { id: "valence",    label: "Valence",  kind: "pills", options: ["positive","negative","mixed","cold","heated","quiet"] },
      { id: "summary",    label: "Summary",  kind: "textarea", span: 2 },
      { id: "history",    label: "History",  kind: "longtext", span: 2 },
    ]},
    { id: "story", title: "Story links", fields: [
      { id: "events",  label: "Events that changed this", kind: "related-multi", related: "events" },
      { id: "quests",  label: "Related quests", kind: "related-multi", related: "quests" },
      { id: "evidence", label: "Manuscript evidence", kind: "textarea", span: 2 },
    ]},
    { id: "status", title: "Status", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","ended"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// TIMELINE EVENT CONFIG
// ---------------------------------------------------------------------
const EE_TIMELINE = {
  type: "timeline",
  icon: "clock",
  displayName: "Timeline event",
  eyebrow: "New entry · Timeline",
  defaultSummary: "A dated beat on the project timeline.",
  sections: [
    { id: "basics", title: "Basics", fields: [
      { id: "title",   label: "Title",   kind: "text", required: true, span: 2 },
      { id: "dateLabel", label: "Date / time label", kind: "text", placeholder: "Spring of the Third Reach · 1142 GS · Day 7" },
      { id: "absoluteDate", label: "Absolute date (optional)", kind: "text", placeholder: "ISO or in-world date" },
      { id: "summary", label: "Summary", kind: "textarea", span: 2 },
      { id: "body",    label: "Description", kind: "longtext", span: 2 },
    ]},
    { id: "links", title: "Linked entities", fields: [
      { id: "event",     label: "Linked event",     kind: "related",       related: "events" },
      { id: "characters", label: "Characters involved", kind: "related-multi", related: "cast" },
      { id: "locations", label: "Locations",        kind: "related-multi", related: "locations" },
      { id: "quests",    label: "Quests",           kind: "related-multi", related: "quests" },
    ]},
    { id: "placement", title: "Placement", fields: [
      { id: "chapter",     label: "Chapter",   kind: "text" },
      { id: "track",       label: "Timeline track", kind: "text", placeholder: "Main · Court · Auger" },
      { id: "isMilestone", label: "Milestone", kind: "toggle" },
      { id: "sourceMentions", label: "Source mentions", kind: "textarea", hint: "Quote / passage where this beat appears.", span: 2 },
    ]},
    { id: "status", title: "Status", fields: [
      { id: "status",       label: "Status",         kind: "pills", options: ["active","needs-review","dormant","draft"] },
      { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
    ]},
  ],
};

// ---------------------------------------------------------------------
// Register — extending the existing ENTITY_EDITOR_CONFIGS registry.
// ---------------------------------------------------------------------
(function ext() {
  const reg = window.ENTITY_EDITOR_CONFIGS || {};
  reg.cast          = EE_CAST;
  reg.bestiary      = EE_BESTIARY;
  reg.lore          = EE_LORE;
  reg.references    = EE_REFERENCE;
  reg.factions      = EE_FACTION;
  reg.relationships = EE_RELATIONSHIP;
  reg.timeline      = EE_TIMELINE;
  window.ENTITY_EDITOR_CONFIGS = reg;
})();

// =====================================================================
// JSON template generator
// =====================================================================

// Map editor field-kinds → placeholder hint strings that help an
// external AI fill them. Lists become arrays; toggles become bool.
function eeFieldHint(field) {
  const k = field.kind || "text";
  if (k === "chips" || k === "related-multi") return [];
  if (k === "toggle") return false;
  if (k === "stat-grid")    return [{ name: "Stat name", value: 0, min: 0, max: 100 }];
  if (k === "rule-list")    return [{ target: "Stat name", delta: 0, note: "e.g. Resolve +1 in cold" }];
  if (k === "dual-number")  return { x: 0, y: 0 };
  if (k === "image-placeholder") return "";
  if (k === "related")      return "";
  if (k === "number")       return 0;
  if (k === "pills" && Array.isArray(field.options) && field.options.length) {
    return field.options.slice(0, 6).join(" | ");
  }
  if (k === "longtext" || k === "textarea") {
    return field.placeholder || "";
  }
  // Plain text
  return field.placeholder || "";
}

function eeJsonTemplate(type) {
  const reg = window.ENTITY_EDITOR_CONFIGS || {};
  const cfg = reg[type] || reg.generic;
  if (!cfg) return {};
  const out = {};
  out.type = type;
  (cfg.sections || []).forEach((s) => {
    (s.fields || []).forEach((f) => {
      out[f.id] = eeFieldHint(f);
    });
  });
  return out;
}

function eeJsonCurrent(data) {
  const out = { ...(data || {}) };
  // Strip ephemeral keys
  delete out.__meta; delete out.__local; delete out._dirty;
  return out;
}

function eeAIFillPrompt(type, partial = null) {
  const reg = window.ENTITY_EDITOR_CONFIGS || {};
  const cfg = reg[type] || reg.generic;
  const displayName = (cfg && cfg.displayName) || type;
  const template = eeJsonTemplate(type);
  const requiredFields = (cfg.sections || []).flatMap((s) => (s.fields || []).filter((f) => f.required).map((f) => f.id));

  return [
    "You are helping me fill in a Loomwright " + displayName + " dossier.",
    "",
    "Return a SINGLE JSON object matching the template below.",
    "Required fields: " + (requiredFields.length ? requiredFields.join(", ") : "(none)") + ".",
    "Strings can be left empty when you don't have a strong answer.",
    "Pills marked with 'a | b | c' should resolve to one of those values.",
    partial ? "\nStart from this partial dossier:\n```json\n" + JSON.stringify(partial, null, 2) + "\n```\n" : "",
    "Template:",
    "```json",
    JSON.stringify(template, null, 2),
    "```",
    "",
    "Return only the JSON object (no commentary).",
  ].filter(Boolean).join("\n");
}

Object.assign(window, {
  EE_CAST, EE_BESTIARY, EE_LORE, EE_REFERENCE, EE_FACTION, EE_RELATIONSHIP, EE_TIMELINE,
  eeJsonTemplate, eeJsonCurrent, eeAIFillPrompt,
  EE_PRONOUN_OPTIONS, EE_AGE_RANGES, EE_CAST_ROLES, EE_VOICE_PROFILES,
  EE_BESTIARY_TIERS, EE_BESTIARY_DISP,
  EE_LORE_KINDS, EE_LORE_BANDS,
  EE_REFERENCE_KINDS, EE_FACTION_KINDS,
});
