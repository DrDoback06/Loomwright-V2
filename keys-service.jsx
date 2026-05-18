// =====================================================================
// keys-service.jsx — Encrypted API key storage using Web Crypto API.
//
// BYOK model: user-provided keys are encrypted with AES-GCM before
// being written to localStorage/IndexedDB. The encryption key is
// derived from a static application salt via PBKDF2. For production
// this should derive from a user passphrase; the static salt is
// suitable for the demo/local-only threat model.
//
// Public API (on window.KeysService):
//   .save(providerId, plaintextKey)  → Promise<void>
//   .load(providerId)                → Promise<string|null>
//   .remove(providerId)              → Promise<void>
//   .has(providerId)                 → Promise<boolean>
//   .listProviders()                 → Promise<string[]>
//   .clearAll()                      → Promise<void>
//   .isSupported                     → boolean
// =====================================================================

const KeysService = (() => {
  const STORE_KEY = "api_keys";
  const APP_SALT = "loomwright-v2-byok-salt";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const isSupported = !!(window.crypto && window.crypto.subtle);

  function _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function _base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function _deriveKey() {
    const keyMaterial = await crypto.subtle.importKey(
      "raw", encoder.encode(APP_SALT), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: encoder.encode("loomwright-key-derive"), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function _encrypt(plaintext) {
    if (!isSupported) {
      // Fallback: base64 encode (not secure, but functional without crypto.subtle)
      return { data: btoa(plaintext), iv: null, fallback: true };
    }
    const key = await _deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, encoder.encode(plaintext)
    );
    return {
      data: _arrayBufferToBase64(encrypted),
      iv: _arrayBufferToBase64(iv),
      fallback: false,
    };
  }

  async function _decrypt(stored) {
    if (stored.fallback) {
      return atob(stored.data);
    }
    if (!isSupported) return null;
    const key = await _deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(_base64ToArrayBuffer(stored.iv)) },
      key,
      _base64ToArrayBuffer(stored.data)
    );
    return decoder.decode(decrypted);
  }

  async function _loadStore() {
    return (await StorageService.get(STORE_KEY)) || {};
  }

  async function _saveStore(store) {
    await StorageService.set(STORE_KEY, store);
  }

  return {
    get isSupported() { return isSupported; },

    async save(providerId, plaintextKey) {
      if (!plaintextKey) return this.remove(providerId);
      const encrypted = await _encrypt(plaintextKey);
      const store = await _loadStore();
      store[providerId] = encrypted;
      await _saveStore(store);
      window.dispatchEvent(new CustomEvent("lw:keys-changed", { detail: { providerId, action: "save" } }));
    },

    async load(providerId) {
      const store = await _loadStore();
      const stored = store[providerId];
      if (!stored) return null;
      try {
        return await _decrypt(stored);
      } catch {
        console.warn("[Loomwright] Failed to decrypt key for", providerId);
        return null;
      }
    },

    async remove(providerId) {
      const store = await _loadStore();
      delete store[providerId];
      await _saveStore(store);
      window.dispatchEvent(new CustomEvent("lw:keys-changed", { detail: { providerId, action: "remove" } }));
    },

    async has(providerId) {
      const store = await _loadStore();
      return !!store[providerId];
    },

    async listProviders() {
      const store = await _loadStore();
      return Object.keys(store);
    },

    async clearAll() {
      await StorageService.remove(STORE_KEY);
      window.dispatchEvent(new CustomEvent("lw:keys-changed", { detail: { action: "clear-all" } }));
    },
  };
})();

window.KeysService = KeysService;
