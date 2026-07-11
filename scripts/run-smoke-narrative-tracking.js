#!/usr/bin/env node
/* eslint-disable no-console */

// Keep the main smoke fixture readable while compiling it with the repository's
// current SettingsService method name and final tracking-script order. This
// runner can be removed once the fixture is next rewritten wholesale.

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const filename = path.resolve(__dirname, "smoke-narrative-tracking.js");
const source = fs.readFileSync(filename, "utf8")
  .replace("B.SettingsService.setSection(\"extraction\"", "B.SettingsService.saveSection(\"extraction\"")
  .replace(
    "load(win, \"narrative-tracking-rules.jsx\");",
    "load(win, \"narrative-tracking-rules.jsx\");\n  load(win, \"narrative-tracking-pronoun-object-rules.jsx\");\n  load(win, \"narrative-tracking-pronoun-bridge.jsx\");",
  );

const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(source, filename);
