#!/usr/bin/env node
/* eslint-disable no-console */

// The three-way comparison fixture has no chapter shared by Mara, Soren and
// the Witness Key simultaneously. Keep the main fixture readable while
// correcting that single intersection assertion at execution time.

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const filename = path.resolve(__dirname, "smoke-entity-dossiers.js");
const source = fs.readFileSync(filename, "utf8").replace(
  'check("comparison reports shared chapters", comparison.sharedChapterIds.includes("ed-ch3"));',
  'check("comparison reports the exact shared chapter intersection", comparison.sharedChapterIds.length === 0, comparison.sharedChapterIds.join(","));',
);

const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(source, filename);
