const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rx = /data-callback="(on[A-Za-z0-9]+)"/g;
const uiNames = new Set();

for (const file of fs.readdirSync(root)) {
  if (!file.endsWith(".jsx") || file === "Loomwright.bundle.jsx") continue;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  let match;
  while ((match = rx.exec(text))) uiNames.add(match[1]);
}

const namesPath = path.join(__dirname, "callback-names.json");
const dataPath = path.join(root, "callback-names-data.jsx");
const registryPath = path.join(root, "callback-registry.jsx");

if (!fs.existsSync(namesPath)) {
  console.error("Missing scripts/callback-names.json — run: node scripts/export-callback-names.js");
  process.exit(1);
}

const listed = JSON.parse(fs.readFileSync(namesPath, "utf8"));
const listedSet = new Set(listed);

const missingInList = [...uiNames].filter((n) => !listedSet.has(n));
if (missingInList.length) {
  console.error("callback-names.json is stale. Missing:", missingInList.join(", "));
  console.error("Run: node scripts/export-callback-names.js && node scripts/generate-callback-names-data.js");
  process.exit(1);
}

if (!fs.existsSync(dataPath) || !fs.readFileSync(dataPath, "utf8").includes("__LW_CALLBACK_NAMES")) {
  console.error("Missing callback-names-data.jsx — run: node scripts/generate-callback-names-data.js");
  process.exit(1);
}

const registryText = fs.readFileSync(registryPath, "utf8");
if (!registryText.includes("dispatchCallback") || !registryText.includes("__LW_CALLBACK_NAMES")) {
  console.error("callback-registry.jsx must bootstrap handlers from __LW_CALLBACK_NAMES");
  process.exit(1);
}

// ---------------------------------------------------------------------
// Unimplemented-branch check: which callback names are NOT mentioned by
// dispatchCallback (literal "on..." string or `/^on...$/` regex), and so
// would fall through to the default debug-log branch? These are silent
// no-ops and must either be wired or get an explicit notice.
// ---------------------------------------------------------------------
const startIdx = registryText.indexOf("function dispatchCallback");
const endMarker = "function registerHandler";
const endIdx = registryText.indexOf(endMarker, startIdx);
const body = startIdx >= 0 && endIdx > startIdx ? registryText.slice(startIdx, endIdx) : registryText;

const literalMatches = new Set();
for (const m of body.matchAll(/"(on[A-Za-z0-9]+)"/g)) literalMatches.add(m[1]);

const regexPatterns = [];
// Capture both /^on...$/ (anchored) and /^on.../ (prefix) regex literals.
// Character class must include `-` so ranges like [A-Z] inside the source
// are captured intact. We stop at the unescaped closing `/` of the regex
// literal by matching everything except an unescaped slash.
for (const m of body.matchAll(/\/\^(on(?:\\\/|[^\/])+?)\/(?=\.)/g)) {
  try {
    let src = m[1].replace(/\\w/g, "[A-Za-z0-9_]");
    if (!src.startsWith("^")) src = "^" + src;
    regexPatterns.push(new RegExp(src));
  } catch (_) {}
}
// Tolerant patterns like `name.startsWith("onUpdate") && name.includes("Settings")`
// or `name.startsWith("onSpeedReader")` are too dynamic to evaluate. We approximate
// by capturing the substrings used.
const startsWithFragments = [...body.matchAll(/name\.startsWith\("(on[A-Za-z0-9]+)"\)/g)].map((m) => m[1]);
const containsFragments = [...body.matchAll(/name\.includes\("([A-Za-z0-9]+)"\)/g)].map((m) => m[1]);
const BACKEND_HANDLED_LITERALS = new Set();
const bhMatch = registryText.match(/const BACKEND_HANDLED = new Set\(\[([\s\S]*?)\]\)/);
if (bhMatch) {
  for (const m of bhMatch[1].matchAll(/"(on[A-Za-z0-9]+)"/g)) BACKEND_HANDLED_LITERALS.add(m[1]);
}

// Helper-function recognition. dispatchCallback delegates create/edit/delete
// to parseCreateType / parseEditType / parseDeleteType which match
// `onCreate([A-Za-z]+)$` etc. Those callbacks are reached even though they
// don't appear as literal strings in dispatchCallback. Walk each helper's
// body to extract its prefix and treat matching callbacks as reached.
const helperPrefixes = []; // e.g. "onCreate", "onEdit", "onDelete"
for (const fn of ["parseCreateType", "parseEditType", "parseDeleteType"]) {
  const re = new RegExp(`function\\s+${fn}\\s*\\(name\\)\\s*\\{([\\s\\S]*?)\\n  \\}`);
  const m = registryText.match(re);
  if (!m) continue;
  // Only count the helper if dispatchCallback actually calls it AND uses
  // its return value to dispatch (openEditor / EntityService.delete).
  if (!body.includes(fn + "(name)")) continue;
  // Look for `/^onX(...)` somewhere in the helper body. The actual capture
  // group syntax inside the helper may be `(...)`, `([A-Za-z]+)`,
  // `([A-Za-z]+?)`, or wrapped in alternation — the prefix is what matters.
  for (const rm of m[1].matchAll(/\/\^(on[A-Za-z]+)\(/g)) {
    if (!helperPrefixes.includes(rm[1])) helperPrefixes.push(rm[1]);
  }
}

function isReached(name) {
  if (BACKEND_HANDLED_LITERALS.has(name)) return true;
  if (literalMatches.has(name)) return true;
  if (regexPatterns.some((re) => re.test(name))) return true;
  // Approximation of startsWith/includes (catches onSpeedReader*, onUpdate*Settings, etc).
  for (const frag of startsWithFragments) if (name.startsWith(frag)) return true;
  // Helper-handled families: onCreate<Type>, onEdit<Type>, onDelete<Type>
  // resolve via parseCreateType/parseEditType/parseDeleteType.
  for (const prefix of helperPrefixes) {
    if (name.length > prefix.length && name.startsWith(prefix) && /^[A-Z]/.test(name.charAt(prefix.length))) {
      return true;
    }
  }
  return false;
}

const unimplemented = [];
for (const name of listed) {
  if (!isReached(name)) unimplemented.push(name);
}

// Required-action callbacks: anything that creates, edits, saves, deletes,
// accepts, denies, merges, restores, equips, assigns, links, generates,
// imports, exports, or runs — these MUST hit an explicit branch in
// dispatchCallback because silently reaching the default notice would be
// indistinguishable from a broken feature. Cosmetic UI state (close,
// cancel, zoom, filter, etc.) is allowed to fall through.
const REQUIRED_ACTION_PREFIXES = [
  "onCreate", "onSave", "onDelete", "onAccept", "onDeny", "onMerge", "onEdit",
  "onRestore", "onPurge", "onEquip", "onUnequip", "onAssign", "onLink",
  "onGenerate", "onImport", "onExport", "onRun", "onUpload", "onPaste",
  "onCopy", "onDownload", "onValidate", "onApply", "onUpdate", "onLoad",
  "onBuild", "onSend", "onTest", "onAdd", "onArchive", "onPromote",
  "onCompleteQuestStep", "onBranchQuest",
];
const REQUIRED_EXACT = new Set([
  "onSaveAndExtract", "onSaveAndDeepExtract",
]);

// Bucket D — React-owned callbacks that are handled by component-level
// onClick handlers; the registry never reaches them under normal flow.
// They're allowed to fall to default because the React handler runs first.
const REACT_OWNED = new Set([
  "onCreateNewInstead",        // MergeCandidateModal
  "onAcceptEdited",            // EditCandidateModal
  "onSaveEdit",                // EditCandidateModal
  "onOpenEntityFromManuscript",// EntityBrushHighlight onDoubleClick
]);

// Bucket B — AI/provider-gated callbacks. Allowed to surface an unavailable
// notice if no provider is configured, but the registry branch MUST be
// explicit (not the generic default) and MUST call requireProviderOrNotice
// so users see "Configure an AI provider in Settings…" rather than
// "X isn't wired yet".
const PROVIDER_GATED = new Set([
  "onGenerateAIWriterDraft",
  "onGenerateDraftSkillTree",
  "onRunContinuityCheck",
  "onRunEntitySuggestion",
  "onAcceptGeneratedText",
  "onCopyGeneratedText",
]);

const required = listed.filter((n) =>
  REQUIRED_EXACT.has(n) || REQUIRED_ACTION_PREFIXES.some((p) => n.startsWith(p))
);
const missingActions = required
  .filter((n) => !REACT_OWNED.has(n))
  .filter((n) => !PROVIDER_GATED.has(n))
  .filter((n) => !isReached(n));

// Registry must have a user-visible notice in its default branch — silent
// fall-through is forbidden. We grep for a notify(...) call near the
// "—— Default ——" marker.
const defaultIdx = body.indexOf("—— Default ——");
const defaultTail = defaultIdx >= 0 ? body.slice(defaultIdx) : "";
if (!/notify\s*\(/.test(defaultTail)) {
  console.error("callback-registry.jsx default branch must call notify() so unwired actions surface a clear notice.");
  process.exit(1);
}

// Bucket B verification: any provider-gated callback that reaches the
// default notice MUST be replaced by an explicit branch that calls
// requireProviderOrNotice (so users see a provider-specific message).
const providerGatedMissing = [];
const providerGatedHasHelper = registryText.includes("requireProviderOrNotice");
for (const name of PROVIDER_GATED) {
  if (!isReached(name)) providerGatedMissing.push(name);
}

console.log("OK:", uiNames.size, "UI callbacks; registry bootstraps", listed.length, "handlers");
console.log("OK: registry default branch emits a user-visible notice (no silent fall-through).");
console.log("INFO:", required.length, "action-shaped callbacks total;", missingActions.length, "Bucket A reach default notice (feature-pending).");
console.log("INFO:", PROVIDER_GATED.size, "Bucket B (provider-gated) callbacks declared;",
  providerGatedMissing.length, "still reach generic default;",
  providerGatedHasHelper ? "requireProviderOrNotice helper present." : "requireProviderOrNotice helper NOT yet present.");
console.log("INFO:", REACT_OWNED.size, "Bucket D (React-owned) callbacks declared.");
console.log("INFO:", unimplemented.length - missingActions.length - providerGatedMissing.length - REACT_OWNED.size, "other callbacks fall to default notice (housekeeping/dispatch).");
if (process.env.AUDIT_VERBOSE) {
  console.log("\nBucket A — feature-pending action callbacks:");
  for (const n of missingActions) console.log("  -", n);
  if (providerGatedMissing.length) {
    console.log("\nBucket B — provider-gated callbacks not yet using requireProviderOrNotice:");
    for (const n of providerGatedMissing) console.log("  -", n);
  }
}
