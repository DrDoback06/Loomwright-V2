import MiniSearch from 'minisearch';
import { db } from '@/db/schema';
import type { EntityType } from '@/domain/entity-types';

export interface SearchHit {
  id: string;
  kind: 'entity' | 'chapter';
  title: string;
  subtitle: string;
  entityType?: EntityType;
}

interface Doc {
  id: string;
  kind: 'entity' | 'chapter';
  title: string;
  body: string;
  subtitle: string;
  entityType?: EntityType;
}

/** Build a fresh project index. Local scale keeps this cheap (<50ms for
 * hundreds of records) so we rebuild per palette session — zero
 * staleness. Key rows and settings are NEVER indexed. */
export async function buildSearchIndex(projectId: string) {
  const mini = new MiniSearch<Doc>({
    fields: ['title', 'body'],
    storeFields: ['kind', 'title', 'subtitle', 'entityType'],
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3 } },
  });
  const docs: Doc[] = [];

  const entities = await db.entities.where('projectId').equals(projectId).toArray();
  for (const e of entities) {
    if (e.status === 'merged') continue;
    docs.push({
      id: `entity:${e.id}`,
      kind: 'entity',
      title: e.name,
      subtitle: e.summary || e.type,
      body: [e.summary, e.aliases.join(' '), e.tags.join(' ')].join(' '),
      entityType: e.type,
    });
  }
  const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
  for (const c of chapters) {
    docs.push({
      id: `chapter:${c.id}`,
      kind: 'chapter',
      title: c.title,
      subtitle: `${c.wordCount.toLocaleString()} words`,
      body: c.paragraphs.map((p) => p.text).join(' ').slice(0, 20000),
    });
  }
  mini.addAll(docs);

  return (query: string, limit = 8): SearchHit[] =>
    mini.search(query).slice(0, limit).map((r) => ({
      id: String(r.id).split(':').slice(1).join(':'),
      kind: r.kind as SearchHit['kind'],
      title: r.title as string,
      subtitle: r.subtitle as string,
      entityType: r.entityType as EntityType | undefined,
    }));
}
