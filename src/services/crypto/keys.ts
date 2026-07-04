import { db } from '@/db/schema';

/** BYOK key vault, ported from the legacy KeysService. API keys are
 * AES-GCM-encrypted with a NON-EXTRACTABLE root CryptoKey that lives
 * only in this browser's IndexedDB. Keys never appear in exports,
 * search, audit logs, or network requests other than to the provider
 * itself. */

const ROOT = '__root__';

async function getRootKey(): Promise<CryptoKey> {
  const row = await db.keys.get(ROOT);
  if (row?.cryptoKey) return row.cryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await db.keys.put({ provider: ROOT, cryptoKey: key });
  return key;
}

export async function saveApiKey(provider: string, apiKey: string): Promise<void> {
  const root = await getRootKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    root,
    new TextEncoder().encode(apiKey)
  );
  await db.keys.put({ provider, iv: [...iv], data: [...new Uint8Array(data)] });
}

export async function getApiKey(provider: string): Promise<string | null> {
  const row = await db.keys.get(provider);
  if (!row?.iv || !row.data) return null;
  try {
    const root = await getRootKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(row.iv) },
      root,
      new Uint8Array(row.data)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function hasApiKey(provider: string): Promise<boolean> {
  const row = await db.keys.get(provider);
  return !!(row?.iv && row.data);
}

export async function clearApiKey(provider: string): Promise<void> {
  await db.keys.delete(provider);
}

export async function listKeyedProviders(): Promise<string[]> {
  const rows = await db.keys.toArray();
  return rows.filter((r) => r.provider !== ROOT && r.iv && r.data).map((r) => r.provider);
}
