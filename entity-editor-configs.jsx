// =====================================================================
// entity-editor-configs.jsx — Per-type editor field configurations.
//
// Each config describes the Full Editor for a single entity type.
// Shape:
//   {
//     type, icon, displayName,
//     eyebrow,                   // small label above title
//     defaultSummary,            // placeholder for AI Draft preview
//     compositionRoles,          // role-selector options (used by overlay)
//     sections: [{
//       id, title, hint?, collapsed?,
//       fields: [{
//         id, label, kind, hint?, placeholder?, options?, required?, span?,
//         related?, defaultValue?, customRender?
//       }]
//     }]
//   }
//
// Field kinds:
//   text | textarea | longtext | chips | pills | select | multiselect |
//   related | related-multi | stat-grid | slot-picker | effects-list |
//   rule-list | step-list | branch-list | location-tree | parent-picker |
//   toggle | number | dual-number | dual-text | confidence | mention-list
//
// These configs drive the FullEditor sub-component. Quick Create reads
// the first ~5 fields from the first section only.
// =====================================================================

const EE_LOCATION_TYPES = [
  "World","Realm","Continent","Country","Region","Capital City","City","Town","Village","District","Fortress","Port",
  "Forest","Jungle","Desert","Mountain","Mountain Pass","Hill","Valley","River","Lake","Swamp","Cave","Coast","Island","Glacier","Volcano","Plain","Steppe","Ruins","Battlefield","Graveyard",
  "Building","Room","Tavern / Inn","Temple / Shrine","Palace","Barracks","Prison","Library","Workshop","Shop","House","Farm","Mine","Sewer","Dungeon","Laboratory","School","Arena","Bridge","Gate","Road","Tunnel",
  "Landmark","Portal","Secret","Quest Location","Event Site","Character Home","Faction HQ","Other",
];

const EE_ITEM_TYPES = [
  "Weapon","Armour","Clothing","Tool","Key","Relic","Artefact","Document","Map","Book","Evidence","Resource","Consumable","Vehicle","Symbol","Magical","Technological","Mundane","Other",
];
const EE_EQUIPMENT_SLOTS = [
  "Head","Body","Hands","Main Hand","Off Hand","Accessory","Tool","Relic","Pack","Quest","Custom",
];
const EE_RARITY = ["Common","Uncommon","Rare","Heirloom","Legendary","Cursed","Unique"];
const EE_ITEM_CONDITIONS = ["Pristine","Used","Worn","Damaged","Broken","Destroyed"];

const EE_CLASS_CATEGORIES = ["Hereditary","Functionary","Martial","Magical","Scholar","Itinerant","Spiritual","Criminal","Noble","Common","Custom"];
const EE_CLASS_ROLES = ["Lead","Support","Skirmisher","Defender","Scholar","Diplomat","Scout","Healer","Crafter","Other"];

const EE_RACE_CATEGORIES = ["Folk","Spirit","Beast","Synthetic","Alien","Undead","Elemental","Hybrid","Other"];
const EE_RACE_TRAIT_PRESETS = ["Cold-acclimated","Long-lived","Plain-spoken","Letter-trained","Beast-bonded","Spirit-touched","Sun-blind","Saltsense","Stone-skinned"];

const EE_STAT_VALUE_TYPES = ["number","percentage","scale","label","boolean","text","custom"];
const EE_STAT_APPLIES_TO = ["Cast","Bestiary","Items","Classes","Races","Factions","Quests","Events","Custom"];
const EE_RULE_MATCH_TYPES = [
  "exact phrase","contains phrase","synonym group","numeric pattern","qualitative phrase","decrease phrase","increase phrase",
];
const EE_RULE_EFFECT_TYPES = ["increase","decrease","set","qualitative","needs-review"];
const EE_CONFIDENCE_BANDS = ["blue","green","orange","red"];

const EE_QUEST_TYPES = ["Main quest","Side quest","Promise","Mystery","Investigation","Challenge","Character goal","Faction objective","Task","Arc","Unresolved thread"];
const EE_QUEST_STATUSES = ["Not started","Active","Completed","Failed","Hidden","Future","Abandoned","Optional","Recurring","Unknown"];

const EE_EVENT_TYPES = ["Battle","Meeting","Discovery","Death","Betrayal","Travel","Trade","Duel","Ritual","Accident","Reveal","Promise","Challenge","Conflict","Celebration","Disaster","Other"];

const EE_SKILL_TYPES = ["active","passive","triggered","one-time","temporary","innate","item-granted","class-granted","race-granted","custom"];

// ---------------------------------------------------------------------
// LOCATION CONFIG
// ---------------------------------------------------------------------
const EE_LOCATION = {
  type: "locations",
  icon: "compass",
  displayName: "Location",
  eyebrow: "New entry · Atlas wiki",
  defaultSummary: "A place. Walls, gates, a name people have come to use without thinking. Begin with what a stranger would see first.",
  compositionRoles: ["scene setting","destination","origin","hidden place","conflict site","discovery site"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",      label: "Name",        kind: "text",     required: true,  placeholder: "e.g. Vraska Pass",          span: 2 },
        { id: "aliases",   label: "Aliases",     kind: "chips",    hint: "Other names this place is called by.",   span: 2 },
        { id: "kind",      label: "Type",        kind: "select",   options: EE_LOCATION_TYPES, required: true },
        { id: "customKind",label: "Custom type", kind: "text",     placeholder: "If 'Other' / refine the type",   hint: "Optional override" },
        { id: "parentId",  label: "Parent location", kind: "parent-picker", hint: "Sits inside…",                  span: 2 },
        { id: "summary",   label: "Summary",     kind: "textarea", placeholder: "One paragraph the wiki opens with.", span: 2 },
      ] },
    { id: "world", title: "World context", hint: "What does this place feel like?",
      fields: [
        { id: "description", label: "Description",      kind: "longtext", placeholder: "Sight, sound, smell. What's it like to enter?", span: 2 },
        { id: "history",     label: "History",          kind: "textarea", span: 2 },
        { id: "culture",     label: "Culture / Inhabitants", kind: "textarea" },
        { id: "climate",     label: "Climate / Terrain",     kind: "textarea" },
        { id: "danger",      label: "Danger level",     kind: "pills",    options: ["safe","watched","risky","dangerous","forbidden"] },
        { id: "currentStatus", label: "Current status", kind: "text",     placeholder: "e.g. Held by Grey Coats, under quarantine" },
      ] },
    { id: "placement", title: "Atlas placement",
      fields: [
        { id: "placed",      label: "Placed on Atlas", kind: "toggle",  hint: "Toggle on if pinned to a map." },
        { id: "coords",      label: "Coordinates",     kind: "dual-number", hint: "X / Y on the Atlas grid (decimals)" },
        { id: "atlasMap",    label: "On which Atlas map?", kind: "select", options: ["Main map (default)","Region detail","City detail"] },
        { id: "routes",      label: "Routes / Roads / Connections", kind: "chips", hint: "Other location names this place connects to" },
      ] },
    { id: "links", title: "Linked entities",
      fields: [
        { id: "characters",  label: "Characters seen here",     kind: "related-multi", related: "cast" },
        { id: "bestiary",    label: "Bestiary / Creatures here", kind: "related-multi", related: "bestiary" },
        { id: "items",       label: "Items found here",         kind: "related-multi", related: "items" },
        { id: "quests",      label: "Quests located here",      kind: "related-multi", related: "quests" },
        { id: "events",      label: "Events that happened here", kind: "related-multi", related: "events" },
        { id: "factions",    label: "Factions present",          kind: "related-multi", related: "factions" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "firstChapter", label: "First seen chapter", kind: "text", placeholder: "Ch. 1, p. 12" },
        { id: "lastChapter",  label: "Last seen chapter",  kind: "text", placeholder: "Ch. 7, p. 188" },
        // Closes the previously severe-gap: panel/dossier surfaces lean
        // on source quotes; the editor must accept them.
        { id: "sourceMentions", label: "Source mentions", kind: "textarea", hint: "Quotes / passages where this location appears.", span: 2 },
        // Schema-supported aspirational. Hierarchy can be derived from
        // parentId reverse-lookup, but explicit storage helps Atlas
        // grouping.
        { id: "childLocationIds", label: "Child locations", kind: "related-multi", related: "locations" },
        { id: "tags",         label: "Tags",               kind: "chips" },
        { id: "notes",        label: "Notes (private)",    kind: "textarea", span: 2 },
        { id: "references",   label: "References",         kind: "related-multi", related: "references", span: 2 },
      ] },
    { id: "status", title: "Status & visibility",
      fields: [
        { id: "status",       label: "Status",           kind: "pills",  options: ["active","important","needs-review","dormant","draft","hidden","archived"] },
        { id: "doNotSuggest", label: "Do not suggest",   kind: "toggle", hint: "Excluded from Today / AI Writer suggestions" },
        { id: "dormant",      label: "Dormant",          kind: "toggle", hint: "Asleep; not surfaced by Today suggestions." },
        { id: "reviewable",   label: "Allow extraction review", kind: "toggle", defaultValue: true },
      ] },
  ],
};

// ---------------------------------------------------------------------
// ITEM CONFIG
// ---------------------------------------------------------------------
const EE_ITEM = {
  type: "items",
  icon: "gem",
  displayName: "Item",
  eyebrow: "New entry · Items",
  defaultSummary: "An object the story can pick up, lose, equip, or hand to another. Anchor it with one strong physical detail.",
  compositionRoles: ["used by character","found","lost","traded","equipped","destroyed","revealed","clue"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",      label: "Name",      kind: "text",   required: true, placeholder: "e.g. Bone Auger", span: 2 },
        { id: "aliases",   label: "Aliases",   kind: "chips",  span: 2 },
        { id: "itemType",  label: "Type",      kind: "pills",  options: EE_ITEM_TYPES, required: true },
        { id: "customType",label: "Custom type", kind: "text" },
        { id: "rarity",    label: "Rarity / Tier", kind: "pills", options: EE_RARITY },
        { id: "summary",   label: "One-line summary", kind: "text", span: 2 },
        { id: "description", label: "Physical description", kind: "textarea", span: 2 },
      ] },
    { id: "physical", title: "Physical + value",
      fields: [
        { id: "icon",       label: "Icon glyph",    kind: "text",   hint: "Two letters used as a placeholder icon" },
        { id: "weight",     label: "Weight",        kind: "text",   placeholder: "e.g. 3.4 lb" },
        { id: "value",      label: "Value",         kind: "text",   placeholder: "Currency / barter / priceless" },
        { id: "condition",  label: "Condition",     kind: "pills",  options: EE_ITEM_CONDITIONS },
        { id: "durability", label: "Durability / Charges", kind: "text", placeholder: "e.g. 3 / 3" },
      ] },
    { id: "ownership", title: "Ownership & location",
      fields: [
        { id: "currentOwner",   label: "Current owner",  kind: "related", related: "cast" },
        { id: "currentLocation",label: "Current location", kind: "related", related: "locations" },
        { id: "status",         label: "Status",         kind: "pills", options: ["active","carried","equipped","stored","lost","destroyed","retired","dormant"] },
        { id: "slot",           label: "Equipment slot", kind: "slot-picker", options: EE_EQUIPMENT_SLOTS },
        { id: "carried",        label: "Carried",        kind: "toggle" },
        { id: "equipped",       label: "Equipped",       kind: "toggle" },
      ] },
    { id: "effects", title: "Properties, modifiers, effects",
      fields: [
        { id: "modifiers", label: "Stat modifiers", kind: "rule-list",
          hint: "Each row: target stat, +N/-N, note. e.g. Resolve +2" },
        { id: "affixes",   label: "Affixes / Tags", kind: "rule-list",
          hint: "Affix name + note. e.g. Salt-bitten" },
        { id: "passive",   label: "Passive effects",   kind: "effects-list", hint: "Always-on effects when carried" },
        { id: "active",    label: "Active effects",    kind: "effects-list", hint: "Triggered manually by user" },
        { id: "triggered", label: "Triggered effects", kind: "effects-list", hint: "Triggered by a specific event" },
        { id: "restrictions", label: "Use restrictions", kind: "textarea", hint: "Who can use it, when, where, why not." },
      ] },
    { id: "compatibility", title: "Compatibility",
      fields: [
        { id: "compatibleClasses", label: "Compatible classes", kind: "related-multi", related: "classes" },
        { id: "compatibleRaces",   label: "Compatible races",   kind: "related-multi", related: "races" },
        { id: "linkedStats",       label: "Linked stats",       kind: "related-multi", related: "stats" },
        { id: "linkedSkills",      label: "Linked skills",      kind: "related-multi", related: "skills" },
      ] },
    { id: "story", title: "Story links",
      fields: [
        { id: "quests",    label: "Linked quests",  kind: "related-multi", related: "quests" },
        { id: "events",    label: "Linked events",  kind: "related-multi", related: "events" },
        { id: "factions",  label: "Linked factions",kind: "related-multi", related: "factions" },
        { id: "foundLocation",     label: "Found at",   kind: "related", related: "locations" },
        { id: "lostLocation",      label: "Lost at",    kind: "related", related: "locations" },
        // Schema-supported aspirational: distinct from `lostLocation`
        // for items the story explicitly destroys vs. merely loses.
        { id: "destroyedLocation", label: "Destroyed at", kind: "related", related: "locations" },
        { id: "usedLocations",     label: "Used at",   kind: "related-multi", related: "locations" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "firstChapter", label: "First seen chapter", kind: "text" },
        { id: "lastChapter",  label: "Last seen chapter",  kind: "text" },
        { id: "ownershipHistory", label: "Ownership history", kind: "textarea", hint: "Chronological — who's held it." },
        // Schema-supported aspirational: structured trade/transfer log
        // separate from the freeform ownershipHistory above. Stores
        // [{from, to, at, chapterId, sourceMentionId}].
        { id: "tradeTransferHistory", label: "Trade / transfer log", kind: "textarea", hint: "Structured transfers — JSON array preferred." },
        { id: "sourceMentions",   label: "Source mentions",  kind: "textarea", hint: "Quotes / passages where this item appears.", span: 2 },
        { id: "tags",         label: "Tags",               kind: "chips" },
        { id: "notes",        label: "Notes (private)",    kind: "textarea", span: 2 },
        { id: "references",   label: "References",         kind: "related-multi", related: "references", span: 2 },
      ] },
    { id: "status", title: "Status & visibility",
      fields: [
        { id: "entityStatus", label: "Status flag",      kind: "pills", options: ["active","important","needs-review","dormant","draft","hidden","archived"] },
        { id: "doNotSuggest", label: "Do not suggest",   kind: "toggle" },
        { id: "dormant",      label: "Dormant",          kind: "toggle", hint: "Asleep; not surfaced by Today suggestions." },
      ] },
  ],
};

// ---------------------------------------------------------------------
// CLASS CONFIG
// ---------------------------------------------------------------------
const EE_CLASS = {
  type: "classes",
  icon: "shield",
  displayName: "Class",
  eyebrow: "New entry · Classes",
  defaultSummary: "An archetype, role, or template. What a character is professionally trained to do.",
  compositionRoles: ["class of protagonist","class of antagonist","class context","required class","class restriction"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",     label: "Name",     kind: "text",     required: true, placeholder: "e.g. Salt-bearer", span: 2 },
        { id: "aliases",  label: "Aliases",  kind: "chips",    span: 2 },
        { id: "category", label: "Category", kind: "pills",    options: EE_CLASS_CATEGORIES },
        { id: "role",     label: "Typical role", kind: "pills", options: EE_CLASS_ROLES },
        { id: "summary",  label: "Summary",  kind: "textarea", span: 2 },
        { id: "description", label: "Description", kind: "longtext", span: 2 },
      ] },
    { id: "stats", title: "Default stats & modifiers",
      fields: [
        { id: "defaultStats", label: "Default stats", kind: "stat-grid", hint: "Stat name · default value · min · max" },
        { id: "statMods",     label: "Stat modifiers vs baseline", kind: "rule-list", hint: "e.g. Resolve +1, Cunning −1" },
      ] },
    { id: "skills", title: "Skills",
      fields: [
        { id: "startingSkills", label: "Starting skills", kind: "related-multi", related: "skills" },
        { id: "allowedSkills",  label: "Allowed skills",  kind: "related-multi", related: "skills" },
        { id: "linkedSkillTrees",label: "Linked skill trees", kind: "related-multi", related: "skills" },
      ] },
    { id: "equipment", title: "Starting equipment",
      fields: [
        { id: "startingItems", label: "Starting items",  kind: "related-multi", related: "items" },
        { id: "startingSlots", label: "Default slots filled", kind: "chips", hint: "e.g. Main Hand, Body, Pack" },
      ] },
    { id: "compatibility", title: "Compatibility & restrictions",
      fields: [
        { id: "compatibleRaces", label: "Compatible races / species", kind: "related-multi", related: "races" },
        { id: "compatibleFactions", label: "Compatible factions",     kind: "related-multi", related: "factions" },
        { id: "restrictions",    label: "Restrictions",  kind: "rule-list", hint: "Rules the class must obey" },
        { id: "progressionNotes",label: "Progression notes", kind: "textarea" },
      ] },
    { id: "assigned", title: "Assigned characters",
      fields: [
        { id: "assignedCharacters", label: "Assigned characters", kind: "related-multi", related: "cast" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "firstChapter", label: "First seen", kind: "text" },
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
      ] },
  ],
};

// ---------------------------------------------------------------------
// RACE / SPECIES CONFIG
// ---------------------------------------------------------------------
const EE_RACE = {
  type: "races",
  icon: "tree",
  displayName: "Race / Species",
  eyebrow: "New entry · Races / Species",
  defaultSummary: "An ancestry, species, culture, bloodline, or kind. The shape a character is born in.",
  compositionRoles: ["protagonist race","antagonist race","background culture","contested ancestry"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",     label: "Name",     kind: "text",     required: true, placeholder: "e.g. Reach-folk", span: 2 },
        { id: "aliases",  label: "Aliases",  kind: "chips",    span: 2 },
        { id: "category", label: "Category", kind: "pills",    options: EE_RACE_CATEGORIES },
        { id: "summary",  label: "Summary",  kind: "textarea", span: 2 },
        { id: "description", label: "Description", kind: "longtext", span: 2 },
      ] },
    { id: "traits", title: "Traits & physical features",
      fields: [
        { id: "traits",         label: "Traits",         kind: "chips", hint: "Short keywords. e.g. Cold-acclimated, Saltsense" },
        { id: "physical",       label: "Physical features", kind: "textarea" },
        { id: "weaknesses",     label: "Weaknesses / Limits", kind: "rule-list" },
      ] },
    { id: "stats", title: "Default stats & innate skills",
      fields: [
        { id: "defaultStats", label: "Default stats", kind: "stat-grid" },
        { id: "innateSkills", label: "Innate skills", kind: "related-multi", related: "skills" },
      ] },
    { id: "world", title: "World position",
      fields: [
        { id: "originLocations", label: "Origin locations", kind: "related-multi", related: "locations" },
        { id: "habitat",         label: "Habitat / Region", kind: "text" },
        { id: "factions",        label: "Related factions", kind: "related-multi", related: "factions" },
        { id: "bestiary",        label: "Related bestiary entries", kind: "related-multi", related: "bestiary" },
        { id: "culture",         label: "Culture notes",    kind: "textarea", span: 2 },
        { id: "history",         label: "Timeline / History", kind: "textarea", span: 2 },
      ] },
    { id: "compatibility", title: "Compatibility",
      fields: [
        { id: "compatibleClasses", label: "Compatible classes", kind: "related-multi", related: "classes" },
        { id: "linkedCast",        label: "Linked cast", kind: "related-multi", related: "cast" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "firstChapter", label: "First seen", kind: "text" },
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
      ] },
  ],
};

// ---------------------------------------------------------------------
// STATS CONFIG
// ---------------------------------------------------------------------
const EE_STAT = {
  type: "stats",
  icon: "spark",
  displayName: "Stat",
  eyebrow: "New entry · Stats",
  defaultSummary: "A trackable value or trait. Used by extraction to record changes the manuscript implies.",
  compositionRoles: ["central stat","threshold stat","background stat"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",       label: "Name",      kind: "text",     required: true, placeholder: "e.g. Resolve", span: 2 },
        { id: "aliases",    label: "Aliases",   kind: "chips",    hint: "Other words the manuscript uses for this stat", span: 2 },
        { id: "summary",    label: "Summary",   kind: "textarea", span: 2 },
        { id: "valueType",  label: "Value type", kind: "pills",   options: EE_STAT_VALUE_TYPES, required: true },
        { id: "displayFormat", label: "Display format", kind: "text", placeholder: "e.g. 'N / 20' or 'High / Med / Low'" },
      ] },
    { id: "range", title: "Range & defaults",
      fields: [
        { id: "defaultValue", label: "Default value", kind: "text" },
        { id: "min",          label: "Minimum",       kind: "number" },
        { id: "max",          label: "Maximum",       kind: "number" },
      ] },
    { id: "scope", title: "Applies to",
      fields: [
        { id: "appliesTo", label: "Applies to entity types", kind: "multiselect", options: EE_STAT_APPLIES_TO },
      ] },
    { id: "rules", title: "Extraction phrase rules",
      hint: "Teach extraction how to translate prose into stat changes.",
      fields: [
        { id: "extractionRules", label: "Phrase rules", kind: "extraction-rule-list" },
        { id: "testPhrase",      label: "Test a phrase", kind: "test-phrase" },
      ] },
    { id: "links", title: "Linked entities",
      fields: [
        { id: "relatedSkills", label: "Related skills",  kind: "related-multi", related: "skills" },
        { id: "relatedItems",  label: "Related items",   kind: "related-multi", related: "items" },
        { id: "relatedClasses",label: "Related classes", kind: "related-multi", related: "classes" },
        { id: "relatedRaces",  label: "Related races",   kind: "related-multi", related: "races" },
        // Schema-supported aspirational: explicit list of entities this
        // stat is currently assigned to (denormalised from per-entity
        // stats arrays for fast indexing).
        { id: "assignedEntities", label: "Assigned to", kind: "related-multi", related: "cast" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        // Schema-supported aspirational: chronological log of changes.
        // Stores [{chapterId, actorId, delta, at, sourceMentionId}].
        { id: "changeHistory", label: "Change history", kind: "textarea", hint: "Chronological — when did the stat change and why. JSON array preferred.", span: 2 },
        { id: "sourceMentions", label: "Source mentions", kind: "textarea", hint: "Quotes / passages where this stat is mentioned.", span: 2 },
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
        { id: "references",   label: "References", kind: "related-multi", related: "references", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
        { id: "dormant",      label: "Dormant",        kind: "toggle", hint: "Asleep; not surfaced by Today suggestions." },
      ] },
  ],
};

// ---------------------------------------------------------------------
// QUEST CONFIG
// ---------------------------------------------------------------------
const EE_QUEST = {
  type: "quests",
  icon: "scroll",
  displayName: "Quest",
  eyebrow: "New entry · Quests",
  defaultSummary: "An ongoing thread the story has not yet closed. A promise the manuscript made.",
  compositionRoles: ["started","progressed","completed","failed","revealed","complicated"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "title",     label: "Title",   kind: "text", required: true, placeholder: "e.g. Brec's Letter", span: 2 },
        { id: "aliases",   label: "Aliases", kind: "chips", span: 2 },
        { id: "questType", label: "Type",    kind: "pills", options: EE_QUEST_TYPES },
        { id: "status",    label: "Status",  kind: "pills", options: EE_QUEST_STATUSES },
        { id: "summary",   label: "Summary", kind: "textarea", span: 2 },
        { id: "goal",      label: "Goal",    kind: "textarea", span: 2, hint: "What 'success' looks like" },
      ] },
    { id: "participants", title: "Participants",
      fields: [
        { id: "owner",        label: "Primary actor / owner", kind: "related", related: "cast" },
        { id: "participants", label: "Participants", kind: "related-multi", related: "cast" },
        { id: "factions",     label: "Factions involved", kind: "related-multi", related: "factions" },
      ] },
    { id: "structure", title: "Steps & branches",
      fields: [
        { id: "steps",      label: "Steps",    kind: "step-list", hint: "Sequential beats of the quest" },
        { id: "branches",   label: "Branches", kind: "branch-list", hint: "Optional / divergent paths" },
        { id: "conditions", label: "Required conditions", kind: "rule-list" },
      ] },
    { id: "outcomes", title: "Outcomes & consequences",
      fields: [
        { id: "outcomes",  label: "Possible outcomes", kind: "rule-list" },
        { id: "rewards",   label: "Rewards / consequences", kind: "textarea" },
        { id: "relatedEvents", label: "Related events", kind: "related-multi", related: "events" },
      ] },
    { id: "world", title: "World links",
      fields: [
        { id: "locations",   label: "Locations", kind: "related-multi", related: "locations" },
        { id: "items",       label: "Items involved", kind: "related-multi", related: "items" },
        { id: "atlasRoute",  label: "Atlas route nodes (in order)", kind: "related-multi", related: "locations", hint: "Travel order" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "startChapter",      label: "Start chapter",      kind: "text" },
        { id: "completionChapter", label: "Completion chapter", kind: "text" },
        { id: "timelinePosition",  label: "Timeline placement",  kind: "text", placeholder: "e.g. Year 3 / Spring" },
        { id: "sourceMentions",    label: "Source mentions",    kind: "textarea", hint: "Quotes / passages where the quest is referenced.", span: 2 },
        { id: "tags",              label: "Tags",                kind: "chips" },
        { id: "notes",             label: "Notes",               kind: "textarea", span: 2 },
        { id: "references",        label: "References",          kind: "related-multi", related: "references", span: 2 },
      ] },
    { id: "status", title: "Status & visibility",
      fields: [
        { id: "entityStatus", label: "Entity status",  kind: "pills", options: ["active","important","needs-review","unresolved","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
        { id: "dormant",      label: "Dormant",        kind: "toggle", hint: "Asleep; not surfaced by Today suggestions." },
      ] },
  ],
};

// ---------------------------------------------------------------------
// EVENT CONFIG
// ---------------------------------------------------------------------
const EE_EVENT = {
  type: "events",
  icon: "bolt",
  displayName: "Event",
  eyebrow: "New entry · Events",
  defaultSummary: "A single happening at a specific time and place. The kind of thing the timeline pins.",
  compositionRoles: ["cause","consequence","current happening","flashback","reveal"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "title",     label: "Title",   kind: "text", required: true, placeholder: "e.g. The Auger Wake", span: 2 },
        { id: "aliases",   label: "Aliases", kind: "chips", span: 2 },
        { id: "eventType", label: "Type",    kind: "pills", options: EE_EVENT_TYPES },
        { id: "summary",   label: "Summary", kind: "textarea", span: 2 },
      ] },
    { id: "when", title: "When + where",
      fields: [
        { id: "chapter",    label: "Chapter / Date / Time", kind: "text", placeholder: "Ch. 5 — last week" },
        { id: "timelinePosition", label: "Timeline placement", kind: "text", placeholder: "Year 3 / Spring / Day 12" },
        { id: "location",   label: "Location", kind: "related", related: "locations" },
        { id: "atlasPlacement", label: "Atlas placement", kind: "text", placeholder: "Pinned to map?" },
      ] },
    { id: "chain", title: "Cause → Event → Consequence",
      hint: "Articulate the chain so the timeline can follow it.",
      fields: [
        { id: "cause",            label: "Cause",            kind: "textarea", hint: "What made it happen?" },
        { id: "immediateOutcome", label: "Immediate outcome", kind: "textarea" },
        { id: "longTermConsequence", label: "Long-term consequence", kind: "textarea" },
      ] },
    { id: "participants", title: "Participants",
      fields: [
        { id: "participants", label: "Cast involved", kind: "related-multi", related: "cast" },
        { id: "factions",     label: "Factions involved", kind: "related-multi", related: "factions" },
      ] },
    { id: "changes", title: "State changes",
      hint: "What this event mutated.",
      fields: [
        { id: "relationshipChanges", label: "Relationship changes", kind: "rule-list", hint: "A ↔ B / type / delta" },
        { id: "characterStateChanges", label: "Character state changes", kind: "rule-list" },
        { id: "itemStateChanges", label: "Item state changes", kind: "rule-list" },
        { id: "locationChanges",  label: "Location changes",  kind: "rule-list" },
        { id: "statChanges",      label: "Stat changes",      kind: "rule-list" },
      ] },
    { id: "links", title: "Story links",
      fields: [
        { id: "relatedQuests", label: "Related quests", kind: "related-multi", related: "quests" },
        { id: "relatedItems",  label: "Related items",  kind: "related-multi", related: "items" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "sourceMentions", label: "Source mentions", kind: "textarea", hint: "Manuscript passages where this event surfaces.", span: 2 },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
        { id: "references",   label: "References", kind: "related-multi", related: "references", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","contradiction","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
        { id: "dormant",      label: "Dormant",        kind: "toggle", hint: "Asleep; not surfaced by Today suggestions." },
      ] },
  ],
};

// ---------------------------------------------------------------------
// SKILL CONFIG (consolidated from old Abilities)
// ---------------------------------------------------------------------
const EE_SKILL = {
  type: "skills",
  icon: "spark",
  displayName: "Skill",
  eyebrow: "New entry · Skill Trees / Skills",
  defaultSummary: "A reusable action, trait, power, talent, technique, spell, or learned ability. Anything a character does that's worth tracking.",
  compositionRoles: ["used skill","required skill","newly acquired","newly upgraded"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",       label: "Name",      kind: "text", required: true, placeholder: "e.g. Court tongue", span: 2 },
        { id: "aliases",    label: "Aliases",   kind: "chips", span: 2 },
        { id: "skillType",  label: "Skill type", kind: "pills", options: EE_SKILL_TYPES, required: true },
        { id: "cost",       label: "Cost",      kind: "text", placeholder: "—, mana, charge, page…" },
        { id: "cooldown",   label: "Cooldown",  kind: "text", placeholder: "None / per scene / per chapter" },
        { id: "limit",      label: "Limit",     kind: "text" },
        { id: "summary",    label: "Summary",   kind: "textarea", span: 2 },
        { id: "description", label: "Description", kind: "longtext", span: 2 },
      ] },
    { id: "requirements", title: "Requirements",
      fields: [
        { id: "requirements", label: "Requirements", kind: "rule-list" },
      ] },
    { id: "effects", title: "Effects",
      fields: [
        { id: "effects", label: "Effects", kind: "effects-list" },
      ] },
    { id: "progression", title: "Upgrade / progression",
      fields: [
        { id: "upgradePath", label: "Upgrade path", kind: "rule-list", hint: "Tier / name / effect" },
      ] },
    { id: "links", title: "Linked entities",
      fields: [
        { id: "linkedStats",    label: "Linked stats",    kind: "related-multi", related: "stats" },
        { id: "linkedClasses",  label: "Linked classes",  kind: "related-multi", related: "classes" },
        { id: "linkedRaces",    label: "Linked races",    kind: "related-multi", related: "races" },
        { id: "linkedItems",    label: "Linked items",    kind: "related-multi", related: "items" },
        { id: "assignedCast",   label: "Assigned characters", kind: "related-multi", related: "cast" },
        { id: "skillTreeNodes", label: "Skill tree nodes", kind: "chips", hint: "Tree name + node label" },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "firstChapter", label: "First seen", kind: "text" },
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
      ] },
  ],
};

// ---------------------------------------------------------------------
// Generic fallback (used for entity types without a bespoke config)
// ---------------------------------------------------------------------
const EE_GENERIC = {
  type: "generic",
  icon: "paper",
  displayName: "Entity",
  eyebrow: "New entry",
  defaultSummary: "A new entry in the project. Begin with the name and a single sentence of summary.",
  compositionRoles: ["referenced","central","background"],
  sections: [
    { id: "basics", title: "Basics",
      fields: [
        { id: "name",    label: "Name",    kind: "text",     required: true, span: 2 },
        { id: "aliases", label: "Aliases", kind: "chips",    span: 2 },
        { id: "summary", label: "Summary", kind: "textarea", span: 2 },
        { id: "description", label: "Description", kind: "longtext", span: 2 },
      ] },
    { id: "tracking", title: "Tracking",
      fields: [
        { id: "tags",         label: "Tags",       kind: "chips" },
        { id: "notes",        label: "Notes",      kind: "textarea", span: 2 },
      ] },
    { id: "status", title: "Status",
      fields: [
        { id: "status",       label: "Status",         kind: "pills", options: ["active","important","needs-review","dormant","draft","archived"] },
        { id: "doNotSuggest", label: "Do not suggest", kind: "toggle" },
      ] },
  ],
};

// ---------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------
const ENTITY_EDITOR_CONFIGS = {
  locations: EE_LOCATION,
  items:     EE_ITEM,
  classes:   EE_CLASS,
  races:     EE_RACE,
  stats:     EE_STAT,
  quests:    EE_QUEST,
  events:    EE_EVENT,
  skills:    EE_SKILL,
  abilities: EE_SKILL,           // abilities route to the skill editor
  generic:   EE_GENERIC,
};

// ---------------------------------------------------------------------
// AI Draft canned previews — fixed canned drafts shown after "Generate".
// ---------------------------------------------------------------------
const EE_AI_DRAFTS = {
  locations: {
    name: "Brittlewood Track",
    aliases: ["the Brittlewood", "salt track"],
    kind: "Forest",
    summary: "A frostbitten stand of spruce north of the Vraska road. Locals say letters left under the third bridge stay until someone needs them.",
    description: "Brittlewood is the kind of place names move through more than people. The track is a thin road of split logs over winter mud, hemmed by black spruce that have learnt to lean against the wind. In daylight the forest reads as quiet; after dusk it begins to listen.",
    danger: "watched",
    history: "Once Vey hunting-ground; ceded to the Reach in the Salt Treaty.",
    tags: ["winter","north-road","liminal"],
  },
  items: {
    name: "Vraska Lantern",
    aliases: ["pass-lantern", "Brec's lantern"],
    itemType: "Tool",
    rarity: "Uncommon",
    summary: "A heavy iron-and-glass lantern Brec carries through the pass. Burns long, never cleanly.",
    description: "Iron cage, four glass panels, brass handle scoured to a dull gold. Smells of fish-oil and pitch even cold. The wick is too long, deliberately — Brec uses the smoke as a tracking sign.",
    modifiers: [{ target: "Perception", delta: +1, note: "Far sight at night" }],
    affixes:   [{ name: "Smoke-tracker", note: "Leaves a readable trail for half a mile in still air" }],
    slot: "Off Hand",
  },
  classes: {
    name: "Glass-reader",
    category: "Scholar",
    role: "Scholar",
    summary: "Court archivists trained to read the Glass Court's layered ledgers and call out the lines no one wanted read.",
    description: "Glass-readers are made, not born. Twelve years in the Glass Court archives, three more on the rotation between Hess and Vey holds. Their badge of office is a single etched lens, worn on a chain.",
    defaultStats: [{ name: "Cunning", value: 14, min: 1, max: 20 }, { name: "Standing", value: 11, min: 1, max: 20 }],
  },
  races: {
    name: "Glass-touched",
    category: "Hybrid",
    summary: "Hess-born marked by the Court's glass-ritual; one eye is paler than the other, and they read written word better than the spoken.",
    traits: ["Letter-trained","Slow to warm","Glass-eye"],
    description: "A small population (perhaps three in a hundred Hess-born) whose change is mild but visible. They tend toward archive work and toward unhappy marriages with anyone who does not know their letters.",
  },
  stats: {
    name: "Grief",
    summary: "A scale value tracking the weight a character carries from losses inflicted by the manuscript. Affects available actions in private scenes.",
    valueType: "scale",
    extractionRules: [
      { phrase: "could not bring herself to", treatedAs: "Qualitative grief +1", kind: "qual",     review: true,  effect: "increase", confidence: "orange" },
      { phrase: "did not look at the chair",  treatedAs: "Qualitative grief +1", kind: "qual",     review: true,  effect: "increase", confidence: "orange" },
      { phrase: "wept openly",                treatedAs: "Qualitative grief +2", kind: "qual",     review: true,  effect: "increase", confidence: "green"  },
    ],
  },
  quests: {
    title: "The Salt-bitten Cloak",
    questType: "Mystery",
    status: "Active",
    summary: "Whose cloak did Brec find on the Vraska road? The garment fits no one in Pale Reach Hold.",
    goal: "Identify the cloak's owner before the next Court audience.",
    steps: [
      { title: "Find the cloak", chapter: 5, location: "Vraska Pass" },
      { title: "Wash and inspect", chapter: 5 },
      { title: "Match against ledger", chapter: 6 },
      { title: "Confront the owner", chapter: 7 },
    ],
  },
  events: {
    title: "Brec's Letter Arrives",
    eventType: "Reveal",
    summary: "Captain Brec's sealed letter arrives at Pale Reach Hold three nights before the Court audience.",
    cause: "Brec sealed the letter at Brittlewood after losing the Hess Letter-key.",
    immediateOutcome: "Aelinor does not sleep for three nights and packs the Auger for the Court.",
    longTermConsequence: "Sets the chain that ends in the Vraska break.",
  },
  skills: {
    name: "Salt-walker",
    skillType: "passive",
    summary: "A learned step that lets the carrier cross salted causeways without harm.",
    description: "Not a spell, not a gift. The body comes to know which planks of a causeway the salt loves and which it ignores, and after a winter the feet move on their own.",
    effects: [{ trigger: "On entering causeway", effect: "Ignore terrain penalty" }],
    requirements: ["At least one winter spent on the Reach."],
  },
};

Object.assign(window, {
  ENTITY_EDITOR_CONFIGS, EE_AI_DRAFTS,
  EE_LOCATION_TYPES, EE_ITEM_TYPES, EE_EQUIPMENT_SLOTS, EE_RARITY,
  EE_CLASS_CATEGORIES, EE_RACE_CATEGORIES, EE_STAT_VALUE_TYPES,
  EE_QUEST_TYPES, EE_QUEST_STATUSES, EE_EVENT_TYPES, EE_SKILL_TYPES,
  EE_RULE_MATCH_TYPES, EE_RULE_EFFECT_TYPES, EE_CONFIDENCE_BANDS,
});
