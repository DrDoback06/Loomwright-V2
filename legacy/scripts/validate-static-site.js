const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entryFiles = [
  "index.html",
  "Loomwright Shell.html",
  "Loomwright Onboarding.html",
  "Loomwright Shell-print.html",
  "Loomwright Shell.standalone-src.html",
];

const referencePattern = /\b(?:href|src)=["']([^"']+)["']/g;

function isExternal(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value)
    || value.startsWith("data:")
    || value.startsWith("mailto:")
    || value.startsWith("javascript:")
    || value.startsWith("#");
}

function normalizeReference(value) {
  const withoutFragment = value.split("#")[0].split("?")[0];
  const withoutLeadingSlash = withoutFragment.replace(/^\/+/, "");
  return decodeURIComponent(withoutLeadingSlash);
}

const missing = [];

for (const entry of entryFiles) {
  const entryPath = path.join(root, entry);
  if (!fs.existsSync(entryPath)) {
    missing.push(`${entry} (entry file is missing)`);
    continue;
  }

  const html = fs.readFileSync(entryPath, "utf8");
  for (const match of html.matchAll(referencePattern)) {
    const rawReference = match[1].trim();
    if (!rawReference || isExternal(rawReference)) continue;

    const reference = normalizeReference(rawReference);
    if (!reference) continue;

    const target = path.resolve(path.dirname(entryPath), reference);
    if (!target.startsWith(root) || !fs.existsSync(target)) {
      missing.push(`${entry} -> ${rawReference}`);
    }
  }
}

if (missing.length) {
  console.error("Missing static references:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("All checked HTML references exist.");
