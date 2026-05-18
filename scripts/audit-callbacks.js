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

console.log("OK:", uiNames.size, "UI callbacks; registry bootstraps", listed.length, "handlers");
