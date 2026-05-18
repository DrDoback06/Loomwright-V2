const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rx = /data-callback="(on[A-Za-z0-9]+)"/g;
const names = new Set();

for (const file of fs.readdirSync(root)) {
  if (!file.endsWith(".jsx") || file === "Loomwright.bundle.jsx") continue;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  let match;
  while ((match = rx.exec(text))) names.add(match[1]);
}

console.log([...names].sort().join("\n"));
console.error("count:", names.size);
