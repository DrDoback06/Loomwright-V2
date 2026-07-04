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

const CACHE_NAME = "__LW_CACHE_NAME__";
const ASSETS = __LW_ASSETS__;

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
