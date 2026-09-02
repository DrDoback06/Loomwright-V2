import type { EntityType } from '@/domain/entity-types';

/**
 * Everything a template can reach, pre-computed.
 *
 * Deliberately a plain data bag rather than a set of callbacks: resolution
 * is synchronous and pure, so the Prompts panel can show an author the
 * fully resolved text as they type without a query per keystroke, and the
 * unit tests need no database at all. Assembling the scope is the caller's
 * job and is where the async work lives.
 */
export interface PromptScope {
  scene?: {
    title?: string;
    summary?: string;
    labels?: string[];
    pov?: string | null;
  };
  selection?: string;
  precedingProse?: string;
  beat?: string;
  targetWords?: number;
  /** The assembled entity block from `buildSceneContext`. */
  context?: string;
  storySoFar?: string;
  storyToCome?: string;
  /** One rendered block per entity type, for `{codex.cast()}`. */
  codexByType?: Partial<Record<EntityType, string>>;
  /** Every type at once, for `{codex.all}`. */
  codexAll?: string;
  /** Lowercased name → its digest, for `{codex.get("Vex")}`. */
  codexByName?: Record<string, string>;
  /** Answers the author gave to this template's own `inputs`. */
  inputs?: Record<string, string>;
}

export interface ResolveResult {
  text: string;
  /** Every `{…}` this resolver did not recognise, in the order found.
   * Rendered in the editor rather than swallowed: a variable that silently
   * resolves to nothing is a template that quietly stops working. */
  unknown: string[];
}

/** `{name}`, `{name.part}`, `{fn()}`, `{fn("arg")}`. Non-nesting and
 * non-chaining on purpose — the same shape novelcrafter uses, so prompts
 * written for it are portable, and so a template can never become a
 * program. */
const TOKEN = /\{([a-zA-Z][a-zA-Z0-9_.]*)\s*(\((?:[^()]*)\))?\}/g;

function stripQuotes(raw: string): string {
  const inner = raw.slice(1, -1).trim();
  if (
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"))
  ) {
    return inner.slice(1, -1);
  }
  return inner;
}

/**
 * Substitute `{…}` tokens against the scope.
 *
 * Case-insensitive on the token name, because the difference between
 * `{storySoFar()}` and `{storysofar()}` is not something an author should
 * have to debug. Unknown tokens are left in the text **and reported**, so
 * a typo shows up as a typo rather than as a prompt that mysteriously
 * stopped mentioning the cast.
 */
export function resolvePrompt(template: string, scope: PromptScope): ResolveResult {
  const unknown: string[] = [];
  const text = template.replace(TOKEN, (whole, rawName: string, rawArgs?: string) => {
    const name = rawName.toLowerCase();
    const arg = rawArgs ? stripQuotes(rawArgs) : '';

    switch (name) {
      case 'scene.title':
        return scope.scene?.title ?? '';
      case 'scene.summary':
        return scope.scene?.summary ?? '';
      case 'scene.labels':
        return (scope.scene?.labels ?? []).join(', ');
      case 'scene.pov':
        return scope.scene?.pov ?? '';
      case 'selection':
        return scope.selection ?? '';
      case 'precedingprose':
        return scope.precedingProse ?? '';
      case 'beat':
        return scope.beat ?? '';
      case 'targetwords':
        return scope.targetWords != null ? String(scope.targetWords) : '';
      case 'context':
        return scope.context ?? '';
      case 'storysofar':
        return scope.storySoFar ?? '';
      case 'storytocome':
        return scope.storyToCome ?? '';
      case 'codex.all':
        return scope.codexAll ?? '';
      case 'codex.get':
        return scope.codexByName?.[arg.toLowerCase()] ?? '';
      case 'input':
        return scope.inputs?.[arg] ?? '';
      default: {
        // `{codex.<type>()}` — one block per entity type, resolved against
        // the same 16 types the codex itself uses rather than a second list.
        if (name.startsWith('codex.')) {
          const type = name.slice('codex.'.length) as EntityType;
          const block = scope.codexByType?.[type];
          if (block !== undefined) return block;
        }
        unknown.push(whole);
        return whole;
      }
    }
  });
  return { text, unknown };
}

/** Every token a template mentions, for the editor's "this uses" line. */
export function tokensIn(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((m) => m[0]);
}
