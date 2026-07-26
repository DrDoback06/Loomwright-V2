import { getApiKey } from '@/services/crypto/keys';

/** Provider adapters ported from the legacy AIService — real fetch
 * calls, BYOK only, no proxying. Model defaults refreshed to current
 * generations. */

export type ProviderId =
  | 'openai'
  | 'openrouter'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'together'
  | 'deepseek'
  | 'mistral'
  | 'ollama';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  keyHint: string;
  /** Where to get a key, shown beside the field in Settings. */
  keyUrl?: string;
  /** True when the provider publishes a genuinely free tier. Surfaced in
   * Settings so "bring your own key" does not read as "bring your own bill". */
  freeTier?: boolean;
  /** One line on what the free tier actually gives you. */
  note?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    needsKey: true,
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    freeTier: true,
    note: 'Models ending in “:free” cost nothing. Try deepseek/deepseek-r1:free.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-5',
    needsKey: true,
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    freeTier: true,
    note: 'Free tier with a daily request allowance — enough for a chapter a day.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    keyHint: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    freeTier: true,
    note: 'Free tier, rate-limited per minute. Very fast — good for whole-book passes.',
  },
  together: {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    needsKey: true,
    keyHint: 'tok_…',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    freeTier: true,
    note: 'Free credits on signup, plus some models that stay free.',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    needsKey: true,
    keyHint: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
    keyHint: '…',
    keyUrl: 'https://console.mistral.ai/api-keys',
    freeTier: true,
    note: 'Free experiment tier on the smaller models.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    needsKey: false,
    keyHint: 'no key needed',
    keyUrl: 'https://ollama.com/download',
    freeTier: true,
    note: 'Runs on your own machine. Free forever, and nothing leaves the room.',
  },
};

/** Every provider whose HTTP shape is the OpenAI chat-completions API. */
const OPENAI_COMPATIBLE: ProviderId[] = [
  'openai',
  'openrouter',
  'groq',
  'together',
  'deepseek',
  'mistral',
];

export interface ProviderConfig {
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
}

export interface CompleteInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  /**
   * Ask the provider to guarantee a JSON object at the API level rather than
   * trusting the prompt to hold.
   *
   * This is the single biggest difference between a frontier model and a free
   * one on the same prompt. "Return ONLY a JSON object" is an instruction a
   * large model follows and a small one wraps in an apology — and one line of
   * preamble is the difference between a parsed chapter and "no JSON found".
   * Every provider here can enforce it; the mechanism just differs.
   */
  json?: boolean;
  /**
   * 0 for anything being parsed, higher for prose. Left unset the provider
   * default applies, which is around 1.0 — fine for a scene, actively harmful
   * for extraction, where the same chapter should give the same answer twice.
   */
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  /** The model stopped because it ran out of output budget, not because it
   * finished. A truncated JSON body is indistinguishable from a model that
   * found nothing unless somebody checks this. */
  truncated: boolean;
  model: string;
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
  return (await completeDetailed(config, input)).text;
}

/**
 * One completion, with the metadata the caller needs to trust the result.
 *
 * `complete` stays a plain string for the many call sites that only want
 * prose; anything parsing the reply should use this, because "did it finish"
 * is not answerable from the text alone.
 */
export async function completeDetailed(
  config: ProviderConfig,
  input: CompleteInput
): Promise<CompletionResult> {
  const { meta, baseUrl, model } = resolved(config);
  const key = meta.needsKey ? await getApiKey(config.provider) : null;
  if (meta.needsKey && !key) throw new Error(`No API key saved for ${meta.label}.`);
  const maxTokens = input.maxTokens ?? 1600;

  if (config.provider === 'anthropic') {
    // No response_format on this API — an assistant turn that already opens
    // the object is the equivalent, and it costs nothing.
    const prefill = input.json ? '{' : '';
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
        ...(input.temperature != null ? { temperature: input.temperature } : {}),
        messages: [
          { role: 'user', content: input.prompt },
          ...(prefill ? [{ role: 'assistant', content: prefill }] : []),
        ],
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    const body = json.content?.map((c: { text?: string }) => c.text ?? '').join('') ?? '';
    // Put the prefill back on the front — but only when the model actually
    // continued from it. A continuation opens with a key, so it starts with a
    // quote; anything else (a whole object, or prose wrapped around one) is a
    // model that ignored the prefill, and prepending a brace to that produces
    // `{Here: { … }}`, which parses as nothing at all.
    const continued = prefill && /^\s*["']/.test(body);
    return {
      text: continued ? `${prefill}${body}` : body,
      truncated: json.stop_reason === 'max_tokens',
      model,
    };
  }

  if (config.provider === 'gemini') {
    const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(input.temperature != null ? { temperature: input.temperature } : {}),
          ...(input.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    const candidate = json.candidates?.[0];
    return {
      text: candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '',
      truncated: candidate?.finishReason === 'MAX_TOKENS',
      model,
    };
  }

  if (config.provider === 'ollama') {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        ...(input.json ? { format: 'json' } : {}),
        options: {
          num_predict: maxTokens,
          ...(input.temperature != null ? { temperature: input.temperature } : {}),
        },
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
    const json = await res.json();
    return {
      text: json.message?.content ?? '',
      truncated: json.done_reason === 'length',
      model,
    };
  }

  if (!OPENAI_COMPATIBLE.includes(config.provider)) {
    throw new Error(`${meta.label} has no adapter.`);
  }
  return openAiCompatible(meta, baseUrl, model, key, input, maxTokens);
}

/**
 * The OpenAI chat-completions shape, shared by six providers.
 *
 * `response_format` is supported by the API but not by every model behind it —
 * OpenRouter in particular fronts hundreds of models and a good number reject
 * it outright. Failing the whole call over an optimisation would punish
 * exactly the free-tier users this exists to serve, so a rejection retries
 * once without it and lets the prompt do the work instead.
 */
async function openAiCompatible(
  meta: ProviderMeta,
  baseUrl: string,
  model: string,
  key: string | null,
  input: CompleteInput,
  maxTokens: number
): Promise<CompletionResult> {
  const send = async (withJsonMode: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(input.temperature != null ? { temperature: input.temperature } : {}),
        ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
      }),
    });

  let res = await send(Boolean(input.json));
  if (!res.ok && input.json) {
    const detail = await safeText(res);
    if (/response_format|json_object|not supported|unsupported/i.test(detail)) {
      res = await send(false);
    } else {
      throw new Error(`${meta.label}: ${res.status} ${detail}`);
    }
  }
  if (!res.ok) throw new Error(`${meta.label}: ${res.status} ${await safeText(res)}`);
  const json = await res.json();
  const choice = json.choices?.[0];
  return {
    text: choice?.message?.content ?? '',
    truncated: choice?.finish_reason === 'length',
    model,
  };
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
