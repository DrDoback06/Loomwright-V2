import { db } from '@/db/schema';
import type { ProviderConfig, ProviderId } from './providers';

/** Per-project AI settings (never contains key material). */
export interface AiSettings {
  /** local-only blocks every external AI call. */
  mode: 'local-only' | 'byok';
  defaultProvider: ProviderId | null;
  /** Optional per-provider base URL / model overrides. */
  overrides: Partial<Record<ProviderId, { baseUrl?: string; model?: string }>>;
  /** Privacy guard: 'ask' confirms before manuscript text leaves. */
  privacy: 'ask' | 'always-allow';
}

const DEFAULTS: AiSettings = {
  mode: 'byok',
  defaultProvider: null,
  overrides: {},
  privacy: 'ask',
};

const key = (projectId: string) => `${projectId}:ai`;

export async function getAiSettings(projectId: string): Promise<AiSettings> {
  const row = await db.settings.get(key(projectId));
  return { ...DEFAULTS, ...((row?.value as Partial<AiSettings>) ?? {}) };
}

export async function saveAiSettings(projectId: string, patch: Partial<AiSettings>): Promise<void> {
  const current = await getAiSettings(projectId);
  await db.settings.put({ key: key(projectId), value: { ...current, ...patch } });
}

/** Resolve the active provider config, or null when AI is unavailable
 * (local-only mode / nothing configured). */
export async function resolveProvider(projectId: string): Promise<ProviderConfig | null> {
  const settings = await getAiSettings(projectId);
  if (settings.mode === 'local-only' || !settings.defaultProvider) return null;
  const override = settings.overrides[settings.defaultProvider] ?? {};
  return { provider: settings.defaultProvider, ...override };
}
