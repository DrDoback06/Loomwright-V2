import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { Chapter, Entity, ReviewCandidate } from '@/db/types';
import { createEntity, getEntityRecord } from '@/db/repos/entities';
import { createChapter, deleteChapterToTrash } from '@/db/repos/chapters';
import { restoreFromTrash } from '@/db/repos/trash';
import { rememberDifferentIdentity } from '@/db/repos/identity';
import {
  buildMergePreview,
  commitMerge,
  resolveMergeFieldPreview,
  undoMergeReceipt,
} from '@/db/repos/merge';
import { buildIdentityClusters } from '@/services/identity-resolution';
import type { ChapterAnchoredFact } from '@/services/chapter-awareness';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

function candidate(input: Partial<ReviewCandidate> & Pick<ReviewCandidate, 'id' | 'projectId' | 'entityType' | 'name'>): ReviewCandidate {
  return {
    suggestedAction: 'create',
    matchType: 'new',
    existingEntityId: null,
    suggestedChanges: null,
    confidence: 0.84,
    confidenceBand: 'green',
    sourceQuote: `${input.name} appeared.`,
    sourceQuotes: [`${input.name} appeared.`],
    relatedEntityIds: [],
    summary: `${input.name} was mentioned.`,
    status: 'pending',
    source: 'local',
    createdAt: Date.now(),
    ...input,
  };
}

async function addProject(id = 'project-identity') {
  await db.projects.add({ id, name: 'Identity Test', createdAt: 1, updatedAt: 1 });
  return id;
}

describe('smart identity clustering', () => {
  it('clusters a short name with its fuller name, then honours a user keep-separate rule', async () => {
    const projectId = await addProject();
    await db.candidates.bulkAdd([
      candidate({ id: 'c-graham', projectId, entityType: 'cast', name: 'Graham' }),
      candidate({ id: 'c-graham-h', projectId, entityType: 'cast', name: 'Graham Hendricks' }),
    ]);

    const grouped = await buildIdentityClusters(projectId);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].candidateIds).toHaveLength(2);
    expect(grouped[0].primaryName).toBe('Graham Hendricks');
    expect(grouped[0].proposedAliases).toContain('Graham');

    await rememberDifferentIdentity({
      projectId,
      entityType: 'cast',
      left: 'Graham',
      right: 'Graham Hendricks',
    });

    const separated = await buildIdentityClusters(projectId);
    expect(separated).toHaveLength(2);
    expect(separated.every((cluster) => cluster.candidateIds.length === 1)).toBe(true);
  });
});

describe('project-wide merge transaction', () => {
  it('previews chronology exactly, merges every linked surface, learns aliases, and fully undoes', async () => {
    const projectId = await addProject('project-merge');

    const places: Entity[] = [];
    for (const name of ['North Gate', 'Ash Road', 'Old Keep', 'River Ward', 'South Reach', 'Lantern Market']) {
      places.push(await createEntity({ projectId, type: 'locations', name }));
    }

    const chapters: Chapter[] = [];
    for (let index = 1; index <= 5; index += 1) {
      chapters.push(await createChapter(projectId, `Original ${index}`));
    }

    const fact = (index: number): ChapterAnchoredFact => ({
      id: `travel-${index}`,
      chapterId: chapters[index].id,
      chapterOrder: index,
      chapterLabel: `Chapter ${index + 1} · Original ${index + 1}`,
      kind: 'travel',
      summary: `Graham Hendricks visited ${places[index].name}`,
      location: { id: places[index].id, type: 'locations', name: places[index].name },
      createdAt: index + 1,
    });

    const target = await createEntity({
      projectId,
      type: 'cast',
      name: 'Graham Hendricks',
      summary: 'A courier with a long route.',
      fields: {
        travelTimeline: [fact(0), fact(1), fact(2), fact(3), fact(4)],
        timelineFacts: [fact(0), fact(1), fact(2), fact(3), fact(4)],
      },
    });
    const source = await createEntity({
      projectId,
      type: 'cast',
      name: 'Graham',
      summary: 'The courier seen in the market.',
      fields: { occupation: 'Courier', temperament: 'Watchful' },
    });
    const item = await createEntity({
      projectId,
      type: 'items',
      name: 'Courier Satchel',
      fields: { owner: { id: source.id, type: 'cast', name: source.name } },
    });

    await db.links.add({
      id: 'link-source-place',
      projectId,
      from: { id: source.id, type: 'cast', name: source.name },
      to: { id: places[0].id, type: 'locations', name: places[0].name },
      kind: 'visited',
      source: 'manual',
      createdAt: 1,
    });

    // Insert between original chapters 3 and 4. The stable ids survive while
    // all later display numbers become 5 and 6 without extraction running.
    const inserted = await createChapter(projectId, 'The Lantern Detour', chapters[2].id);
    const refreshedTarget = (await db.entities.get(target.id))!;
    const refreshedTravel = refreshedTarget.fields.travelTimeline as ChapterAnchoredFact[];
    expect(refreshedTravel.map((row) => row.chapterOrder)).toEqual([0, 1, 2, 4, 5]);
    expect(refreshedTravel[3].chapterLabel).toContain('Chapter 5');

    const selected = candidate({
      id: 'candidate-selected',
      projectId,
      chapterId: inserted.id,
      entityType: 'cast',
      name: 'Graham',
      suggestedAction: 'merge',
      matchType: 'nickname',
      existingEntityId: source.id,
      suggestedChanges: { location: places[5].id, mood: 'Uneasy' },
      sourceQuote: 'Graham crossed Lantern Market before dawn.',
      sourceQuotes: ['Graham crossed Lantern Market before dawn.'],
      summary: 'Graham visits Lantern Market between the Old Keep and River Ward legs.',
    });
    const implicit = candidate({
      id: 'candidate-implicit',
      projectId,
      chapterId: chapters[4].id,
      entityType: 'cast',
      name: 'Graham',
      suggestedAction: 'update',
      matchType: 'exact',
      existingEntityId: source.id,
      suggestedChanges: { status: 'Resting' },
      sourceQuote: 'Graham finally rested in the South Reach.',
    });
    await db.candidates.bulkAdd([selected, implicit]);
    await db.occurrences.bulkAdd([
      {
        id: 'occ-selected', projectId, entityId: null, entityType: 'cast', chapterId: inserted.id,
        paragraphId: null, start: 0, end: 6, exactText: 'Graham', candidateId: selected.id, createdAt: 1,
      },
      {
        id: 'occ-implicit', projectId, entityId: source.id, entityType: 'cast', chapterId: chapters[4].id,
        paragraphId: null, start: 0, end: 6, exactText: 'Graham', candidateId: implicit.id, createdAt: 2,
      },
    ]);

    const preview = await buildMergePreview({
      entityType: 'cast',
      candidateIds: [selected.id],
      sourceEntityIds: [source.id],
      targetEntityId: target.id,
    });
    expect(preview.affected.directCandidateCount).toBe(1);
    expect(preview.affected.rescoreCandidateCount).toBe(1);
    expect(preview.affected.occurrenceCount).toBe(2);
    expect(preview.candidates.map((row) => row.id).sort()).toEqual([implicit.id, selected.id].sort());
    expect(preview.details.queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: selected.id, direct: true }),
      expect.objectContaining({ id: implicit.id, direct: false }),
    ]));
    expect(preview.details.occurrences).toHaveLength(2);
    const statusField = preview.fields.find((row) => row.key === 'status')!;
    expect(resolveMergeFieldPreview(statusField, statusField.defaultDecision)).toBe('Resting');
    const incomingChronology = preview.chronology.find((row) => row.candidateId === selected.id)!;
    expect(incomingChronology.chapterOrder).toBe(3);
    expect(incomingChronology.insertionNote).toContain('Inserted between');
    expect(incomingChronology.insertionNote).toContain('Chapter 3');
    expect(incomingChronology.insertionNote).toContain('Chapter 5');

    const result = await commitMerge(preview, {
      canonicalName: target.name,
      aliases: preview.aliases,
      fieldDecisions: Object.fromEntries(preview.fields.map((row) => [row.key, row.defaultDecision])),
    });

    const canonical = (await db.entities.get(target.id))!;
    expect(canonical.aliases).toContain('Graham');
    expect(canonical.fields.occupation).toBe('Courier');
    const mergedTravel = canonical.fields.travelTimeline as ChapterAnchoredFact[];
    expect(mergedTravel.map((row) => row.chapterOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(mergedTravel[3].location?.id).toBe(places[5].id);
    // The inserted visit is chronological, not incorrectly treated as current.
    expect((canonical.fields.currentLocation as { id: string }).id).toBe(places[4].id);

    const redirect = await getEntityRecord(source.id);
    expect(redirect?.status).toBe('merged');
    expect(redirect?.mergedIntoId).toBe(target.id);
    expect(((await db.entities.get(item.id))!.fields.owner as { id: string }).id).toBe(target.id);
    const link = (await db.links.get('link-source-place'))!;
    expect(link.from.id).toBe(target.id);
    expect((await db.occurrences.toArray()).every((row) => row.entityId === target.id)).toBe(true);

    const selectedAfter = (await db.candidates.get(selected.id))!;
    const implicitAfter = (await db.candidates.get(implicit.id))!;
    expect(selectedAfter.status).toBe('merged');
    expect(selectedAfter.acceptedEntityId).toBe(target.id);
    expect(implicitAfter.status).toBe('merged');
    expect(implicitAfter.acceptedEntityId).toBe(target.id);
    expect(canonical.fields.status).toBe('Resting');

    const rules = await db.identityRules.where('projectId').equals(projectId).toArray();
    expect(rules.some((rule) => rule.surface === 'graham' && rule.canonicalEntityId === target.id)).toBe(true);
    const market = (await db.entities.get(places[5].id))!;
    const visits = market.fields.characterVisits as { character: { id: string }; chapterOrder: number }[];
    expect(visits.some((visit) => visit.character.id === target.id && visit.chapterOrder === 3)).toBe(true);

    const receipt = (await db.mergeReceipts.get(result.receipt.id))!;
    expect(receipt.candidatesBefore.map((row) => row.id).sort()).toEqual([implicit.id, selected.id].sort());
    expect(receipt.occurrencesBefore.map((row) => row.id).sort()).toEqual(['occ-implicit', 'occ-selected']);

    expect(await undoMergeReceipt(result.receipt.id)).toBe(true);
    expect((await db.entities.get(target.id))?.aliases).not.toContain('Graham');
    expect((await db.entities.get(source.id))?.status).toBe('active');
    expect(((await db.entities.get(item.id))!.fields.owner as { id: string }).id).toBe(source.id);
    expect((await db.links.get('link-source-place'))?.from.id).toBe(source.id);
    expect((await db.occurrences.get('occ-selected'))?.entityId).toBeNull();
    expect((await db.occurrences.get('occ-implicit'))?.entityId).toBe(source.id);
    expect((await db.candidates.get(implicit.id))?.existingEntityId).toBe(source.id);
    expect((await db.candidates.get(implicit.id))?.status).toBe('pending');
    expect(await db.identityRules.where('projectId').equals(projectId).count()).toBe(0);
    const restoredMarket = (await db.entities.get(places[5].id))!;
    expect(restoredMarket.fields.characterVisits).toBeUndefined();
  });

  it('preserves evidence from a removed chapter instead of losing or renumbering it', async () => {
    const projectId = await addProject('project-removed-chapter');
    const chapter = await createChapter(projectId, 'A Lost Scene');
    const person = await createEntity({
      projectId,
      type: 'cast',
      name: 'Mara',
      fields: {
        timelineFacts: [{
          id: 'lost-fact', chapterId: chapter.id, chapterOrder: 0,
          chapterLabel: 'Chapter 1 · A Lost Scene', kind: 'knowledge', summary: 'Mara learned the truth.', createdAt: 1,
        } satisfies ChapterAnchoredFact],
      },
    });
    await deleteChapterToTrash(chapter.id);
    const row = ((await db.entities.get(person.id))!.fields.timelineFacts as ChapterAnchoredFact[])[0];
    expect(row.chapterMissing).toBe(true);
    expect(row.chapterOrder).toBeNull();
    expect(row.chapterLabel).toBe('Removed chapter · Chapter 1 · A Lost Scene');
    expect(row.summary).toBe('Mara learned the truth.');

    await restoreFromTrash(chapter.id);
    const restored = ((await db.entities.get(person.id))!.fields.timelineFacts as ChapterAnchoredFact[])[0];
    expect(restored.chapterMissing).toBeUndefined();
    expect(restored.chapterOrder).toBe(0);
    expect(restored.chapterLabel).toBe('Chapter 1 · A Lost Scene');
  });
});
