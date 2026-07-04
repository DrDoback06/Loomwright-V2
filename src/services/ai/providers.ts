import { getApiKey } from '@/services/crypto/keys';

/** Provider adapters ported from the legacy AIService — real fetch
 * calls, BYOK only, no proxying. Model defaults refreshed to current
 * generations. */

export type ProviderId = 'openai' | 'openrouter' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  keyHint: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    keyHint: 'sk-…',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    needsKey: true,
    keyHint: 'sk-or-…',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-5',
    needsKey: true,
    keyHint: 'sk-ant-…',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyHint: 'AIza…',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    needsKey: false,
    keyHint: 'no key needed',
  },
};

export interface ProviderConfig {
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
}

export interface CompleteInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

function resolved(config: ProviderConfig) {
  const meta = PROVIDERS[config.provider];
  return {
    meta,
    baseUrl: (config.baseUrl?.trim() || meta.baseUrl).replace(/\/$/, ''),
    model: config.model?.trim() || meta.defaultModel,
  };
}

/** One text completion. Throws with a readable message on any failure. */
export async function complete(config: ProviderConfig, input: CompleteInput): Promise<string> {
  const { meta, baseUrl, model } = resolved(config);
  const key = meta.needsKey ? await getApiKey(config.provider) : null;
  if (meta.needsKey && !key) throw new Error(`No API key saved for ${meta.label}.`);
  const maxTokens = input.maxTokens ?? 1600;

  if (config.provider === 'anthropic') {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    return json.content?.map((c: { text?: string }) => c.text ?? '').join('') ?? '';
  }

  if (config.provider === 'gemini') {
    const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    return (
      json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      ''
    );
  }

  if (config.provider === 'ollama') {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    return json.message?.content ?? '';
  }

  // OpenAI-compatible (openai, openrouter).
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        ...(input.system ? [{ role: 'system', content: input.system }] : []),
        { role: 'user', content: input.prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

/** Cheap reachability/auth check. Sends NO manuscript text. */
export async function testConnection(config: ProviderConfig): Promise<{ ok: boolean; detail: string }> {
  try {
    const text = await complete(config, { prompt: 'Reply with the single word: ready', maxTokens: 8 });
    return { ok: true, detail: text.slice(0, 60) || 'Connected.' };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
