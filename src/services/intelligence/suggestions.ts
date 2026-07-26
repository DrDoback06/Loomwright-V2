import { newId } from '@/lib/id';
import type { Entity } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import { confidenceBand } from '@/services/extraction/text-utils';
import { deepPackFor, matchArchetype, resolveTheme } from '@/services/generate/random/packs';
import { generateSkillDraft, skillNameFor } from '@/services/generate/random/packs/skills';
import { createRng } from '@/services/generate/random/rng';
import type { DeltaSuggestion, StoryDeltaPayload, SuggestionKind } from './types';

/** How chatty the suggestions lane is. Sits beside the existing extraction
 * sliders in Settings. */
export type SuggestionVolume = 'quiet' | 'balanced' | 'abundant';

/** Max suggestions per cascade, per volume. */
const CAP: Record<SuggestionVolume, number> = { quiet: 1, balanced: 3, abundant: 6 };

export const DEFAULT_VOLUME: SuggestionVolume = 'balanced';

function makeSuggestion(
  kind: SuggestionKind,
  title: string,
  body: string,
  targetRef: EntityRef | null,
  confidence: number,
  payload: StoryDeltaPayload | null = null
): DeltaSuggestion {
  return {
    unitId: newId(),
    confidence,
    confidenceBand: confidenceBand(confidence),
    sourceQuote: '',
    origin: 'suggestions',
    kind,
    targetRef,
    title,
    body,
    payload,
  };
}

/** Stable seed per subject so the same skill always proposes the same cards —
 * suggestions that reshuffle on every extraction read as noise. */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * What a newly-learned skill opens up.
 *
 * Every card is a finished artifact with a title and one concrete sentence —
 * "Venom Strike II — the coating spreads to thrown weapons (cost: 2 doses)" —
 * because the product promise is a co-DM handing you cards, not a list of
 * open questions. Accepting a card with a payload stages a real mini-delta.
 */
export function suggestForSkill(
  skillName: string,
  skillRef: EntityRef,
  volume: SuggestionVolume
): DeltaSuggestion[] {
  const pack = deepPackFor('skills');
  if (!pack) return [];
  const cap = CAP[volume];
  const out: DeltaSuggestion[] = [];

  try {
    const rng = createRng(seedFrom(skillName));
    const theme = resolveTheme(rng);
    const arch = matchArchetype(rng, pack, theme, skillName);

    // The upgrade this skill grows into — a real drafted skill sheet, so
    // accepting it creates a properly filled entity rather than a stub.
    const nextName = `${skillName} II`;
    const nextDraft = generateSkillDraft(rng, arch, { theme, hint: skillName, known: [] }, {
      tier: 1,
      name: nextName,
    });
    const nextEffect = (nextDraft.fields.effects as string[] | undefined)?.[0] ?? '';
    const nextCost = (nextDraft.fields.cost as string | undefined) ?? '';
    out.push(
      makeSuggestion(
        'skill-next-tier',
        nextName,
        `${nextEffect}${nextCost ? ` (cost: ${nextCost})` : ''}`.trim() ||
          `The next mastery of ${skillName}.`,
        skillRef,
        0.66,
        {
          entities: [
            {
              unitId: newId(),
              confidence: 0.66,
              confidenceBand: 'orange',
              sourceQuote: '',
              origin: 'suggestions',
              draft: { ...nextDraft, localId: newId(), name: nextName },
            },
          ],
          patches: [],
          graphPlacements: [],
          hierarchyPlacements: [],
          links: [],
        }
      )
    );

    // Siblings on the same branch — where the archetype could go next.
    // Bounded attempts: a small lexicon can keep returning names we already
    // have, and `continue` alone would spin forever.
    for (let attempt = 0; attempt < 40 && out.length < cap; attempt++) {
      const siblingName = skillNameFor(rng, arch, 0);
      if (siblingName.toLowerCase() === skillName.toLowerCase()) continue;
      if (out.some((s) => s.title.toLowerCase() === siblingName.toLowerCase())) continue;
      const draft = generateSkillDraft(rng, arch, { theme, hint: skillName, known: [] }, {
        name: siblingName,
      });
      const effect = (draft.fields.effects as string[] | undefined)?.[0] ?? '';
      out.push(
        makeSuggestion(
          'skill-sibling',
          siblingName,
          effect || `Sits alongside ${skillName} on the same branch.`,
          skillRef,
          0.58,
          {
            entities: [
              {
                unitId: newId(),
                confidence: 0.58,
                confidenceBand: 'orange',
                sourceQuote: '',
                origin: 'suggestions',
                draft: { ...draft, localId: newId(), name: siblingName },
              },
            ],
            patches: [],
            graphPlacements: [],
            hierarchyPlacements: [],
            links: [],
          }
        )
      );
    }
  } catch {
    return out.slice(0, cap);
  }

  return out.slice(0, cap);
}

/**
 * Arc candidates read off the relationship web: characters bonded to someone
 * who just changed, rivals with unresolved business, allies who share a
 * faction. Pure graph traversal — no model, no keys.
 */
export function suggestFromRelationshipWeb(
  subject: Entity,
  entities: Entity[],
  volume: SuggestionVolume,
  context: { learnedSkill?: string } = {}
): DeltaSuggestion[] {
  const cap = CAP[volume];
  const out: DeltaSuggestion[] = [];

  const refId = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
    return null;
  };

  const bonds = entities.filter((e) => e.type === 'relationships');
  const partners: { entity: Entity; bond: string }[] = [];
  for (const bond of bonds) {
    const from = refId(bond.fields.from);
    const to = refId(bond.fields.to);
    const otherId = from === subject.id ? to : to === subject.id ? from : null;
    if (!otherId) continue;
    const other = entities.find((e) => e.id === otherId);
    if (other) partners.push({ entity: other, bond: String(bond.fields.bondType ?? 'bond') });
  }

  for (const { entity: partner, bond } of partners) {
    if (out.length >= cap) break;
    if (context.learnedSkill && (bond === 'ally' || bond === 'mentor')) {
      out.push(
        makeSuggestion(
          'cast-candidate',
          `Teach ${partner.name} ${context.learnedSkill}`,
          `${subject.name} and ${partner.name} are bonded as ${bond} — the technique passes to ${partner.name} in a quiet scene.`,
          { id: partner.id, type: partner.type, name: partner.name },
          0.55
        )
      );
    } else if (bond === 'enemy' || bond === 'rival') {
      out.push(
        makeSuggestion(
          'story-arc',
          `${subject.name} vs ${partner.name} comes to a head`,
          `Their ${bond} bond is unresolved${
            context.learnedSkill ? ` and ${subject.name} now has ${context.learnedSkill}` : ''
          } — stage the confrontation while the advantage holds.`,
          { id: subject.id, type: subject.type, name: subject.name },
          0.52
        )
      );
    }
  }

  return out.slice(0, cap);
}
