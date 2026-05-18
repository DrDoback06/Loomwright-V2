// =====================================================================
// lw-crypto.jsx — Web Crypto helpers + KeysService (Phase 10 / BYOK).
//
// API keys (OpenAI / Anthropic / etc.) are encrypted with AES-GCM before
// being persisted via StorageService. The encryption key is derived from a
// passphrase (default `loomwright-local`) via PBKDF2-SHA-256 / 100k rounds.
// In production the user should be invited to set a custom passphrase via
// Settings; the static default is suitable for the local-only design demo.
// =====================================================================

(function initLwCrypto(global) {
  const Storage = global.StorageService;
  if (!Storage) {
    // eslint-disable-next-line no-console
    console.error("[Loomwright] lw-crypto.jsx loaded before lw-storage.jsx");
    return;
  }

  const subtle = (global.crypto && global.crypto.subtle) || null;
  const PASSPHRASE_KEY = "byok_passphrase";
  const SALT_KEY = "byok_salt";
  const KEYS_KEY = "ai_keys";
  const DEFAULT_PASSPHRASE = "loomwright-local";
  const DEFAULT_SALT_LABEL = "loomwright-byok-v1";
  const PBKDF2_ITERATIONS = 100000;

  function bytesToB64(bytes) {
    let bin = "";
    const u8 = new Uint8Array(bytes);
    for (let i = 0; i < u8.byteLength; i++) bin += String.fromCharCode(u8[i]);
    return global.btoa(bin);
  }
  function b64ToBytes(b64) {
    if (typeof b64 !== "string") return new Uint8Array(0);
    const bin = global.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function _passphrase() {
    return (await Storage.get(PASSPHRASE_KEY)) || DEFAULT_PASSPHRASE;
  }
  async function _saltBytes() {
    let stored = await Storage.get(SALT_KEY);
    if (!stored) {
      const enc = new TextEncoder();
      const seed = bytesToB64(enc.encode(DEFAULT_SALT_LABEL + "::" + Date.now()));
      await Storage.set(SALT_KEY, seed);
      stored = seed;
    }
    return b64ToBytes(stored);
  }
  async function _deriveKey() {
    if (!subtle) throw new Error("Web Crypto Subtle API unavailable");
    const enc = new TextEncoder();
    const passphrase = await _passphrase();
    const material = await subtle.importKey(
      "raw", enc.encode(passphrase),
      { name: "PBKDF2" }, false, ["deriveKey"],
    );
    const salt = await _saltBytes();
    return await subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
  async function encryptString(plain) {
    if (!subtle) throw new Error("Web Crypto Subtle API unavailable");
    const enc = new TextEncoder();
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    const key = await _deriveKey();
    const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
    return { iv: bytesToB64(iv), data: bytesToB64(cipher), alg: "AES-GCM", v: 1 };
  }
  async function decryptString(envelope) {
    if (!subtle) throw new Error("Web Crypto Subtle API unavailable");
    if (!envelope || !envelope.iv || !envelope.data) return null;
    const key = await _deriveKey();
    const iv = b64ToBytes(envelope.iv);
    const cipher = b64ToBytes(envelope.data);
    try {
      const plain = await subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return new TextDecoder().decode(plain);
    } catch (e) {
      return null;
    }
  }

  const KeysService = {
    KEY: KEYS_KEY,

    /** Encrypt + persist an API key for a provider (openai/anthropic/etc). */
    async save(provider, plaintext) {
      if (!provider) throw new Error("KeysService.save: provider required");
      const all = (await Storage.get(KEYS_KEY)) || {};
      if (!plaintext) {
        delete all[provider];
      } else {
        const env = await encryptString(plaintext);
        all[provider] = { provider, envelope: env, hint: plaintext.slice(-4), updatedAt: new Date().toISOString() };
      }
      await Storage.set(KEYS_KEY, all);
      global.dispatchEvent(new CustomEvent("lw:ai-keys-changed", { detail: { provider } }));
      return true;
    },

    /** Decrypt the plaintext key for a provider; returns null if absent. */
    async load(provider) {
      const all = (await Storage.get(KEYS_KEY)) || {};
      const entry = all[provider];
      if (!entry) return null;
      return await decryptString(entry.envelope);
    },

    /** Metadata listing without exposing plaintext. */
    async listMeta() {
      const all = (await Storage.get(KEYS_KEY)) || {};
      return Object.values(all).map((entry) => ({
        provider: entry.provider,
        hint: entry.hint,
        updatedAt: entry.updatedAt,
      }));
    },

    /** Mock connection test — the BYOK promise is that no real network */
    /** request is issued by default. Returns a `pong` envelope. */
    async testConnection(provider) {
      const present = !!(await KeysService.load(provider));
      return {
        provider,
        ok: present,
        mocked: true,
        message: present ? "Local key decryption succeeded (no network test performed)." : "No key configured.",
        ts: new Date().toISOString(),
      };
    },

    async clear(provider) {
      const all = (await Storage.get(KEYS_KEY)) || {};
      if (!provider) {
        await Storage.set(KEYS_KEY, {});
      } else {
        delete all[provider];
        await Storage.set(KEYS_KEY, all);
      }
      global.dispatchEvent(new CustomEvent("lw:ai-keys-changed", { detail: { provider: provider || "*" } }));
    },

    async setPassphrase(newPassphrase) {
      const all = (await Storage.get(KEYS_KEY)) || {};
      // Re-encrypt every stored key under the new passphrase. Plaintext is
      // recovered with the *current* passphrase first, then encrypted again.
      const recovered = {};
      for (const provider of Object.keys(all)) {
        const plain = await KeysService.load(provider);
        if (plain != null) recovered[provider] = plain;
      }
      await Storage.set(PASSPHRASE_KEY, newPassphrase || DEFAULT_PASSPHRASE);
      // Rotate salt so the derived key changes even if passphrase is the same.
      const enc = new TextEncoder();
      await Storage.set(SALT_KEY, bytesToB64(enc.encode(DEFAULT_SALT_LABEL + "::" + Date.now())));
      const next = {};
      for (const [provider, plain] of Object.entries(recovered)) {
        next[provider] = {
          provider,
          envelope: await encryptString(plain),
          hint: plain.slice(-4),
          updatedAt: new Date().toISOString(),
        };
      }
      await Storage.set(KEYS_KEY, next);
      global.dispatchEvent(new CustomEvent("lw:ai-keys-changed", { detail: { provider: "*", rotated: true } }));
    },

    async replaceAll(payload) {
      await Storage.set(KEYS_KEY, payload || {});
      global.dispatchEvent(new CustomEvent("lw:ai-keys-changed", { detail: { provider: "*", restored: true } }));
    },
  };

  global.KeysService = KeysService;
  global.Loomwright = Object.assign(global.Loomwright || {}, { KeysService, encryptString, decryptString });
})(typeof window !== "undefined" ? window : globalThis);
