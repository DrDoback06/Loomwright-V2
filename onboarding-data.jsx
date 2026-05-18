// =====================================================================
// onboarding-data.jsx — Step manifest, presets, defaults.
// =====================================================================

const ONBOARDING_STEPS = [
  { id: "welcome",     n: 1,  num: "01", title: "Welcome",                short: "Project setup",       lede: "Name your project, pick a format, and tell Loomwright what you’re carrying in.", optional: false, group: "begin" },
  { id: "foundation",  n: 2,  num: "02", title: "Story Foundation",       short: "Premise & shape",     lede: "The bones of the book — premise, conflict, themes, and what it isn’t.", optional: false, group: "shape" },
  { id: "style",       n: 3,  num: "03", title: "Writing Style Profile",  short: "Style profile",       lede: "Calibrate the prose dials so AI helpers stay in your voice, not theirs.", optional: false, group: "shape" },
  { id: "voice",       n: 4,  num: "04", title: "Voice Sample",            short: "Voice / sample",      lede: "Paste a passage you’re proud of. Loomwright will mirror its rhythm, not memorise it.", optional: true,  group: "shape" },
  { id: "world",       n: 5,  num: "05", title: "World & Canon",          short: "World rules",         lede: "Set the load-bearing facts. Mark the ones AI must never bend.", optional: true,  group: "world" },
  { id: "cast",        n: 6,  num: "06", title: "Character Seeds",         short: "Cast",                lede: "Drop in starter cards. You can grow them as the book is written.", optional: true,  group: "world" },
  { id: "rpg",         n: 7,  num: "07", title: "RPG / Tracking Systems", short: "Tracking",            lede: "Decide what gets tracked: classes, stats, items, quests — or none of it.", optional: true,  group: "world" },
  { id: "plot",        n: 8,  num: "08", title: "Plot Roadmap",           short: "Roadmap",             lede: "Sketch the spine. Beats can be vague or surgical — both work.", optional: true,  group: "world" },
  { id: "manuscript",  n: 9,  num: "09", title: "Manuscript Import",      short: "Manuscript",          lede: "Start blank or carry in chapters from elsewhere.", optional: true,  group: "library" },
  { id: "references",  n: 10, num: "10", title: "References",              short: "References",          lede: "Lore docs, world bibles, prior books. Tell Loomwright how each should be used.", optional: true,  group: "library" },
  { id: "ai",          n: 11, num: "11", title: "AI & Privacy",            short: "AI & privacy",        lede: "Choose what (if anything) leaves the device. Keys are stored locally.", optional: false, group: "trust" },
  { id: "review",      n: 12, num: "12", title: "Review Rules",            short: "Review rules",        lede: "How aggressive should extraction be, and what counts as a finding?", optional: false, group: "trust" },
  { id: "workspace",   n: 13, num: "13", title: "Workspace Preferences",   short: "Workspace",           lede: "How the desk should be laid out before you sit down.", optional: false, group: "trust" },
  { id: "summary",     n: 14, num: "14", title: "Final Summary",           short: "Summary",             lede: "What Loomwright now knows. Last chance to adjust before the door opens.", optional: false, group: "begin" },
];

const FORMAT_OPTIONS    = ["Novel", "Serial", "Short Story", "Script", "RPG Campaign", "Other"];
const GENRE_OPTIONS     = ["Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Literary", "Horror", "Historical", "YA", "Adventure"];
const SUBGENRE_OPTIONS  = ["Epic", "Grimdark", "Sword & Sorcery", "Space Opera", "Cyberpunk", "Cozy", "Gothic", "Hard SF", "Urban Fantasy", "Other"];
const AUDIENCE_OPTIONS  = ["Adult", "Young Adult", "Middle Grade", "All-ages", "Mature"];
const LENGTH_OPTIONS    = ["Short (<40k)", "Standard (60–100k)", "Long (100–150k)", "Epic (150k+)", "Serialised"];
const STAGE_OPTIONS     = ["Idea", "Outlining", "First draft", "Revising", "Polishing", "Continuing series"];

const POV_OPTIONS       = ["First", "Close third", "Omniscient third", "Second", "Mixed"];
const TENSE_OPTIONS     = ["Past", "Present", "Mixed"];
const READER_EXPERIENCE = ["Page-turner", "Immersive worldbuilding", "Emotional gut-punch", "Cosy comfort", "Idea-driven", "Atmospheric"];

const TONE_WORD_PRESETS = ["austere", "wry", "haunted", "tender", "sardonic", "lyrical", "bleak", "hopeful", "feral", "elegiac", "forensic"];

const STYLE_DIALS = [
  { id: "vocab",       label: "Vocabulary",        min: 0, max: 4, marks: ["plain", "everyday", "considered", "literary", "ornate"] },
  { id: "sentence",    label: "Sentence shape",    min: 0, max: 4, marks: ["punchy", "varied", "balanced", "flowing", "long arcs"] },
  { id: "humour",      label: "Humour",            min: 0, max: 4, marks: ["none", "dry", "wry", "playful", "broad"] },
  { id: "darkness",    label: "Darkness",          min: 0, max: 4, marks: ["light", "shaded", "moody", "dark", "bleak"] },
  { id: "pacing",      label: "Pacing",            min: 0, max: 4, marks: ["meandering", "unhurried", "steady", "brisk", "breakneck"] },
  { id: "dialogue",    label: "Dialogue",          min: 0, max: 4, marks: ["sparse", "naturalistic", "balanced", "stylised", "theatrical"] },
  { id: "description", label: "Description",       min: 0, max: 4, marks: ["lean", "focused", "balanced", "lush", "operatic"] },
  { id: "violence",    label: "Violence",          min: 0, max: 4, marks: ["off-page", "implied", "moderate", "graphic", "unflinching"] },
  { id: "romance",     label: "Romance",           min: 0, max: 4, marks: ["none", "subtext", "warm", "explicit warmth", "explicit"] },
  { id: "profanity",   label: "Profanity",         min: 0, max: 4, marks: ["clean", "occasional", "moderate", "salty", "free"] },
];

const PROVIDERS = [
  { id: "openai",    label: "OpenAI",     icon: "spark",   note: "GPT-4o family, embeddings" },
  { id: "anthropic", label: "Anthropic",  icon: "drop",    note: "Claude Sonnet & Haiku" },
  { id: "other",     label: "Other / Local", icon: "gear", note: "Ollama, LM Studio, custom endpoint" },
];

const PRIVACY_CHOICES = [
  { id: "local",   icon: "lock",    title: "Local only",                  sub: "Everything stays on this device. No cloud sync, no AI calls. Best for unfinished work and IP-sensitive material.", tone: "ok" },
  { id: "cloud",   icon: "cloud",   title: "Cloud sync, no AI",            sub: "Encrypted sync between your devices. Manuscript text never reaches an LLM provider.", tone: "info" },
  { id: "byok",    icon: "sparkle", title: "Bring your own AI key",        sub: "You provide a key. Loomwright sends only what you allow per-project, and shows every outbound call.", tone: "accent" },
  { id: "managed", icon: "drop",    title: "Managed AI (coming soon)",     sub: "Hosted access without a key. Currently on the waitlist while we finalise the privacy contract.", tone: "neutral", disabled: true },
];

const ENTITY_SCAN_TYPES = [
  { id: "cast",          label: "Cast" },
  { id: "locations",     label: "Locations" },
  { id: "items",         label: "Items" },
  { id: "factions",      label: "Factions" },
  { id: "abilities",     label: "Abilities" },
  { id: "lore",          label: "Lore / canon" },
  { id: "relationships", label: "Relationships" },
  { id: "quests",        label: "Quests" },
  { id: "events",        label: "Events" },
];

const FOUNDATION_PROMPT = `You are helping me fill out a "Story Foundation" form for a writing app called Loomwright. Reply with a JSON object using ONLY these keys:
{
  "premise": "...", "logline": "...", "coreConflict": "...",
  "themes": ["...","..."], "toneWords": ["...","..."],
  "comparables": ["...","..."], "isNot": ["...","..."],
  "pov": "...", "tense": "...", "readerExperience": "..."
}
Keep prose fields under 280 characters. Tone words and themes should be 3–5 entries each. Do not include commentary outside the JSON.`;

// --- Per-step JSON prompts (for the StepJsonTools drawer) ------------
const STEP_JSON_PROMPTS = {
  welcome: `Help me fill the "Welcome / project setup" form for Loomwright. Reply with ONLY this JSON object — no commentary:
{ "title": "...", "series": "...", "book": "...", "format": "Novel|Serial|Short Story|Script|RPG Campaign|Other", "genre": "...", "subgenre": "...", "audience": "Adult|Young Adult|Middle Grade|All-ages|Mature", "length": "Short (<40k)|Standard (60–100k)|Long (100–150k)|Epic (150k+)|Serialised", "stage": "Idea|Outlining|First draft|Revising|Polishing|Continuing series" }
Leave keys blank ("") if you don't know.`,
  foundation: FOUNDATION_PROMPT,
  style: `Help me fill the "Writing Style Profile" for Loomwright. Reply with ONLY this JSON object:
{ "dials": { "vocab": 0-4, "sentence": 0-4, "pacing": 0-4, "dialogue": 0-4, "description": 0-4, "humour": 0-4, "darkness": 0-4, "tension": 0-4 }, "narratorTone": "...", "avoid": "...", "signature": "..." }
Each dial is an integer 0..4 where 0 is the leftmost mark and 4 the rightmost. No commentary.`,
  voice: `Reply with ONLY this JSON for a voice sample:
{ "sample": "<a 200–600 word original prose passage in my voice>", "primary": true, "samples": [] }
The sample should be a finished excerpt — vivid, in-scene, no headers.`,
  world: `Help me fill "World & Canon" for a writing project. Reply with ONLY this JSON:
{ "worldType": "Secondary fantasy|Historical|Contemporary|Near-future|Far-future|Other", "magic": "...", "politics": "...", "factions": "...", "locations": "...", "history": "...", "canonRules": ["...","..."], "forbidden": ["...","..."], "terminology": [{"term":"...","gloss":"..."}] }
Keep canon rules concrete and load-bearing. Forbidden = things AI must never invent.`,
  cast: `Reply with ONLY this JSON for a starting cast list:
{ "seeds": [ { "id":"c1", "name":"...", "role":"protagonist|antagonist|ally|...", "oneLiner":"...", "voice":"...", "secret":"..." } ] }
3–6 seeds is plenty.`,
  rpg: `Reply with ONLY this JSON for tracking-system preferences:
{ "template": "Genre-neutral|D&D-style|Numenera|Lite RPG|Custom", "suggestExamples": true, "toggles": { "classes": false, "races": false, "stats": false, "abilities": false, "skillTrees": false, "inventory": false, "quests": true, "factions": true } }`,
  plot: `Reply with ONLY this JSON for a plot roadmap:
{ "beats": [ { "id":"b1", "title":"...", "summary":"...", "act": 1, "chapter": null } ], "targetChapters": 28 }
6–14 beats spanning the arc. Don't include commentary.`,
  manuscript: `Reply with ONLY this JSON for manuscript import preferences:
{ "mode": "blank|paste|import", "autoDetect": true, "manualSplit": true, "reserve": true, "runExtraction": true }`,
  references: `Reply with ONLY this JSON for reference docs:
{ "items": [ { "id":"r1", "title":"...", "kind":"lore-bible|series-canon|notes|inspiration|other", "use":"reference|never-cite|style-only" } ] }`,
  ai: `Reply with ONLY this JSON for AI / privacy preferences:
{ "mode": "local|cloud|byok|managed", "provider": "openai|anthropic|other", "storeLocal": true, "allowEgress": false }`,
  review: `Reply with ONLY this JSON for review/extraction rules:
{ "autoAddHigh": true, "showAutoInQueue": true, "aggressiveness": 0-4, "falsePositive": 0-4, "missingTolerance": 0-4, "queueDisplay": "by-confidence|by-chapter|by-type", "scan": { "cast": true, "locations": true, "items": true, "factions": true, "lore": true, "stats": false, "relationships": true, "events": true } }`,
  workspace: `Reply with ONLY this JSON for workspace preferences:
{ "startTab": "writers-room|today|cast|atlas", "editorWidth": 740, "font": "Source Serif 4|EB Garamond|Cormorant Garamond", "margins": true, "panelStack": "stack-right|stack-bottom|float", "focus": false, "themeIntensity": 0-100, "chapterRail": "left|right|hidden", "authorAttribution": true, "mobileCompact": true }`,
};

Object.assign(window, {
  ONBOARDING_STEPS, FORMAT_OPTIONS, GENRE_OPTIONS, SUBGENRE_OPTIONS,
  AUDIENCE_OPTIONS, LENGTH_OPTIONS, STAGE_OPTIONS,
  POV_OPTIONS, TENSE_OPTIONS, READER_EXPERIENCE,
  TONE_WORD_PRESETS, STYLE_DIALS, PROVIDERS, PRIVACY_CHOICES,
  ENTITY_SCAN_TYPES, FOUNDATION_PROMPT, STEP_JSON_PROMPTS,
});
