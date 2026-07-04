import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createProject, deleteProjectDeep, listProjects } from '@/db/repos/projects';
import {
  createEntity,
  deleteEntityToTrash,
  getEntity,
  listEntities,
  updateEntity,
} from '@/db/repos/entities';
import { listTrash, purgeFromTrash, restoreFromTrash } from '@/db/repos/trash';
import { listAudit } from '@/db/repos/audit';
import { undoAuditEntry } from '@/db/repos/undo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('entities repo', () => {
  it('creates, lists, and updates entities scoped to a project', async () => {
    const p1 = await createProject('Book One');
    const p2 = await createProject('Book Two');

    const aelinor = await createEntity({ projectId: p1.id, type: 'cast', name: 'Aelinor Vey' });
    await createEntity({ projectId: p2.id, type: 'cast', name: 'Someone Else' });

    const p1Cast = await listEntities(p1.id, 'cast');
    expect(p1Cast.map((e) => e.name)).toEqual(['Aelinor Vey']);

    await updateEntity(aelinor.id, { summary: 'Queen of the Pale Reach' });
    expect((await getEntity(aelinor.id))?.summary).toBe('Queen of the Pale Reach');
  });

  it('delete moves the entity to trash; restore brings it back; purge is final', async () => {
    const p = await createProject('Book');
    const brec = await createEntity({ projectId: p.id, type: 'cast', name: 'Captain Brec' });

    await deleteEntityToTrash(brec.id);
    expect(await getEntity(brec.id)).toBeUndefined();
    const trash = await listTrash(p.id);
    expect(trash.map((t) => t.label)).toEqual(['Captain Brec']);

    await restoreFromTrash(brec.id);
    expect((await getEntity(brec.id))?.name).toBe('Captain Brec');
    expect(await listTrash(p.id)).toHaveLength(0);

    await deleteEntityToTrash(brec.id);
    await purgeFromTrash(brec.id);
    expect(await getEntity(brec.id)).toBeUndefined();
    expect(await listTrash(p.id)).toHaveLength(0);
  });

  it('audits every mutation and undo restores the before-state', async () => {
    const p = await createProject('Book');
    const e = await createEntity({ projectId: p.id, type: 'cast', name: 'Mara' });
    await updateEntity(e.id, { name: 'Mara of Hess' });

    const audit = await listAudit(p.id);
    expect(audit.map((a) => a.action)).toEqual(['entity.update', 'entity.create']);

    // Undo the rename.
    const ok = await undoAuditEntry(audit[0].id);
    expect(ok).toBe(true);
    expect((await getEntity(e.id))?.name).toBe('Mara');

    // Undo an entity.delete brings the record back out of trash.
    await deleteEntityToTrash(e.id);
    const audit2 = await listAudit(p.id);
    expect(audit2[0].action).toBe('entity.delete');
    await undoAuditEntry(audit2[0].id);
    expect((await getEntity(e.id))?.name).toBe('Mara');
    expect(await listTrash(p.id)).toHaveLength(0);
  });

  it('deleteProjectDeep removes the project and every scoped row', async () => {
    const p = await createProject('Doomed');
    await createEntity({ projectId: p.id, type: 'cast', name: 'Ghost' });
    await deleteProjectDeep(p.id);
    expect(await listProjects()).toHaveLength(0);
    expect(await db.entities.where('projectId').equals(p.id).count()).toBe(0);
    expect(await db.auditLog.where('projectId').equals(p.id).count()).toBe(0);
  });
});
