import { db } from '../schema';
import { newId } from '@/lib/id';
import type {
  Entity,
  IdentityRule,
  MergeReceipt,
  ReviewCandidate,
} from '../types';
import type { EntityRef, EntityType } from '@/domain/entity-types';
import { logAudit } from './audit';
import { normaliseIdentitySurface } from './identity';
import {
  buildChapterLookup,
  candidateToChapterFact,
  chapterInsertionDescription,
  mergeChapterFacts,
  type ChapterAnchoredFact,
  type ChapterLookup,
} from '@/services/chapter-awareness';

export interface MergeRequest {
  entityType: EntityType;
  candidateIds?: string[];
  sourceEntityIds?: string[];
  targetEntityId?: string | null;
  targetCandidateIds?: string[];
  canonicalName?: string;
}

export type MergeFieldDecision =
  | 'keep-existing'
  | 'use-incoming'
  | 'combine'
  | 'historical'
  | 'skip';

export type AliasClassification =
  | 'alias'
  | 'title'
  | 'former-name'
  | 'spelling'
  | 'description';

export interface MergeAliasOption {
  name: string;
  include: boolean;
  classification: AliasClassification;
  source: string;
  locked?: boolean;
}

export interface MergeIncomingValue {
  sourceId: string;
  sourceLabel: string;
  value: unknown;
  chapterId?: string;
  chapterLabel?: string;
  chapterOrder?: number | null;
  sourceQuote?: string;
}

export interface MergeFieldRow {
  key: string;
  label: string;
  existingValue: unknown;
  incoming: MergeIncomingValue[];
  defaultDecision: MergeFieldDecision;
  hasConflict: boolean;
}

export interface MergeChronologyRow extends ChapterAnchoredFact {
  source: 'existing' | 'incoming';
  insertionNote?: string | null;
}

export interface MergePreview {
  projectId: string;
  entityType: EntityType;
  request: MergeRequest;
  targetEntity: Entity | null;
  sourceEntities: Entity[];
  candidates: ReviewCandidate[];
  canonicalName: string;
  aliases: MergeAliasOption[];
  fields: MergeFieldRow[];
  chronology: MergeChronologyRow[];
  affected: {
    /** Total queue records that confirmation will resolve or relink. */
    candidateCount: number;
    /** Records explicitly selected in this decision. */
    directCandidateCount: number;
    /** Other pending records automatically re-linked by the learned identity. */
    rescoreCandidateCount: number;
    sourceEntityCount: number;
    occurrenceCount: number;
    linkCount: number;
    referencedEntityCount: number;
    chapterCount: number;
    locationCount: number;
  };
  details: {
    queue: Array<{
      id: string;
      name: string;
      direct: boolean;
      reason: string;
      chapterLabel: string;
    }>;
    occurrences: Array<{
      id: string;
      exactText: string;
      chapterLabel: string;
      before: string;
      after: string;
    }>;
    links: Array<{
      id: string;
      kind: string;
      before: string;
      after: string;
    }>;
    referencedEntities: Array<{
      id: string;
      name: string;
      entityType: EntityType;
      fieldPaths: string[];
    }>;
    locations: Array<{
      id: string;
      name: string;
      visitCount: number;
      chapters: string[];
    }>;
  };
  warnings: string[];
}

export interface CommitMergeOptions {
  canonicalName: string;
  aliases: MergeAliasOption[];
  fieldDecisions: Record<string, MergeFieldDecision>;
}

export interface CommitMergeResult {
  entity: Entity;
  receipt: MergeReceipt;
}

function unique<T>(rows: T[]): T[] {
  return [...new Set(rows)];
}

function stable(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isEntityRef(value: unknown): value is EntityRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EntityRef).id === 'string' &&
    typeof (value as EntityRef).name === 'string' &&
    typeof (value as EntityRef).type === 'string'
  );
}

function containsEntityId(value: unknown, ids: Set<string>): boolean {
  if (Array.isArray(value)) return value.some((item) => containsEntityId(item, ids));
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id === 'string' && ids.has(row.id)) return true;
  return Object.values(row).some((item) => containsEntityId(item, ids));
}

function entityReferencePaths(
  value: unknown,
  ids: Set<string>,
  prefix = 'fields'
): string[] {
  if (Array.isArray(value)) {
    return unique(value.flatMap((item, index) => entityReferencePaths(item, ids, `${prefix}[${index}]`)));
  }
  if (typeof value !== 'object' || value === null) return [];
  const row = value as Record<string, unknown>;
  const direct = typeof row.id === 'string' && ids.has(row.id) ? [prefix] : [];
  return unique([
    ...direct,
    ...Object.entries(row).flatMap(([key, item]) => entityReferencePaths(item, ids, `${prefix}.${key}`)),
  ]);
}

function rewriteEntityIds(value: unknown, ids: Set<string>, target: EntityRef): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map((item) => rewriteEntityIds(item, ids, target));
    const seenRefs = new Set<string>();
    return mapped.filter((item) => {
      if (!isEntityRef(item)) return true;
      if (seenRefs.has(item.id)) return false;
      seenRefs.add(item.id);
      return true;
    });
  }
  if (typeof value !== 'object' || value === null) return value;
  const row = value as Record<string, unknown>;
  if (typeof row.id === 'string' && ids.has(row.id) && 'type' in row && 'name' in row) {
    return { ...target };
  }
  return Object.fromEntries(
    Object.entries(row).map(([key, item]) => [key, rewriteEntityIds(item, ids, target)])
  );
}

function valueKey(value: unknown): string {
  if (isEntityRef(value)) return `ref:${value.id}`;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string') return `id:${id}`;
  }
  return stable(value);
}

function combineValues(existing: unknown, incoming: unknown[]): unknown {
  const values = [existing, ...incoming].filter((value) => value !== undefined && value !== null && value !== '');
  if (values.length === 0) return undefined;
  if (values.every(Array.isArray)) {
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const list of values as unknown[][]) {
      for (const item of list) {
        const key = valueKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  }
  if (values.every((value) => typeof value === 'string')) {
    return unique((values as string[]).map((value) => value.trim()).filter(Boolean)).join('\n');
  }
  if (values.every((value) => typeof value === 'object' && value !== null && !Array.isArray(value))) {
    return Object.assign({}, ...values);
  }
  return values[values.length - 1];
}

function latestIncoming(row: MergeFieldRow): unknown {
  const sorted = [...row.incoming].sort((a, b) => {
    // Undated duplicate-record snapshots are treated as the baseline; explicit
    // chapter evidence wins according to the current stable chapter order.
    const ao = a.chapterOrder ?? -1;
    const bo = b.chapterOrder ?? -1;
    return ao - bo;
  });
  return sorted[sorted.length - 1]?.value;
}

export function resolveMergeFieldPreview(
  row: MergeFieldRow,
  decision: MergeFieldDecision
): unknown {
  if (decision === 'skip' || decision === 'keep-existing') return row.existingValue;
  if (decision === 'historical') {
    return {
      current: row.existingValue,
      historicalAdditions: row.incoming.map((incoming) => ({
        value: incoming.value,
        chapterLabel: incoming.chapterLabel ?? null,
        sourceLabel: incoming.sourceLabel,
      })),
    };
  }
  if (decision === 'combine') {
    return combineValues(row.existingValue, row.incoming.map((incoming) => incoming.value));
  }
  return latestIncoming(row);
}

function fieldLabel(key: string): string {
  if (key === '__summary') return 'Summary';
  if (key === 'currentLocation') return 'Current location';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function recommendedDecision(existing: unknown, incoming: unknown[]): MergeFieldDecision {
  const actual = incoming.filter((value) => value !== undefined && value !== null && value !== '');
  if (actual.length === 0) return 'skip';
  if (existing === undefined || existing === null || existing === '') return 'use-incoming';
  if (actual.every((value) => stable(value) === stable(existing))) return 'keep-existing';
  if (Array.isArray(existing) || actual.some(Array.isArray)) return 'combine';
  if (
    typeof existing === 'object' &&
    existing !== null &&
    actual.every((value) => typeof value === 'object' && value !== null)
  ) {
    return 'combine';
  }
  return 'historical';
}

function aliasClassification(name: string): AliasClassification {
  const lower = normaliseIdentitySurface(name);
  if (/^(captain|commander|warden|lord|lady|sir|dame|king|queen|prince|princess|doctor|dr|saint|st)\b/.test(lower)) {
    return 'title';
  }
  return 'alias';
}

function sourceFacts(entity: Entity): ChapterAnchoredFact[] {
  const timeline = entity.fields.timelineFacts;
  const travel = entity.fields.travelTimeline;
  return [...(Array.isArray(timeline) ? (timeline as ChapterAnchoredFact[]) : []), ...(Array.isArray(travel) ? (travel as ChapterAnchoredFact[]) : [])];
}

async function loadRequest(request: MergeRequest) {
  const candidates = (
    await Promise.all((request.candidateIds ?? []).map((id) => db.candidates.get(id)))
  ).filter((row): row is ReviewCandidate => !!row);
  const targetEntity = request.targetEntityId ? (await db.entities.get(request.targetEntityId)) ?? null : null;
  const sourceEntities = (
    await Promise.all([...new Set(request.sourceEntityIds ?? [])].map((id) => db.entities.get(id)))
  ).filter(
    (row): row is Entity =>
      !!row && row.status !== 'merged' && (!targetEntity || row.id !== targetEntity.id)
  );
  const projectId = targetEntity?.projectId ?? sourceEntities[0]?.projectId ?? candidates[0]?.projectId;
  if (!projectId) throw new Error('Nothing to merge.');
  const wrongType = [...sourceEntities, ...(targetEntity ? [targetEntity] : [])].some(
    (entity) => entity.type !== request.entityType
  ) || candidates.some((candidate) => candidate.entityType !== request.entityType);
  if (wrongType) throw new Error('Only entities of the same type can be merged.');
  return { candidates, sourceEntities, targetEntity, projectId };
}

export async function buildMergePreview(request: MergeRequest): Promise<MergePreview> {
  const { candidates: directCandidates, sourceEntities, targetEntity, projectId } = await loadRequest(request);
  const lookup = await buildChapterLookup(projectId);
  const canonicalName =
    request.canonicalName ||
    targetEntity?.name ||
    directCandidates.find((candidate) => request.targetCandidateIds?.includes(candidate.id))?.name ||
    directCandidates[0]?.name ||
    sourceEntities[0]?.name ||
    'Merged entity';

  // Expand the selected decision before building any field or chronology rows.
  // Exact-name/learned-name duplicates and rows still pointing at a dragged
  // source entity are part of this merge, not merely re-labelled afterwards.
  // This ensures their evidence and suggested changes are visible in the
  // preview, applied on confirmation, and resolved out of the queue together.
  const sourceIds = new Set(sourceEntities.map((entity) => entity.id));
  const directCandidateIds = new Set(directCandidates.map((candidate) => candidate.id));
  const initialSurfaceKeys = new Set(
    unique([
      canonicalName,
      ...(targetEntity ? [targetEntity.name, ...targetEntity.aliases] : []),
      ...sourceEntities.flatMap((entity) => [entity.name, ...entity.aliases]),
      ...directCandidates.flatMap((candidate) => [
        candidate.name,
        ...((Array.isArray(candidate.suggestedChanges?.aliases)
          ? candidate.suggestedChanges.aliases
          : []) as string[]),
      ]),
    ]).map(normaliseIdentitySurface)
  );
  const pendingForIdentity = await db.candidates
    .where('[projectId+status]')
    .equals([projectId, 'pending'])
    .toArray();
  const automaticallyRelinkedCandidates = pendingForIdentity.filter((candidate) => {
    if (directCandidateIds.has(candidate.id)) return false;
    const pointsAtSource = !!candidate.existingEntityId && sourceIds.has(candidate.existingEntityId);
    const learnedName =
      candidate.entityType === request.entityType &&
      initialSurfaceKeys.has(normaliseIdentitySurface(candidate.name));
    return pointsAtSource || learnedName;
  });
  const candidates = [...directCandidates, ...automaticallyRelinkedCandidates];

  const aliasNames = unique([
    ...(targetEntity?.aliases ?? []),
    ...sourceEntities.flatMap((entity) => [entity.name, ...entity.aliases]),
    ...candidates.flatMap((candidate) => [
      candidate.name,
      ...((Array.isArray(candidate.suggestedChanges?.aliases)
        ? candidate.suggestedChanges?.aliases
        : []) as string[]),
    ]),
  ]).filter((name) => normaliseIdentitySurface(name) !== normaliseIdentitySurface(canonicalName));
  const aliases: MergeAliasOption[] = aliasNames.map((name) => {
    const alreadyCanonical = targetEntity?.aliases.includes(name) ?? false;
    return {
      name,
      include: true,
      classification: aliasClassification(name),
      source: alreadyCanonical
        ? 'Already on canonical entity'
        : sourceEntities.some((entity) => entity.name === name || entity.aliases.includes(name))
          ? 'Dragged entity'
          : 'Extraction',
      locked: alreadyCanonical,
    };
  });

  const incoming = new Map<string, MergeIncomingValue[]>();
  const push = (key: string, row: MergeIncomingValue) => {
    incoming.set(key, [...(incoming.get(key) ?? []), row]);
  };
  for (const entity of sourceEntities) {
    if (entity.summary) push('__summary', { sourceId: entity.id, sourceLabel: entity.name, value: entity.summary });
    for (const [key, value] of Object.entries(entity.fields)) {
      if (key === 'timelineFacts' || key === 'travelTimeline' || key === 'characterVisits') continue;
      push(key, { sourceId: entity.id, sourceLabel: entity.name, value });
    }
  }
  for (const candidate of candidates) {
    if (candidate.summary) {
      push('__summary', {
        sourceId: candidate.id,
        sourceLabel: candidate.name,
        value: candidate.summary,
        chapterId: candidate.chapterId,
        chapterLabel: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.label : undefined,
        chapterOrder: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.order ?? null : null,
        sourceQuote: candidate.sourceQuote,
      });
    }
    for (const [rawKey, rawValue] of Object.entries(candidate.suggestedChanges ?? {})) {
      if (rawKey === 'aliases' || rawValue == null) continue;
      let key = rawKey;
      let value = rawValue;
      if (rawKey === 'location' && typeof rawValue === 'string') {
        const location = await db.entities.get(rawValue);
        if (location) {
          key = 'currentLocation';
          value = { id: location.id, type: location.type, name: location.name } satisfies EntityRef;
        }
      }
      push(key, {
        sourceId: candidate.id,
        sourceLabel: candidate.name,
        value,
        chapterId: candidate.chapterId,
        chapterLabel: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.label : undefined,
        chapterOrder: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.order ?? null : null,
        sourceQuote: candidate.sourceQuote,
      });
    }
  }

  const fields: MergeFieldRow[] = [...incoming.entries()].map(([key, values]) => {
    const existingValue = key === '__summary' ? targetEntity?.summary : targetEntity?.fields[key];
    const defaultDecision = recommendedDecision(
      existingValue,
      values.map((row) => row.value)
    );
    return {
      key,
      label: fieldLabel(key),
      existingValue,
      incoming: values,
      defaultDecision,
      hasConflict:
        existingValue !== undefined &&
        existingValue !== null &&
        values.some((row) => stable(row.value) !== stable(existingValue)),
    };
  });

  const existingFacts = targetEntity ? sourceFacts(targetEntity) : [];
  const sourceEntityFacts = sourceEntities.flatMap(sourceFacts);
  const candidateFacts = await Promise.all(candidates.map((candidate) => candidateToChapterFact(candidate, lookup)));
  const chronology: MergeChronologyRow[] = [
    ...mergeChapterFacts([], existingFacts, lookup).map((fact) => ({ ...fact, source: 'existing' as const })),
    ...mergeChapterFacts([], [...sourceEntityFacts, ...candidateFacts], lookup).map((fact) => ({
      ...fact,
      source: 'incoming' as const,
      insertionNote: chapterInsertionDescription(fact.chapterId ?? undefined, existingFacts, lookup),
    })),
  ].sort((a, b) => {
    const ao = a.chapterOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.chapterOrder ?? Number.MAX_SAFE_INTEGER;
    return ao - bo || a.createdAt - b.createdAt;
  });

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const [allOccurrences, allLinks, allEntities] = await Promise.all([
    db.occurrences.where('projectId').equals(projectId).toArray(),
    db.links.where('projectId').equals(projectId).toArray(),
    db.entities.where('projectId').equals(projectId).toArray(),
  ]);
  const allAffectedCandidateIds = candidateIds;
  const affectedOccurrences = allOccurrences.filter(
    (occurrence) =>
      (occurrence.entityId != null && sourceIds.has(occurrence.entityId)) ||
      (occurrence.candidateId != null && allAffectedCandidateIds.has(occurrence.candidateId))
  );
  const affectedLinks = allLinks.filter(
    (link) => sourceIds.has(link.from.id) || sourceIds.has(link.to.id)
  );
  const referencedEntities = allEntities.filter(
    (entity) => !sourceIds.has(entity.id) && containsEntityId(entity.fields, sourceIds)
  );
  const locationIds = unique([
    ...candidates
      .map((candidate) => candidate.suggestedChanges?.location)
      .filter((id): id is string => typeof id === 'string'),
    ...chronology
      .map((fact) => fact.location?.id)
      .filter((id): id is string => typeof id === 'string'),
  ]);
  const entityNameById = new Map(allEntities.map((entity) => [entity.id, entity.name]));
  const targetDisplayName = targetEntity?.name ?? canonicalName;
  const queueDetails = [
    ...directCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      direct: true,
      reason: 'Selected for this identity decision',
      chapterLabel: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.label ?? 'Removed or unknown chapter' : 'No chapter',
    })),
    ...automaticallyRelinkedCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      direct: false,
      reason: candidate.existingEntityId && sourceIds.has(candidate.existingEntityId)
        ? 'Currently points at a source entity that will redirect'
        : 'Uses a name that this merge will teach as canonical',
      chapterLabel: candidate.chapterId ? lookup.byId.get(candidate.chapterId)?.label ?? 'Removed or unknown chapter' : 'No chapter',
    })),
  ];
  const occurrenceDetails = affectedOccurrences.map((occurrence) => ({
    id: occurrence.id,
    exactText: occurrence.exactText,
    chapterLabel: lookup.byId.get(occurrence.chapterId)?.label ?? 'Removed or unknown chapter',
    before: occurrence.entityId ? entityNameById.get(occurrence.entityId) ?? occurrence.entityId : 'Pending extraction',
    after: targetDisplayName,
  }));
  const linkDetails = affectedLinks.map((link) => {
    const nextFrom = sourceIds.has(link.from.id) ? targetDisplayName : link.from.name;
    const nextTo = sourceIds.has(link.to.id) ? targetDisplayName : link.to.name;
    return {
      id: link.id,
      kind: link.kind,
      before: `${link.from.name} → ${link.to.name}`,
      after: `${nextFrom} → ${nextTo}`,
    };
  });
  const referencedEntityDetails = referencedEntities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    entityType: entity.type,
    fieldPaths: entityReferencePaths(entity.fields, sourceIds),
  }));
  const locationDetails = locationIds.map((id) => {
    const location = allEntities.find((entity) => entity.id === id);
    const facts = chronology.filter((fact) => fact.location?.id === id && fact.source === 'incoming');
    return {
      id,
      name: location?.name ?? id,
      visitCount: facts.length,
      chapters: unique(facts.map((fact) => fact.chapterLabel)),
    };
  });

  const warnings: string[] = [];
  if (fields.some((field) => field.hasConflict)) {
    warnings.push(`${fields.filter((field) => field.hasConflict).length} fields contain competing information and need an explicit decision.`);
  }
  if (sourceEntities.length > 0) {
    warnings.push('Source entities will remain as hidden redirects, so old ids and audit history stay recoverable.');
  }
  if (chronology.some((row) => row.source === 'incoming' && row.insertionNote?.startsWith('Inserted between'))) {
    warnings.push('New chapter evidence will be inserted by stable chapter id; later chapter-number changes update every linked view without re-extraction.');
  }
  const missingChapterFacts = chronology.filter((row) => row.chapterMissing);
  if (missingChapterFacts.length) {
    warnings.push(`${missingChapterFacts.length} piece${missingChapterFacts.length === 1 ? '' : 's'} of evidence belong to removed chapters. They will be preserved as unplaced historical evidence until the chapter is restored or reassigned.`);
  }
  const identityRules = await db.identityRules
    .where('[projectId+entityType]')
    .equals([projectId, request.entityType])
    .toArray();
  const aliasKeys = new Set([canonicalName, ...aliasNames].map(normaliseIdentitySurface));
  const collisions = identityRules.filter(
    (rule) =>
      rule.kind === 'same' &&
      aliasKeys.has(rule.surface) &&
      !!rule.canonicalEntityId &&
      rule.canonicalEntityId !== targetEntity?.id &&
      !sourceIds.has(rule.canonicalEntityId)
  );
  if (collisions.length) {
    warnings.push(`${collisions.length} learned name mapping${collisions.length === 1 ? '' : 's'} currently point elsewhere. Confirming will make this canonical decision authoritative.`);
  }

  return {
    projectId,
    entityType: request.entityType,
    request,
    targetEntity,
    sourceEntities,
    candidates,
    canonicalName,
    aliases,
    fields,
    chronology,
    affected: {
      candidateCount: candidates.length,
      directCandidateCount: directCandidates.length,
      rescoreCandidateCount: automaticallyRelinkedCandidates.length,
      sourceEntityCount: sourceEntities.length,
      occurrenceCount: affectedOccurrences.length,
      linkCount: affectedLinks.length,
      referencedEntityCount: referencedEntities.length,
      chapterCount: unique(
        chronology.map((row) => row.chapterId).filter((id): id is string => !!id)
      ).length,
      locationCount: locationIds.length,
    },
    details: {
      queue: queueDetails,
      occurrences: occurrenceDetails,
      links: linkDetails,
      referencedEntities: referencedEntityDetails,
      locations: locationDetails,
    },
    warnings,
  };
}

function applyFieldDecisions(
  preview: MergePreview,
  decisions: Record<string, MergeFieldDecision>
): { summary: string; fields: Record<string, unknown> } {
  const summary = preview.targetEntity?.summary ?? '';
  const fields = { ...(preview.targetEntity?.fields ?? {}) };
  const history = Array.isArray(fields.fieldHistory)
    ? ([...fields.fieldHistory] as Record<string, unknown>[])
    : [];
  let nextSummary = summary;
  for (const row of preview.fields) {
    const decision = decisions[row.key] ?? row.defaultDecision;
    if (decision === 'skip' || decision === 'keep-existing') continue;
    const incomingValues = row.incoming.map((item) => item.value);
    const incomingLatest = latestIncoming(row);
    if (decision === 'historical') {
      for (const incoming of row.incoming) {
        history.push({
          id: newId(),
          field: row.key,
          value: incoming.value,
          chapterId: incoming.chapterId ?? null,
          chapterLabel: incoming.chapterLabel ?? null,
          sourceQuote: incoming.sourceQuote ?? null,
          sourceLabel: incoming.sourceLabel,
          recordedAt: Date.now(),
        });
      }
      continue;
    }
    const value =
      decision === 'combine'
        ? combineValues(row.existingValue, incomingValues)
        : incomingLatest;
    if (row.key === '__summary') nextSummary = typeof value === 'string' ? value : stable(value);
    else fields[row.key] = value;
  }
  if (history.length) fields.fieldHistory = history;
  return { summary: nextSummary, fields };
}

function dedupeRefs(rows: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function syncTravelFields(fields: Record<string, unknown>, lookup: ChapterLookup): Record<string, unknown> {
  const facts = Array.isArray(fields.travelTimeline)
    ? mergeChapterFacts([], fields.travelTimeline as ChapterAnchoredFact[], lookup)
    : [];
  if (!facts.length) return fields;
  const refs = dedupeRefs(
    facts.map((fact) => fact.location).filter((ref): ref is EntityRef => !!ref)
  );
  return {
    ...fields,
    travelTimeline: facts,
    travelHistory: refs,
    currentLocation: refs[refs.length - 1] ?? null,
    firstAppearance: facts[0]?.chapterLabel ?? fields.firstAppearance,
    lastAppearance: facts[facts.length - 1]?.chapterLabel ?? fields.lastAppearance,
  };
}

function makeSameRule(
  projectId: string,
  entityType: EntityType,
  surface: string,
  canonicalEntityId: string
): IdentityRule {
  const now = Date.now();
  return {
    id: newId(),
    projectId,
    entityType,
    kind: 'same',
    surface: normaliseIdentitySurface(surface),
    canonicalEntityId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function commitMerge(
  preview: MergePreview,
  options: CommitMergeOptions
): Promise<CommitMergeResult> {
  const fresh = await buildMergePreview(preview.request);
  const lookup = await buildChapterLookup(fresh.projectId);
  const sourceIds = new Set(fresh.sourceEntities.map((entity) => entity.id));
  const candidateIds = new Set(fresh.candidates.map((candidate) => candidate.id));
  const now = Date.now();
  const targetId = fresh.targetEntity?.id ?? newId();
  const targetRef: EntityRef = {
    id: targetId,
    type: fresh.entityType,
    name: options.canonicalName.trim() || fresh.canonicalName,
  };

  const allEntities = await db.entities.where('projectId').equals(fresh.projectId).toArray();
  const affectedEntitiesBefore = allEntities.filter(
    (entity) =>
      !sourceIds.has(entity.id) &&
      entity.id !== targetId &&
      containsEntityId(entity.fields, sourceIds)
  );
  const allLinks = await db.links.where('projectId').equals(fresh.projectId).toArray();
  const linksBefore = allLinks.filter((link) => sourceIds.has(link.from.id) || sourceIds.has(link.to.id));
  const pendingCandidates = await db.candidates
    .where('[projectId+status]')
    .equals([fresh.projectId, 'pending'])
    .toArray();

  // A canonical decision can update more than the cards explicitly included in
  // the preview: pending rows that still point at a source entity, and future
  // duplicates that use one of the newly learned names, are re-linked too.
  // Snapshot every one of those rows (and their occurrences) so Undo is exact.
  const preliminaryLearnedSurfaces = new Set(
    unique([
      fresh.targetEntity?.name ?? options.canonicalName,
      ...(fresh.targetEntity?.aliases ?? []),
      ...fresh.sourceEntities.flatMap((entity) => [entity.name, ...entity.aliases]),
      ...fresh.candidates.map((candidate) => candidate.name),
      ...options.aliases.filter((alias) => alias.include || alias.locked).map((alias) => alias.name),
    ]).map(normaliseIdentitySurface)
  );
  const candidateSnapshots = pendingCandidates.filter((candidate) => {
    if (candidateIds.has(candidate.id)) return true;
    const pointsAtSource = !!candidate.existingEntityId && sourceIds.has(candidate.existingEntityId);
    const learnedName =
      candidate.entityType === fresh.entityType &&
      preliminaryLearnedSurfaces.has(normaliseIdentitySurface(candidate.name));
    return pointsAtSource || learnedName;
  });
  const snapshottedCandidateIds = new Set(candidateSnapshots.map((candidate) => candidate.id));

  const allOccurrences = await db.occurrences.where('projectId').equals(fresh.projectId).toArray();
  const occurrencesBefore = allOccurrences.filter(
    (occurrence) =>
      (occurrence.entityId != null && sourceIds.has(occurrence.entityId)) ||
      (occurrence.candidateId != null && snapshottedCandidateIds.has(occurrence.candidateId))
  );

  const { summary, fields: resolvedFields } = applyFieldDecisions(fresh, options.fieldDecisions);
  const existingTimeline = Array.isArray(resolvedFields.timelineFacts)
    ? (resolvedFields.timelineFacts as ChapterAnchoredFact[])
    : [];
  const sourceTimeline = fresh.sourceEntities.flatMap(sourceFacts);
  const candidateFacts = await Promise.all(fresh.candidates.map((candidate) => candidateToChapterFact(candidate, lookup)));
  let fields: Record<string, unknown> = {
    ...resolvedFields,
    timelineFacts: mergeChapterFacts(existingTimeline, [...sourceTimeline, ...candidateFacts], lookup),
  };
  const existingTravel = Array.isArray(fields.travelTimeline)
    ? (fields.travelTimeline as ChapterAnchoredFact[])
    : [];
  const incomingTravel = [...sourceTimeline, ...candidateFacts].filter((fact) => !!fact.location);
  if (existingTravel.length || incomingTravel.length) {
    fields.travelTimeline = mergeChapterFacts(existingTravel, incomingTravel, lookup);
  }
  fields = syncTravelFields(fields, lookup);
  fields = rewriteEntityIds(fields, sourceIds, targetRef) as Record<string, unknown>;

  const selectedAliases = options.aliases.filter((alias) => alias.include || alias.locked);
  const aliases = unique([
    ...(fresh.targetEntity?.aliases ?? []),
    ...selectedAliases
      .filter((alias) => alias.classification !== 'description')
      .map((alias) => alias.name.trim())
      .filter(Boolean),
  ]).filter((name) => normaliseIdentitySurface(name) !== normaliseIdentitySurface(targetRef.name));
  const descriptions = selectedAliases
    .filter((alias) => alias.classification === 'description')
    .map((alias) => alias.name);
  if (descriptions.length) {
    const prior = Array.isArray(fields.identityNotes) ? (fields.identityNotes as string[]) : [];
    fields.identityNotes = unique([...prior, ...descriptions]);
  }
  const priorIdentityAliases = Array.isArray(fields.identityAliases)
    ? (fields.identityAliases as Record<string, unknown>[])
    : [];
  fields.identityAliases = [
    ...priorIdentityAliases,
    ...selectedAliases.map((alias) => ({
      name: alias.name,
      classification: alias.classification,
      source: alias.source,
      confirmedAt: now,
    })),
  ].filter(
    (row, index, rows) =>
      rows.findIndex(
        (other) =>
          normaliseIdentitySurface(String(other.name ?? '')) ===
          normaliseIdentitySurface(String(row.name ?? ''))
      ) === index
  );

  const target: Entity = fresh.targetEntity
    ? {
        ...fresh.targetEntity,
        name: targetRef.name,
        aliases,
        summary,
        fields,
        tags: unique([...fresh.targetEntity.tags, ...fresh.sourceEntities.flatMap((entity) => entity.tags)]),
        updatedAt: now,
      }
    : {
        id: targetId,
        projectId: fresh.projectId,
        type: fresh.entityType,
        name: targetRef.name,
        aliases,
        summary,
        status: 'active',
        tags: unique(fresh.sourceEntities.flatMap((entity) => entity.tags)),
        fields,
        createdAt: now,
        updatedAt: now,
      };

  const locationIds = unique(
    (target.fields.travelTimeline as ChapterAnchoredFact[] | undefined)
      ?.map((fact) => fact.location?.id)
      .filter((id): id is string => !!id) ?? []
  );
  const locations = (
    await Promise.all(locationIds.map((id) => db.entities.get(id)))
  ).filter((entity): entity is Entity => !!entity);
  const locationBefore = locations.filter(
    (entity) => !affectedEntitiesBefore.some((before) => before.id === entity.id)
  );
  affectedEntitiesBefore.push(...locationBefore);

  const identitySurfaces = unique([
    target.name,
    ...target.aliases,
    ...fresh.sourceEntities.flatMap((entity) => [entity.name, ...entity.aliases]),
    ...fresh.candidates.map((candidate) => candidate.name),
  ]);
  const existingSameRules = await db.identityRules
    .where('[projectId+entityType]')
    .equals([fresh.projectId, fresh.entityType])
    .filter((rule) => rule.kind === 'same' && rule.canonicalEntityId === target.id)
    .toArray();
  const existingRuleKeys = new Set(existingSameRules.map((rule) => rule.surface));
  const rules = identitySurfaces
    .map((surface) => makeSameRule(fresh.projectId, fresh.entityType, surface, target.id))
    .filter((rule) => !existingRuleKeys.has(rule.surface));
  const learnedSurfaces = new Set(identitySurfaces.map(normaliseIdentitySurface));
  const identityRulesBefore = (await db.identityRules
    .where('[projectId+entityType]')
    .equals([fresh.projectId, fresh.entityType])
    .toArray())
    .filter(
      (rule) =>
        rule.kind === 'same' &&
        learnedSurfaces.has(rule.surface) &&
        rule.canonicalEntityId !== target.id
    );

  const receipt: MergeReceipt = {
    id: newId(),
    projectId: fresh.projectId,
    targetEntityId: target.id,
    targetCreated: !fresh.targetEntity,
    targetBefore: fresh.targetEntity,
    sourceEntitiesBefore: fresh.sourceEntities,
    affectedEntitiesBefore,
    linksBefore,
    occurrencesBefore,
    candidatesBefore: candidateSnapshots,
    identityRuleIds: rules.map((rule) => rule.id),
    identityRulesBefore,
    createdAt: now,
  };

  await db.transaction(
    'rw',
    [
      db.entities,
      db.links,
      db.occurrences,
      db.candidates,
      db.identityRules,
      db.mergeReceipts,
    ],
    async () => {
      await db.entities.put(target);

      for (const entity of affectedEntitiesBefore) {
        if (locationIds.includes(entity.id) && target.type === 'cast') {
          const characters = Array.isArray(entity.fields.characters)
            ? (entity.fields.characters as EntityRef[])
            : [];
          const visits = Array.isArray(entity.fields.characterVisits)
            ? (entity.fields.characterVisits as Record<string, unknown>[])
            : [];
          const targetVisits = (target.fields.travelTimeline as ChapterAnchoredFact[] | undefined)?.filter(
            (fact) => fact.location?.id === entity.id
          ) ?? [];
          const nextVisits = [
            ...visits,
            ...targetVisits.map((fact) => ({
              id: `${target.id}:${fact.id}`,
              character: targetRef,
              kind: 'location-visit',
              sourceEntityId: target.id,
              chapterId: fact.chapterId,
              chapterOrder: fact.chapterOrder,
              chapterLabel: fact.chapterLabel,
              sourceQuote: fact.sourceQuote,
              summary: `${target.name} visited ${entity.name}`,
              createdAt: fact.createdAt,
            })),
          ].filter(
            (visit, index, rows) =>
              rows.findIndex((other) => String(other.id) === String(visit.id)) === index
          );
          await db.entities.update(entity.id, {
            fields: {
              ...(rewriteEntityIds(entity.fields, sourceIds, targetRef) as Record<string, unknown>),
              characters: dedupeRefs([...characters, targetRef]),
              characterVisits: nextVisits,
            },
            updatedAt: now,
          });
        } else {
          await db.entities.update(entity.id, {
            fields: rewriteEntityIds(entity.fields, sourceIds, targetRef) as Record<string, unknown>,
            updatedAt: now,
          });
        }
      }

      for (const source of fresh.sourceEntities) {
        await db.entities.put({
          ...source,
          status: 'merged',
          mergedIntoId: target.id,
          mergedAt: now,
          updatedAt: now,
        });
      }

      for (const link of linksBefore) {
        const rewritten = {
          ...link,
          from: sourceIds.has(link.from.id) ? targetRef : link.from,
          to: sourceIds.has(link.to.id) ? targetRef : link.to,
          source: 'merge' as const,
        };
        if (rewritten.from.id === rewritten.to.id) {
          await db.links.delete(link.id);
          continue;
        }
        const duplicate = allLinks.find(
          (other) =>
            other.id !== link.id &&
            other.kind === rewritten.kind &&
            other.from.id === rewritten.from.id &&
            other.to.id === rewritten.to.id
        );
        if (duplicate) await db.links.delete(link.id);
        else await db.links.put(rewritten);
      }

      for (const occurrence of occurrencesBefore) {
        await db.occurrences.put({
          ...occurrence,
          entityId: target.id,
          entityType: target.type,
        });
      }

      for (const candidate of pendingCandidates) {
        if (candidateIds.has(candidate.id)) {
          const mergedDecision =
            fresh.candidates.length > 1 ||
            fresh.sourceEntities.length > 0 ||
            candidate.suggestedAction === 'merge';
          await db.candidates.update(candidate.id, {
            status: mergedDecision ? 'merged' : 'accepted',
            acceptedEntityId: target.id,
            existingEntityId: target.id,
          });
          continue;
        }
        const pointsAtSource = !!candidate.existingEntityId && sourceIds.has(candidate.existingEntityId);
        const learnedName =
          candidate.entityType === target.type &&
          learnedSurfaces.has(normaliseIdentitySurface(candidate.name));
        if (pointsAtSource || learnedName) {
          await db.candidates.update(candidate.id, {
            existingEntityId: target.id,
            matchType: 'exact',
            suggestedAction: candidate.suggestedAction === 'create' ? 'merge' : candidate.suggestedAction,
            suggestedChanges: rewriteEntityIds(
              candidate.suggestedChanges ?? null,
              sourceIds,
              targetRef
            ) as Record<string, unknown> | null,
            relatedEntityIds: unique(
              (candidate.relatedEntityIds ?? []).map((id) => (sourceIds.has(id) ? target.id : id))
            ),
          });
          await db.occurrences.where('candidateId').equals(candidate.id).modify({
            entityId: target.id,
            entityType: target.type,
          });
        }
      }

      const conflictingRuleIds = identityRulesBefore.map((rule) => rule.id);
      if (conflictingRuleIds.length) await db.identityRules.bulkDelete(conflictingRuleIds);
      if (rules.length) await db.identityRules.bulkAdd(rules);
      await db.mergeReceipts.add(receipt);
    }
  );

  await logAudit({
    projectId: fresh.projectId,
    action: 'entity.merge',
    target: { table: 'entities', id: target.id, label: target.name },
    before: {
      target: fresh.targetEntity,
      sources: fresh.sourceEntities,
      candidates: fresh.candidates,
    },
    after: { receiptId: receipt.id, target },
    reversible: true,
  });
  return { entity: target, receipt };
}

export async function undoMergeReceipt(receiptId: string): Promise<boolean> {
  const receipt = await db.mergeReceipts.get(receiptId);
  if (!receipt || receipt.undoneAt) return false;
  const currentTarget = await db.entities.get(receipt.targetEntityId);
  await db.transaction(
    'rw',
    [
      db.entities,
      db.links,
      db.occurrences,
      db.candidates,
      db.identityRules,
      db.mergeReceipts,
    ],
    async () => {
      if (receipt.targetCreated) await db.entities.delete(receipt.targetEntityId);
      else if (receipt.targetBefore) await db.entities.put(receipt.targetBefore);
      if (receipt.sourceEntitiesBefore.length) await db.entities.bulkPut(receipt.sourceEntitiesBefore);
      if (receipt.affectedEntitiesBefore.length) await db.entities.bulkPut(receipt.affectedEntitiesBefore);
      if (receipt.linksBefore.length) await db.links.bulkPut(receipt.linksBefore);
      if (receipt.occurrencesBefore.length) await db.occurrences.bulkPut(receipt.occurrencesBefore);
      if (receipt.candidatesBefore.length) await db.candidates.bulkPut(receipt.candidatesBefore);
      if (receipt.identityRuleIds.length) await db.identityRules.bulkDelete(receipt.identityRuleIds);
      if (receipt.identityRulesBefore?.length) await db.identityRules.bulkPut(receipt.identityRulesBefore);
      await db.mergeReceipts.update(receipt.id, { undoneAt: Date.now() });
    }
  );
  await logAudit({
    projectId: receipt.projectId,
    action: 'entity.merge.undo',
    target: {
      table: 'mergeReceipts',
      id: receipt.id,
      label: currentTarget?.name ?? receipt.targetEntityId,
    },
    before: currentTarget ?? null,
    after: receipt.targetBefore,
  });
  return true;
}

export async function mergeEntityRecordsDirect(
  sourceId: string,
  targetId: string
): Promise<Entity | null> {
  const source = await db.entities.get(sourceId);
  const target = await db.entities.get(targetId);
  if (!source || !target || source.projectId !== target.projectId || source.type !== target.type) return null;
  const preview = await buildMergePreview({
    entityType: target.type,
    sourceEntityIds: [source.id],
    targetEntityId: target.id,
  });
  const result = await commitMerge(preview, {
    canonicalName: target.name,
    aliases: preview.aliases,
    fieldDecisions: Object.fromEntries(
      preview.fields.map((field) => [field.key, field.defaultDecision])
    ),
  });
  return result.entity;
}
