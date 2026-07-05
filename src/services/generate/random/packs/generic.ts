import type { EntityType } from '@/domain/entity-types';
import type { KnownEntity } from '@/services/extraction/known-index';
import { newId } from '@/lib/id';
import { entitySpec, generableFields, type FieldSpec } from '../../spec';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import {
  abstractTitle,
  cap,
  creatureName,
  factionName,
  hintWords,
  itemName,
  personName,
  placeName,
  pools,
  type ThemeId,
} from './lexicon';

export interface GenCtx {
  theme: ThemeId;
  hint: string;
  known: KnownEntity[];
}

/** Which name style each entity type uses. */
const NAME_STYLE: Record<EntityType, 'person' | 'place' | 'creature' | 'item' | 'faction' | 'title'> = {
  cast: 'person',
  bestiary: 'creature',
  locations: 'place',
  items: 'item',
  classes: 'title',
  races: 'title',
  stats: 'title',
  abilities: 'title',
  skills: 'title',
  quests: 'title',
  events: 'title',
  factions: 'faction',
  lore: 'title',
  relationships: 'person',
  timeline: 'title',
  references: 'title',
};

export function nameFor(rng: Rng, type: EntityType, theme: ThemeId, hint: string): string {
  const words = hintWords(hint);
  const flavor = words.length ? cap(rng.pick(words)) : '';
  switch (NAME_STYLE[type]) {
    case 'person':
      return personName(rng, theme);
    case 'place':
      return flavor && rng.chance(0.5) ? `${flavor} ${placeName(rng, theme)}` : placeName(rng, theme);
    case 'creature':
      return flavor && rng.chance(0.5) ? `${flavor} ${creatureName(rng, theme)}` : creatureName(rng, theme);
    case 'item':
      return flavor && rng.chance(0.5) ? `${flavor} ${itemName(rng, theme)}` : itemName(rng, theme);
    case 'faction':
      return factionName(rng, theme);
    case 'title': {
      const base = abstractTitle(rng, theme);
      return flavor && rng.chance(0.6) ? `The ${flavor} ${base.replace(/^The /, '')}` : base;
    }
  }
}

function summaryFor(rng: Rng, type: EntityType, theme: ThemeId, name: string): string {
  const p = pools(theme);
  const a = () => rng.pick(p.adjectives);
  const n = () => rng.pick(p.nouns);
  const templates: Partial<Record<EntityType, string[]>> = {
    cast: [
      `A ${a()} figure who trades in ${n()}s and owes more than they admit.`,
      `Keeper of a ${a()} ${n()}, reluctantly drawn into the story.`,
      `Known for a ${a()} temper and an unpaid debt to the ${n()}.`,
    ],
    bestiary: [
      `A ${a()} predator drawn to ${n()}s; travellers speak of it in whispers.`,
      `Nests near ${placeName(rng, theme)}; hunts by scent of ${n()}s.`,
    ],
    locations: [
      `A ${a()} place, famous for its ${n()} and infamous for what it costs.`,
      `Once prosperous; now the ${n()} trade keeps it ${a()}.`,
    ],
    items: [
      `A ${a()} piece of work; whoever holds it holds a claim on the ${n()}.`,
      `Forged of ${rng.pick(p.materials)} — it hums when a ${n()} is near.`,
    ],
    factions: [
      `They control the ${n()} trade and answer to no crown.`,
      `A ${a()} brotherhood sworn over a shared ${n()}.`,
    ],
    quests: [`Someone must carry the ${n()} to ${placeName(rng, theme)} before it is missed.`],
    events: [`The day the ${n()} broke, and everything ${a()} followed.`],
    lore: [`It is said the ${n()} remembers, and collects, and waits.`],
    skills: [`A ${a()} technique that turns a ${n()} into an advantage.`],
    abilities: [`A ${a()} technique that turns a ${n()} into an advantage.`],
    classes: [`Those who study the ${n()} until it studies them back.`],
    races: [`A ${a()} people, shaped by generations beside the ${n()}.`],
    stats: [`Measures how far the ${n()} can be pushed before it breaks.`],
    timeline: [`When the ${a()} ${n()} changed hands.`],
    references: [`Notes on the ${n()} — sources, sketches, contradictions.`],
    relationships: [`Bound together by one ${a()} ${n()}, divided by everything else.`],
  };
  const options = templates[type] ?? [`A ${a()} ${n()} worth writing about.`];
  const text = rng.pick(options);
  return text.includes(name) ? text : text;
}

/** Fields the generic filler deliberately leaves blank: interactive kinds
 * plus refs it cannot invent (related targets are matched from known). */
function fillableGeneric(field: FieldSpec): boolean {
  return !['image', 'phrase-tester', 'step-list'].includes(field.kind);
}

/** Config-driven light generation for any type: name + summary + every
 * option-backed field + themed chips. Deep packs override per type. */
export function generateGenericDraft(rng: Rng, type: EntityType, ctx: GenCtx): BundleEntityDraft {
  const spec = entitySpec(type);
  const fields: Record<string, unknown> = {};
  const name = nameFor(rng, type, ctx.theme, ctx.hint);
  const p = pools(ctx.theme);

  for (const field of spec ? generableFields(spec) : []) {
    if (!fillableGeneric(field)) continue;
    const roll = rollGenericField(rng, field, ctx);
    if (roll !== undefined) fields[field.id] = roll;
  }

  return {
    localId: newId(),
    type,
    name,
    aliases: [],
    summary: summaryFor(rng, type, ctx.theme, name),
    tags: rng.chance(0.7) ? [rng.pick(p.adjectives), rng.pick(p.nouns)].slice(0, rng.int(1, 2)) : [],
    fields,
  };
}

/** One field's worth of random content — also powers the per-field dice
 * in the editor drawer. Undefined = this field stays blank. `force`
 * (dice clicks) skips the sometimes-blank gates so a roll always tries. */
export function rollGenericField(
  rng: Rng,
  field: FieldSpec,
  ctx: GenCtx,
  opts: { force?: boolean } = {}
): unknown {
  const p = pools(ctx.theme);
  switch (field.kind) {
    case 'pills':
    case 'select':
      return field.options?.length ? rng.pick(field.options) : undefined;
    case 'multiselect': {
      if (!field.options?.length) return undefined;
      const count = rng.int(1, Math.min(2, field.options.length));
      return rng.shuffle(field.options).slice(0, count);
    }
    case 'chips': {
      const count = rng.int(2, 3);
      const pool = [...p.adjectives, ...p.nouns];
      return rng.shuffle(pool).slice(0, count);
    }
    case 'toggle':
      return opts.force ? rng.chance(0.5) : rng.chance(0.25) ? true : undefined;
    case 'number':
      return String(rng.int(1, 10));
    case 'related': {
      const candidates = ctx.known.filter(
        (k) => field.related === 'any' || k.type === field.related
      );
      if (!candidates.length || (!opts.force && !rng.chance(0.6))) return undefined;
      const picked = rng.pick(candidates);
      return { id: picked.id, type: picked.type, name: picked.name };
    }
    case 'related-multi': {
      const candidates = ctx.known.filter(
        (k) => field.related === 'any' || k.type === field.related
      );
      if (!candidates.length || (!opts.force && !rng.chance(0.5))) return undefined;
      return rng
        .shuffle(candidates)
        .slice(0, rng.int(1, Math.min(2, candidates.length)))
        .map((k) => ({ id: k.id, type: k.type, name: k.name }));
    }
    case 'stat-grid':
      // Type-meaningful stat rows come from deep packs; generic skips them.
      return undefined;
    case 'text': {
      const rolled = rollShortText(rng, field, ctx);
      if (rolled !== undefined || !opts.force) return rolled;
      return `${cap(rng.pick(p.adjectives))} ${rng.pick(p.nouns)}`;
    }
    case 'textarea':
    case 'longtext': {
      const rolled = rollProse(rng, field, ctx);
      if (rolled !== undefined || !opts.force) return rolled;
      return `${cap(rng.pick(p.adjectives))}, ${rng.pick(p.adjectives)} — and tangled up with the ${rng.pick(p.nouns)}.`;
    }
    default:
      return undefined;
  }
}

/** Short text: only fill fields whose id/label suggests safe content. */
function rollShortText(rng: Rng, field: FieldSpec, ctx: GenCtx): string | undefined {
  const p = pools(ctx.theme);
  const key = `${field.id} ${field.label}`.toLowerCase();
  if (/cost|price/.test(key)) return `${rng.int(1, 12)} ${rng.pick(['coin', 'favors', 'days', 'charges'])}`;
  if (/duration|cooldown|time/.test(key)) return `${rng.int(1, 8)} ${rng.pick(['rounds', 'hours', 'days'])}`;
  if (/color|colour/.test(key)) return rng.pick(['ash-grey', 'oxblood', 'verdigris', 'bone-white', 'storm-blue']);
  if (/material/.test(key)) return rng.pick(p.materials);
  if (/occupation|profession|trade/.test(key)) return rng.pick(['smuggler', 'archivist', 'sell-sword', 'apothecary', 'cartographer', 'debt-collector']);
  if (/motto|creed|saying/.test(key)) return `"${cap(rng.pick(p.nouns))} before ${rng.pick(p.nouns)}."`;
  return undefined;
}

/** Prose fields: fill only the classic descriptive ones with a themed line. */
function rollProse(rng: Rng, field: FieldSpec, ctx: GenCtx): string | undefined {
  const p = pools(ctx.theme);
  const key = `${field.id} ${field.label}`.toLowerCase();
  const a = () => rng.pick(p.adjectives);
  const n = () => rng.pick(p.nouns);
  if (/personality|temperament/.test(key)) {
    return `${cap(a())} on the surface, ${a()} underneath; softens around a ${n()}.`;
  }
  if (/appearance|description|look/.test(key)) {
    return `Carries a ${a()} air; you notice the ${n()} first, then the scars.`;
  }
  if (/backstory|history|origin/.test(key)) {
    return `Came up near ${p.placeStems[0].toLowerCase()}-country; lost everything to a ${a()} ${n()} and never speaks of it.`;
  }
  if (/secret/.test(key)) {
    return `Knows where the ${n()} is buried — and who paid for the digging.`;
  }
  return undefined;
}
