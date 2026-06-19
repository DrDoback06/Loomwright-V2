// =====================================================================
// sw.js — Loomwright production service worker (offline shell).
//
// Cache-first over the precompiled dist asset list. The build script
// (scripts/build-production.js) copies this file into dist/ and replaces
// the two placeholders below with the real build stamp + asset list, so
// every deploy gets its own cache and stale assets are dropped on
// activate. Never registered in dev (vite serves source).
// =====================================================================

/* eslint-disable no-restricted-globals */

const CACHE_NAME = "loomwright-2026-06-19T03-55-19-672Z";
const ASSETS = [
  "./index.html",
  "loomwright.bundle.js",
  "manifest.json",
  "icons/loomwright-icon.svg",
  "vendor/react.development.js",
  "vendor/react-dom.development.js",
  "tokens.css",
  "components.css",
  "writers-room.css",
  "extraction-review.css",
  "cast.css",
  "entity-framework.css",
  "atlas.css",
  "atlas-quick.css",
  "atlas-focus.css",
  "skill-trees.css",
  "relationships.css",
  "timeline.css",
  "lore-references.css",
  "upgrades.css",
  "entity-drag.css",
  "entity-editor.css",
  "composition-overlay.css",
  "home.css",
  "full-workspaces.css",
  "speed-reader.css",
  "random-tables.css",
  "ai-handoff.css",
  "settings-rich.css",
  "onboarding.css",
  "onboarding-intel.css",
  "help.css",
  "mobile.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("loomwright-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // BYOK AI calls etc. pass through

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Opportunistically cache same-origin GETs that succeed.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Offline navigation falls back to the app shell.
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
