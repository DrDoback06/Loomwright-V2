import { db } from '@/db/schema';
import { complete } from '@/services/ai/providers';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import { buildMegaPrompt, buildWorldDigest, parseDeltaReply, type DigestDepth } from './digest';
import type { StoryDelta } from './types';

export interface EnrichResult {
  delta: StoryDelta;
  /** How many units the AI pass contributed beyond the offline delta. */
  added: number;
}

/**
 * Layer in-app AI enrichment on top of an offline delta.
 *
 * The offline result is the floor, never the ceiling — enrichment only ever
 * ADDS to what the local engine already found. The AI reply travels the same
 * verification path a pasted reply does (parseDeltaReply → the same
 * propagation rules), so an in-app call cannot write anything the offline
 * engine would not have written on its own.
 *
 * Returns the untouched offline delta when no provider is configured, so the
 * caller degrades to "you already have the offline answer" rather than an
 * error. That is the product's standing promise: offline smarts are free
 * forever, AI enriches.
 */
export async function enrichDelta(
  projectId: string,
  base: StoryDelta,
  manuscript: string,
  depth: DigestDepth = 'standard'
): Promise<EnrichResult> {
  const config = await resolveProvider(projectId);
  if (!config) return { delta: base, added: 0 };

  const digest = await buildWorldDigest(projectId, depth);
  const reply = await complete(config, {
    system: 'You extract structured story facts. Reply with one JSON object and nothing else.',
    prompt: buildMegaPrompt(digest, manuscript),
    maxTokens: 4000,
  });

  const enriched = await parseDeltaReply(projectId, reply);
  if ('error' in enriched) {
    // A malformed reply must not cost the author the offline result.
    return {
      delta: { ...base, warnings: [...base.warnings, `AI enrichment skipped: ${enriched.error}`] },
      added: 0,
    };
  }

  return { delta: mergeDeltas(base, enriched), added: countUnits(enriched) };
}

/** True when an in-app AI call needs the privacy prompt first. */
export async function needsPrivacyConfirm(projectId: string): Promise<boolean> {
  const settings = await getAiSettings(projectId);
  return settings.privacy === 'ask';
}

/** Has the one-time world-digest notice been shown for this project? */
export async function digestNoticeSeen(projectId: string): Promise<boolean> {
  const row = await db.settings.get(`${projectId}:digest-notice-seen`);
  return Boolean(row?.value);
}

export async function markDigestNoticeSeen(projectId: string): Promise<void> {
  await db.settings.put({ key: `${projectId}:digest-notice-seen`, value: true });
}

function countUnits(delta: StoryDelta): number {
  return (
    delta.entities.length +
    delta.patches.length +
    delta.graphPlacements.length +
    delta.hierarchyPlacements.length +
    delta.links.length +
    delta.suggestions.length
  );
}

/**
 * Fold an AI delta into the offline one. The offline pass wins every
 * collision: if both found the same field change, the locally-derived patch
 * is the one that survives, because it came from a deterministic rule reading
 * the actual text rather than a model's summary of it.
 */
export function mergeDeltas(base: StoryDelta, extra: StoryDelta): StoryDelta {
  const patchKey = (p: { entityId: string; fieldId: string; mode: string }) =>
    `${p.entityId}|${p.fieldId}|${p.mode}`;
  const seenPatches = new Set(base.patches.map(patchKey));
  const newPatches = extra.patches.filter((p) => !seenPatches.has(patchKey(p)));

  const seenNames = new Set(
    base.entities.map((e) => `${e.draft.type}|${e.draft.name.toLowerCase()}`)
  );
  const newEntities = extra.entities.filter(
    (e) => !seenNames.has(`${e.draft.type}|${e.draft.name.toLowerCase()}`)
  );

  const seenSuggestions = new Set(base.suggestions.map((s) => s.title.toLowerCase()));
  const newSuggestions = extra.suggestions.filter(
    (s) => !seenSuggestions.has(s.title.toLowerCase())
  );

  // Only keep the AI's groups whose members actually survived the merge, so
  // the board never renders an empty cascade.
  const surviving = new Set([
    ...newPatches.map((p) => p.unitId),
    ...newEntities.map((e) => e.unitId),
    ...newSuggestions.map((s) => s.unitId),
    ...extra.graphPlacements.map((g) => g.unitId),
    ...extra.hierarchyPlacements.map((h) => h.unitId),
    ...extra.links.map((l) => l.unitId),
  ]);
  const extraGroups = extra.groups
    .map((g) => ({ ...g, unitIds: g.unitIds.filter((id) => surviving.has(id)) }))
    .filter((g) => g.unitIds.length > 0);

  return {
    ...base,
    entities: [...base.entities, ...newEntities],
    patches: [...base.patches, ...newPatches],
    graphPlacements: [...base.graphPlacements, ...extra.graphPlacements],
    hierarchyPlacements: [...base.hierarchyPlacements, ...extra.hierarchyPlacements],
    links: [...base.links, ...extra.links],
    suggestions: [...base.suggestions, ...newSuggestions],
    groups: [...base.groups, ...extraGroups],
    warnings: [...base.warnings, ...extra.warnings],
  };
}
