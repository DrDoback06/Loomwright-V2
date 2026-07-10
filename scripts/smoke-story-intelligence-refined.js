#!/usr/bin/env node
/* eslint-disable no-console */

// The main story-intelligence smoke suite intentionally loads the service in
// the same order as the browser. This tiny launcher appends the product-level
// refinement rules whenever the suite requests story-intelligence.jsx, so the
// tested runtime matches Loomwright Shell.html without duplicating the suite.

const fs = require("node:fs");
const path = require("node:path");

const originalReadFileSync = fs.readFileSync.bind(fs);
fs.readFileSync = function refinedReadFileSync(file, ...args) {
  const value = originalReadFileSync(file, ...args);
  if (String(file).endsWith(`${path.sep}story-intelligence.jsx`)) {
    const rulesPath = path.resolve(__dirname, "..", "story-intelligence-rules.jsx");
    const rules = originalReadFileSync(rulesPath, "utf8");
    const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
    const combined = `${text}\n\n${rules}`;
    return Buffer.isBuffer(value) ? Buffer.from(combined, "utf8") : combined;
  }
  return value;
};

require("./smoke-story-intelligence.js");
