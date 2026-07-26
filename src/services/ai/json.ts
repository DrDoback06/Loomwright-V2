import { completeDetailed, type CompleteInput, type ProviderConfig } from './providers';

/**
 * The one way the app asks a model for JSON.
 *
 * Every JSON path used to be: one call, one `JSON.parse`, and on failure the
 * entire pass was lost with a message that said "no JSON found" — which reads
 * as "your chapter had nothing in it" and is usually a lie. Three things go
 * wrong, and they need different answers:
 *
 * - **Preamble.** "Sure! Here's the JSON:" before the object. Fixed at the
 *   API level by {@link CompleteInput.json}, and by tolerant parsing here.
 * - **Malformation.** A trailing comma, a smart quote, an unclosed brace.
 *   Small models do this constantly and fix it immediately when told. One
 *   repair round-trip converts most of these, which is the whole difference
 *   between a free key being usable and being a toy.
 * - **Truncation.** The reply ran out of output budget. Re-asking is pointless
 *   — it will truncate again at the same place — so this is reported honestly
 *   and the caller shrinks the request instead.
 */

export interface JsonCallResult {
  /** Parsed object, or null when nothing usable came back. */
  value: unknown | null;
  /** The final raw reply, for the "show me what it actually said" affordance. */
  raw: string;
  /** Why it failed, phrased for a person. Absent on success. */
  error?: string;
  /** A repair round-trip was needed to get here. */
  repaired: boolean;
  /** The model hit its output cap. Ask for less, not again. */
  truncated: boolean;
}

/**
 * Pull an object out of arbitrary model output.
 *
 * Handles fences, prose wrappers, and the two malformations that account for
 * most small-model failures: trailing commas before a closing brace, and
 * curly quotes where JSON needs straight ones. Repairing locally is better
 * than a round-trip — it is instant and costs no tokens.
 */
export function parseJsonLoose(text: string): unknown | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const bodies = [fenced?.[1], trimmed].filter((b): b is string => Boolean(b));

  for (const body of bodies) {
    for (const [open, close] of [
      ['{', '}'],
      ['[', ']'],
    ] as const) {
      const start = body.indexOf(open);
      const end = body.lastIndexOf(close);
      if (start === -1 || end <= start) continue;
      const slice = body.slice(start, end + 1);
      for (const attempt of [slice, mend(slice)]) {
        try {
          return JSON.parse(attempt);
        } catch {
          /* try the next shape */
        }
      }
    }
  }
  return null;
}

/** Local repairs for the malformations models actually produce. */
function mend(json: string): string {
  return json
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/\}\s*\{/g, '},{');
}

const REPAIR_SYSTEM =
  'You fix malformed JSON. Reply with the corrected JSON object and nothing else — no explanation, no code fence.';

/**
 * Ask for JSON and actually get it.
 *
 * `json: true` is forced on, and `temperature: 0` is the default, because a
 * structured reply is not a creative task and a model that answers the same
 * question two different ways makes extraction unreproducible.
 */
export async function completeJson(
  config: ProviderConfig,
  input: CompleteInput,
  options: { repair?: boolean } = {}
): Promise<JsonCallResult> {
  const first = await completeDetailed(config, {
    ...input,
    json: true,
    temperature: input.temperature ?? 0,
  });

  const parsed = parseJsonLoose(first.text);
  if (parsed !== null) {
    return { value: parsed, raw: first.text, repaired: false, truncated: first.truncated };
  }

  if (first.truncated) {
    return {
      value: null,
      raw: first.text,
      repaired: false,
      truncated: true,
      error:
        'The reply was cut off before it finished — the model ran out of output room. Try a shorter passage.',
    };
  }

  if (options.repair === false || !first.text.trim()) {
    return {
      value: null,
      raw: first.text,
      repaired: false,
      truncated: false,
      error: first.text.trim()
        ? 'That reply was not valid JSON.'
        : 'The model returned nothing at all.',
    };
  }

  // One repair round-trip. Sending the model its own output back is far more
  // effective than re-running the original prompt, which would just re-roll
  // the same failure — and it is cheap, because the reply is short.
  const second = await completeDetailed(config, {
    system: REPAIR_SYSTEM,
    prompt: `This was supposed to be a single JSON object but it will not parse. Return the same content as valid JSON, changing nothing else.\n\n${first.text.slice(0, 8000)}`,
    json: true,
    temperature: 0,
    maxTokens: input.maxTokens ?? 2000,
  });

  const repaired = parseJsonLoose(second.text);
  if (repaired !== null) {
    return { value: repaired, raw: second.text, repaired: true, truncated: false };
  }

  return {
    value: null,
    raw: first.text,
    repaired: true,
    truncated: second.truncated,
    error: 'That reply was not valid JSON, and asking the model to fix it did not help either.',
  };
}
