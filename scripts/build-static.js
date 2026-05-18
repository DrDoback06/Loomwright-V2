const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

const excludedNames = new Set([
  ".git",
  ".gitignore",
  "node_modules",
  "dist",
  "scripts",
  "package.json",
  "package-lock.json",
  "Loomwright v2.zip",
]);

function copyEntry(source, target) {
  const name = path.basename(source);
  if (excludedNames.has(name)) return;

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const child of fs.readdirSync(source)) {
      copyEntry(path.join(source, child), path.join(target, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of fs.readdirSync(root)) {
  copyEntry(path.join(root, entry), path.join(outDir, entry));
}

console.log(`Static app copied to ${path.relative(root, outDir)}/`);
