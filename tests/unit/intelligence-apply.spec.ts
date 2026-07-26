import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { undoAuditEntry } from '@/db/repos/undo';
import { applyDelta } from '@/services/intelligence/apply';
import { deltaTitle, emptyDelta, filterDelta, type StoryDelta } from '@/services/intelligence/types';

function deltaWith(overrides: Partial<StoryDelta>): StoryDelta {
  return { ...emptyDelta('d1', 'p1', 'local'), createdAt: 1, ...overrides };
}

/** Every unit needs the DeltaUnit envelope; tests only care about a few
 * fields, so this fills the rest with sane defaults. */
function unit(unitId: string, origin = 'test') {
  return { unitId, confidence: 0.8, confidenceBand: 'green' as const, sourceQuote: '…', origin };
}

describe('intelligence/applyDelta', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('replace patches genuinely flip a value that a field-bag merge could not', async () => {
    const marrow = await createEntity({ projectId: 'p1', type: 'cast', name: 'Marrow' });
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    const sword = await createEntity({
      projectId: 'p1',
      type: 'items',
      name: 'Saltbrand',
      fields: { currentOwner: { id: marrow.id, type: 'cast', name: 'Marrow' } },
    });

    const result = await applyDelta(
      deltaWith({
        patches: [
          {
            ...unit('u1', 'itemTransfer'),
            entityId: sword.id,
            entityType: 'items',
            entityName: 'Saltbrand',
            fieldId: 'currentOwner',
            fieldLabel: 'Current owner',
            before: { id: marrow.id, type: 'cast', name: 'Marrow' },
            after: { id: vex.id, type: 'cast', name: 'Vex' },
            mode: 'replace',
          },
        ],
      })
    );

    const after = await db.entities.get(sword.id);
    expect((after!.fields.currentOwner as { id: string }).id).toBe(vex.id);
    expect(result.updated.map((u) => u.id)).toContain(sword.id);
  });

  it('append patches grow a list without duplicating an entry already there', async () => {
    const skill = await createEntity({ projectId: 'p1', type: 'skills', name: 'Venom Strike' });
    const vex = await createEntity({
      projectId: 'p1',
      type: 'cast',
      name: 'Vex',
      fields: { skills: [{ id: skill.id, type: 'skills', name: 'Venom Strike' }] },
    });

    await applyDelta(
      deltaWith({
        patches: [
          {
            ...unit('u1', 'skill-learned'),
            entityId: vex.id,
            entityType: 'cast',
            entityName: 'Vex',
            fieldId: 'skills',
            fieldLabel: 'Skills',
            before: [{ id: skill.id, type: 'skills', name: 'Venom Strike' }],
            after: { id: skill.id, type: 'skills', name: 'Venom Strike' },
            mode: 'append',
          },
        ],
      })
    );

    const after = await db.entities.get(vex.id);
    expect(after!.fields.skills).toHaveLength(1);
  });

  it('composes several patches on one entity and reverts them all with a single undo', async () => {
    const marrow = await createEntity({ projectId: 'p1', type: 'cast', name: 'Marrow' });
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    const sword = await createEntity({
      projectId: 'p1',
      type: 'items',
      name: 'Saltbrand',
      fields: {
        currentOwner: { id: marrow.id, type: 'cast', name: 'Marrow' },
        affixes: ['Salt-bitten'],
      },
    });

    const result = await applyDelta(
      deltaWith({
        patches: [
          {
            ...unit('u1', 'itemTransfer'),
            entityId: sword.id,
            entityType: 'items',
            entityName: 'Saltbrand',
            fieldId: 'currentOwner',
            fieldLabel: 'Current owner',
            before: { id: marrow.id, type: 'cast', name: 'Marrow' },
            after: { id: vex.id, type: 'cast', name: 'Vex' },
            mode: 'replace',
          },
          {
            ...unit('u2', 'itemTransfer'),
            entityId: sword.id,
            entityType: 'items',
            entityName: 'Saltbrand',
            fieldId: 'affixes',
            fieldLabel: 'Affixes / Tags',
            before: ['Salt-bitten'],
            after: 'Blood-owed',
            mode: 'append',
          },
        ],
      })
    );

    const patched = await db.entities.get(sword.id);
    expect((patched!.fields.currentOwner as { id: string }).id).toBe(vex.id);
    expect(patched!.fields.affixes).toEqual(['Salt-bitten', 'Blood-owed']);

    // Exactly one snapshot for the row, taken before the first patch — so one
    // undo restores the true original, not the state between the two patches.
    expect(await undoAuditEntry(result.auditId)).toBe(true);
    const reverted = await db.entities.get(sword.id);
    expect((reverted!.fields.currentOwner as { id: string }).id).toBe(marrow.id);
    expect(reverted!.fields.affixes).toEqual(['Salt-bitten']);
  });

  it('nests a location under its parent from both ends', async () => {
    const region = await createEntity({ projectId: 'p1', type: 'locations', name: 'Vraska' });

    await applyDelta(
      deltaWith({
        entities: [
          {
            ...unit('u1', 'travel'),
            draft: {
              localId: 'town',
              type: 'locations',
              name: 'Ashen Ford',
              aliases: [],
              summary: '',
              tags: [],
              fields: {},
            },
          },
        ],
        hierarchyPlacements: [
          {
            ...unit('u2', 'travel'),
            childId: 'town',
            childName: 'Ashen Ford',
            parentId: region.id,
            parentName: 'Vraska',
          },
        ],
      })
    );

    const town = (await db.entities.toArray()).find((e) => e.name === 'Ashen Ford')!;
    expect((town.fields.parentId as { id: string }).id).toBe(region.id);

    const parent = await db.entities.get(region.id);
    expect((parent!.fields.childLocationIds as { id: string }[])[0].id).toBe(town.id);
  });

  it('leaves an unresolved parent alone so the board can show a picker', async () => {
    const town = await createEntity({ projectId: 'p1', type: 'locations', name: 'Ashen Ford' });

    await applyDelta(
      deltaWith({
        hierarchyPlacements: [
          {
            ...unit('u1', 'travel'),
            childId: town.id,
            childName: 'Ashen Ford',
            parentId: null,
            parentName: 'the Vraska region',
            unresolvedParentName: 'the Vraska region',
          },
        ],
      })
    );

    const after = await db.entities.get(town.id);
    expect(after!.fields.parentId).toBeUndefined();
  });

  it('appends a skill node onto an existing tree and reverts it on undo', async () => {
    await db.skillTrees.add({
      id: 'tree1',
      projectId: 'p1',
      name: 'Serpent Path',
      nodes: [{ id: 'n0', label: 'Root', x: 0, y: 0 }],
      edges: [],
      updatedAt: 1,
    });

    const result = await applyDelta(
      deltaWith({
        graphPlacements: [
          {
            ...unit('u1', 'skill-learned'),
            graphId: 'tree1',
            graphKind: 'skilltree',
            graphName: 'Serpent Path',
            node: { id: 'n1', label: 'Venom Strike', x: 10, y: 20, group: 'Toxins' },
            edges: [{ id: 'e1', from: 'n0', to: 'n1' }],
            group: 'Toxins',
          },
        ],
      })
    );

    const tree = await db.skillTrees.get('tree1');
    expect(tree!.nodes).toHaveLength(2);
    expect(tree!.edges).toHaveLength(1);

    expect(await undoAuditEntry(result.auditId)).toBe(true);
    const reverted = await db.skillTrees.get('tree1');
    expect(reverted!.nodes).toHaveLength(1);
    expect(reverted!.edges).toHaveLength(0);
  });

  it('stacks two placements onto one tree without losing the first', async () => {
    await db.skillTrees.add({
      id: 'tree1',
      projectId: 'p1',
      name: 'Serpent Path',
      nodes: [{ id: 'n0', label: 'Root', x: 0, y: 0 }],
      edges: [],
      updatedAt: 1,
    });

    const place = (unitId: string, nodeId: string, label: string) => ({
      ...unit(unitId, 'skill-learned'),
      graphId: 'tree1',
      graphKind: 'skilltree' as const,
      graphName: 'Serpent Path',
      node: { id: nodeId, label, x: 0, y: 100 },
      edges: [{ id: `e-${nodeId}`, from: 'n0', to: nodeId }],
    });

    const result = await applyDelta(
      deltaWith({ graphPlacements: [place('u1', 'n1', 'Venom Strike'), place('u2', 'n2', 'Corrosive Edge')] })
    );

    const tree = await db.skillTrees.get('tree1');
    expect(tree!.nodes.map((n) => n.label)).toEqual(['Root', 'Venom Strike', 'Corrosive Edge']);
    expect(tree!.edges).toHaveLength(2);

    // And the snapshot is still the true original, not the state between them.
    expect(await undoAuditEntry(result.auditId)).toBe(true);
    const reverted = await db.skillTrees.get('tree1');
    expect(reverted!.nodes).toHaveLength(1);
    expect(reverted!.edges).toHaveLength(0);
  });

  it('persists suggestions as pending and removes them on undo', async () => {
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });

    const result = await applyDelta(
      deltaWith({
        suggestions: [
          {
            ...unit('u1', 'skill-next-tier'),
            kind: 'skill-next-tier',
            targetRef: { id: vex.id, type: 'cast', name: 'Vex' },
            title: 'Venom Strike II',
            body: 'The coating spreads to thrown weapons (cost: 2 doses).',
            payload: null,
          },
        ],
      })
    );

    const rows = await db.suggestions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].targetEntityId).toBe(vex.id);

    expect(await undoAuditEntry(result.auditId)).toBe(true);
    expect(await db.suggestions.count()).toBe(0);
  });

  it('applies only enabled units so a per-group toggle can switch a cascade off', async () => {
    const sword = await createEntity({
      projectId: 'p1',
      type: 'items',
      name: 'Saltbrand',
      fields: { status: 'Carried' },
    });

    const result = await applyDelta(
      deltaWith({
        patches: [
          {
            ...unit('keep'),
            entityId: sword.id,
            entityType: 'items',
            entityName: 'Saltbrand',
            fieldId: 'status',
            fieldLabel: 'Status',
            before: 'Carried',
            after: 'Lost',
            mode: 'replace',
          },
          {
            ...unit('drop'),
            entityId: sword.id,
            entityType: 'items',
            entityName: 'Saltbrand',
            fieldId: 'condition',
            fieldLabel: 'Condition',
            before: null,
            after: 'Broken',
            mode: 'replace',
          },
        ],
      }),
      { enabledUnitIds: new Set(['keep']) }
    );

    const after = await db.entities.get(sword.id);
    expect(after!.fields.status).toBe('Lost');
    expect(after!.fields.condition).toBeUndefined();
    expect(result.skipped).toBe(1);
  });

  it('records one reversible audit entry for the whole cascade', async () => {
    const result = await applyDelta(
      deltaWith({
        entities: [
          {
            ...unit('u1'),
            draft: {
              localId: 'l1',
              type: 'skills',
              name: 'Venom Strike',
              aliases: [],
              summary: '',
              tags: [],
              fields: {},
            },
          },
        ],
      })
    );

    const entries = await db.auditLog.where('projectId').equals('p1').toArray();
    const applies = entries.filter((e) => e.action === 'intelligence.apply');
    expect(applies).toHaveLength(1);
    expect(applies[0].reversible).toBe(true);
    expect(await undoAuditEntry(result.auditId)).toBe(true);
    expect(await db.entities.count()).toBe(0);
  });
});

describe('filterDelta', () => {
  it('describes only what will actually be applied', () => {
    const d = deltaWith({
      patches: [
        {
          ...unit('keep'),
          entityId: 'e1',
          entityType: 'items',
          entityName: 'Saltbrand',
          fieldId: 'status',
          fieldLabel: 'Status',
          before: null,
          after: 'lost',
          mode: 'replace',
        },
        {
          ...unit('drop'),
          entityId: 'e1',
          entityType: 'items',
          entityName: 'Saltbrand',
          fieldId: 'condition',
          fieldLabel: 'Condition',
          before: null,
          after: 'Broken',
          mode: 'replace',
        },
      ],
      groups: [
        {
          id: 'g1',
          subject: { id: 'e1', type: 'items', name: 'Saltbrand' },
          headline: 'Saltbrand was lost',
          unitIds: ['keep', 'drop'],
          confidence: 0.8,
          confidenceBand: 'green',
          flagged: false,
        },
      ],
    });

    expect(deltaTitle(d)).toContain('2 updates');
    const narrowed = filterDelta(d, new Set(['keep']));
    expect(deltaTitle(narrowed)).toContain('1 update');
    expect(narrowed.groups[0].unitIds).toEqual(['keep']);
  });

  it('drops a group whose every unit was switched off', () => {
    const d = deltaWith({
      groups: [
        {
          id: 'g1',
          subject: { id: 'e1', type: 'items', name: 'Saltbrand' },
          headline: 'x',
          unitIds: ['a', 'b'],
          confidence: 0.8,
          confidenceBand: 'green',
          flagged: false,
        },
      ],
    });
    expect(filterDelta(d, new Set()).groups).toHaveLength(0);
  });
});
