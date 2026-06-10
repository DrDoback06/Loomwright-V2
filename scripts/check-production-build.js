#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/check-production-build.js
 *
 * Asserts the production build in dist/ is real and self-contained:
 *   - dist/loomwright.bundle.js exists and is non-trivial
 *   - bundle contains no `text/babel` markers (it's precompiled)
 *   - dist/index.html references the bundle
 *   - dist/index.html does NOT load babel.min.js
 *   - dist/index.html has no unpkg / CDN runtime <script src>
 *   - vendored React is present in dist/vendor
 *   - all CSS referenced by dist/index.html exists in dist/
 *
 * Exits non-zero on any failure. Run after `npm run build`.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "dist");

const failures = [];
function check(label, ok) {
  console.log(ok ? "  OK  " : " FAIL ", label);
  if (!ok) failures.push(label);
}

const bundlePath = path.join(OUT, "loomwright.bundle.js");
const indexPath = path.join(OUT, "index.html");

const hasBundle = fs.existsSync(bundlePath);
check("dist/loomwright.bundle.js exists", hasBundle);

if (hasBundle) {
  const bundle = fs.readFileSync(bundlePath, "utf8");
  check("bundle is non-trivial (> 200 KB)", bundle.length > 200 * 1024);
  check("bundle contains no text/babel script markers", bundle.indexOf("text/babel") === -1);
  check("bundle was precompiled (contains React.createElement)", bundle.indexOf("React.createElement") !== -1);
  check("bundle exposes the backend (LoomwrightBackend present)", bundle.indexOf("LoomwrightBackend") !== -1);
}

const hasIndex = fs.existsSync(indexPath);
check("dist/index.html exists", hasIndex);

if (hasIndex) {
  const idx = fs.readFileSync(indexPath, "utf8");
  check("index.html references loomwright.bundle.js", idx.indexOf("loomwright.bundle.js") !== -1);
  check("index.html does NOT load babel.min.js", idx.indexOf("babel.min.js") === -1);
  check("index.html has no text/babel scripts", idx.indexOf("text/babel") === -1);
  check("index.html has no unpkg/CDN runtime script src", !/<script[^>]+src="https?:\/\/[^"]*(unpkg|cdn|jsdelivr)/i.test(idx));
  check("index.html loads vendored React", idx.indexOf("vendor/react.development.js") !== -1);
  check("index.html mounts #root", idx.indexOf('id="root"') !== -1);

  // Every local stylesheet referenced must exist in dist.
  const cssRefs = [...idx.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^https?:\/\//.test(h));
  let allCss = true;
  for (const href of cssRefs) {
    if (!fs.existsSync(path.join(OUT, href))) { allCss = false; console.log("       missing CSS:", href); }
  }
  check(`all ${cssRefs.length} referenced stylesheets present in dist/`, allCss);
}

check("dist/vendor/react.development.js present", fs.existsSync(path.join(OUT, "vendor", "react.development.js")));
check("dist/vendor/react-dom.development.js present", fs.existsSync(path.join(OUT, "vendor", "react-dom.development.js")));
check("dist/ does NOT ship babel.min.js", !fs.existsSync(path.join(OUT, "vendor", "babel.min.js")));

// PWA layer.
if (hasIndex) {
  const idx = fs.readFileSync(indexPath, "utf8");
  check("index.html uses a responsive viewport", idx.indexOf("width=device-width") !== -1);
  check("index.html links manifest.json", idx.indexOf('rel="manifest"') !== -1);
  check("index.html registers the service worker", idx.indexOf("serviceWorker") !== -1);
}
check("dist/manifest.json present", fs.existsSync(path.join(OUT, "manifest.json")));
check("dist/icons/loomwright-icon.svg present", fs.existsSync(path.join(OUT, "icons", "loomwright-icon.svg")));
const swPath = path.join(OUT, "sw.js");
check("dist/sw.js present", fs.existsSync(swPath));
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");
  check("sw.js placeholders substituted (stamped cache name)", sw.indexOf("__LW_CACHE_NAME__") === -1 && sw.indexOf("__LW_ASSETS__") === -1 && /loomwright-\d{4}/.test(sw));
}

console.log("");
if (failures.length) {
  console.log(`FAIL — ${failures.length} production-build check(s) failed.`);
  process.exit(1);
}
console.log("Production build checks passed.");
