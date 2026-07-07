import type { Entity } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '@/services/generate/types';
import { emptyDelta, type StoryDelta, type SuggestionDraft } from './types';

export type SuggestionVolume = 'quiet' | 'balanced' | 'abundant';

/** How many suggestions the world generators are allowed to surface. */
const VOLUME_CAP: Record<SuggestionVolume, number> = { quiet: 3, balanced: 8, abundant: 20 };

export interface SuggestContext {
  projectId: string;
  entities: Entity[];
}

const ref = (e: Entity): EntityRef => ({ id: e.id, type: e.type, name: e.name });

/** Wrap one create into a ready-to-apply mini StoryDelta payload. */
function payloadCreating(projectId: string, draft: BundleEntityDraft): StoryDelta {
  const delta = emptyDelta(newId(), projectId, 'local', Date.now());
  delta.entities.push(draft);
  return delta;
}

function entityDraft(type: BundleEntityDraft['type'], name: string, summary: string, fields: Record<string, unknown>): BundleEntityDraft {
  return { localId: newId(), type, name, aliases: [], summary, tags: ['suggested'], fields };
}

const ANTAGONISTIC = /(enem|rival|betray|feud|hatred|hostile|nemesis)/i;

/** Relationship-web arcs: antagonistic bonds → a reckoning event; a rich web
 * with no open conflict → a simmering-tension prompt. Each carries a payload
 * that creates a real event when accepted. */
function relationshipArcs(ctx: SuggestContext): SuggestionDraft[] {
  const out: SuggestionDraft[] = [];
  for (const rel of ctx.entities.filter((e) => e.type === 'relationships')) {
    const from = rel.fields.from as EntityRef | undefined;
    const to = rel.fields.to as EntityRef | undefined;
    if (!from?.id || !to?.id) continue;
    const bond = String(rel.fields.bondType ?? '');
    if (ANTAGONISTIC.test(bond)) {
      const title = `Reckoning: ${from.name} and ${to.name} settle the ${bond}`;
      out.push({
        targetRef: from,
        kind: 'arc',
        title,
        detail: `Bring the ${bond} between ${from.name} and ${to.name} to a head — a confrontation neither walks away from unchanged.`,
        source: 'local',
        confidence: 0.6,
        payload: payloadCreating(
          ctx.projectId,
          entityDraft('events', `The ${from.name}–${to.name} Reckoning`, `${from.name} and ${to.name} finally settle their ${bond}.`, {
            eventType: 'named-event',
          })
        ),
      });
    }
  }
  return out;
}

/** Quest-outcome grammars: for every open quest, a concrete resolution whose
 * win plants the next problem. Accept creates the outcome event. */
function questOutcomes(ctx: SuggestContext): SuggestionDraft[] {
  const out: SuggestionDraft[] = [];
  for (const quest of ctx.entities.filter((e) => e.type === 'quests')) {
    const status = String(quest.fields.status ?? '').toLowerCase();
    if (status === 'complete' || status === 'failed' || status === 'abandoned') continue;
    out.push({
      targetRef: ref(quest),
      kind: 'quest-outcome',
      title: `${quest.name}: won at a cost that opens the next thread`,
      detail: `Resolve ${quest.name} with a hard-won victory whose price sets up what comes next.`,
      source: 'local',
      confidence: 0.55,
      payload: payloadCreating(
        ctx.projectId,
        entityDraft('events', `The Resolution of ${quest.name}`, `${quest.name} is resolved — but the cost lingers.`, {
          eventType: 'named-event',
        })
      ),
    });
  }
  return out;
}

/** Content-pack expansions: for every skill, a stronger sibling — a finished
 * card, not an open question. Accept creates the sibling skill. */
function skillExpansions(ctx: SuggestContext): SuggestionDraft[] {
  const out: SuggestionDraft[] = [];
  for (const skill of ctx.entities.filter((e) => e.type === 'skills')) {
    const siblingName = `${skill.name} II`;
    if (ctx.entities.some((e) => e.type === 'skills' && e.name.toLowerCase() === siblingName.toLowerCase())) continue;
    const kindOf = String(skill.fields.skillType ?? 'active');
    out.push({
      targetRef: ref(skill),
      kind: 'skill-sibling',
      title: `${siblingName} — the coating spreads further, at a steeper cost`,
      detail: `A next-tier form of ${skill.name}: same school, wider reach, higher price.`,
      source: 'local',
      confidence: 0.6,
      payload: payloadCreating(
        ctx.projectId,
        entityDraft('skills', siblingName, `A stronger form of ${skill.name}.`, {
          skillType: kindOf,
          effects: [`Everything ${skill.name} does, but broader.`],
          upgradePath: [`Mastered from ${skill.name}.`],
        })
      ),
    });
  }
  return out;
}

/** Run every offline suggestion generator, gated by the volume setting.
 * Deterministic: ordered by confidence, then title, then capped. */
export function generateWorldSuggestions(
  ctx: SuggestContext,
  volume: SuggestionVolume = 'balanced'
): SuggestionDraft[] {
  const all = [...relationshipArcs(ctx), ...questOutcomes(ctx), ...skillExpansions(ctx)];
  all.sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title));
  return all.slice(0, VOLUME_CAP[volume]);
}
