import { db } from '@/db/schema';
import type { RandomTable, RandomTableRow } from '@/db/types';
import { newId } from '@/lib/id';

/** Code-level starter tables (legacy parity: character names, weather,
 * plot twists, found objects). Merged at read, copy-on-write when
 * edited, never removable, never exported. */
export const BUILTIN_TABLES: RandomTable[] = [
  {
    id: 'builtin:names',
    projectId: '',
    name: 'Character names',
    category: 'cast',
    rows: toRows([
      'Aelric Vane', 'Maren Holt', 'Sable Quist', 'Torv Aldan', 'Ilsbeth Crane',
      'Corvin Ashe', 'Nyra Falk', 'Oswin Pell', 'Rhosyn Marsh', 'Edda Thorne',
      'Lucan Frost', 'Petra Vell', 'Hadric Snow', 'Ysolde Rane', 'Bram Cotter',
    ]),
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:weather',
    projectId: '',
    name: 'Weather & sky',
    category: 'none',
    rows: [
      ...toRows([
        'A thin, cold drizzle that never quite commits.',
        'Heat shimmer over the rooftops; tar going soft.',
        'Fog off the water, thick enough to lose a companion in.',
        'A hard frost — every puddle a pane of glass.',
        'Wind from the east carrying the smell of ash.',
        'Low racing clouds and the light going green before a storm.',
      ]),
      { text: 'Clear and unremarkable — suspiciously so.', weight: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:twists',
    projectId: '',
    name: 'Plot twists',
    category: 'none',
    rows: toRows([
      'An ally has been reporting to the enemy since chapter one.',
      'The item they carry is a fake; the real one never left home.',
      'The message arrives — addressed in the hand of someone dead.',
      'The safe place has already fallen; nobody outside knows.',
      'Their pursuer wants to defect, not to capture them.',
      'The debt is called in at the worst possible hour.',
      'What they buried is no longer where they buried it.',
    ]),
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin:objects',
    projectId: '',
    name: 'Found objects',
    category: 'items',
    rows: toRows([
      'A brass compass that points somewhere other than north.',
      'A child’s shoe, new, in a place no child should be.',
      'A ring of keys — one warm to the touch.',
      'A ledger with the last page torn out.',
      'A dried flower pressed in a letter never sent.',
      'A knife with a maker’s mark from an enemy city.',
      'A coin minted next year.',
    ]),
    createdAt: 0,
    updatedAt: 0,
  },
];

function toRows(texts: string[]): RandomTableRow[] {
  return texts.map((text) => ({ text, weight: 1 }));
}

export function isBuiltinTable(table: RandomTable): boolean {
  return table.id.startsWith('builtin:');
}

/** Builtins first, then the author's own tables, newest first. */
export async function listTables(projectId: string): Promise<RandomTable[]> {
  const user = await db.randomTables.where('projectId').equals(projectId).toArray();
  user.sort((a, b) => b.updatedAt - a.updatedAt);
  return [...BUILTIN_TABLES, ...user];
}

export async function createTable(
  projectId: string,
  input: { name: string; category?: RandomTable['category']; rows?: RandomTableRow[]; builtinSource?: string }
): Promise<RandomTable> {
  const now = Date.now();
  const table: RandomTable = {
    id: newId(),
    projectId,
    name: input.name.trim() || 'Untitled table',
    category: input.category ?? 'none',
    rows: input.rows ?? [],
    builtinSource: input.builtinSource,
    createdAt: now,
    updatedAt: now,
  };
  await db.randomTables.add(table);
  return table;
}

/** Editing a builtin copies it into the project first (copy-on-write). */
export async function duplicateTable(projectId: string, table: RandomTable): Promise<RandomTable> {
  return createTable(projectId, {
    name: isBuiltinTable(table) ? table.name : `${table.name} (copy)`,
    category: table.category,
    rows: table.rows.map((r) => ({ ...r })),
    builtinSource: isBuiltinTable(table) ? table.id : table.builtinSource,
  });
}

export async function updateTable(
  id: string,
  patch: Partial<Pick<RandomTable, 'name' | 'category' | 'rows'>>
): Promise<void> {
  await db.randomTables.update(id, { ...patch, updatedAt: Date.now() });
}

/** Builtins can't be deleted — they aren't stored rows to begin with. */
export async function deleteTable(id: string): Promise<void> {
  if (id.startsWith('builtin:')) return;
  await db.randomTables.delete(id);
}

export interface RollOptions {
  count?: number;
  /** Don't repeat a row within one roll (when the table is big enough). */
  unique?: boolean;
  /** Injectable for deterministic tests. */
  rng?: () => number;
}

/** Weighted roll. Returns `count` row texts. */
export function rollTable(table: RandomTable, options: RollOptions = {}): string[] {
  const { count = 1, unique = false, rng = Math.random } = options;
  const results: string[] = [];
  let pool = table.rows.filter((r) => r.weight > 0 && r.text.trim());
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const total = pool.reduce((sum, r) => sum + r.weight, 0);
    let tick = rng() * total;
    let picked = pool[pool.length - 1];
    for (const row of pool) {
      tick -= row.weight;
      if (tick < 0) {
        picked = row;
        break;
      }
    }
    results.push(picked.text);
    if (unique) pool = pool.filter((r) => r !== picked);
  }
  return results;
}
