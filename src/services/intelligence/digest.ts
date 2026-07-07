import type { Entity } from '@/db/types';

/** How much of the world the digest carries. Lean = names only; standard =
 * names + the one or two fields that drive propagation; full = the above
 * plus the relationship web and location hierarchy. */
export type DigestDepth = 'lean' | 'standard' | 'full';

/** Rough per-type entity cap by depth, so the digest stays inside a sane
 * token budget (≈ 8k at full). */
const CAP: Record<DigestDepth, number> = { lean: 15, standard: 40, full: 120 };
/** ~8k tokens ≈ 32k chars — over this, the digest auto-degrades a level. */
const CHAR_BUDGET = 32000;

function refName(v: unknown): string | undefined {
  if (v && typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).name);
  }
  return typeof v === 'string' ? v : undefined;
}

function section(entities: Entity[], type: Entity['type'], cap: number): Entity[] {
  return entities.filter((e) => e.type === type).slice(0, cap);
}

/** A compact, structured, id-free digest of the project world — the context
 * the mega-prompt hands an external AI so its facts and suggestions land in
 * the right places (entities, ownerships, hierarchy, relationship web).
 * Names only, never ids. Auto-degrades one depth level if it blows the
 * budget, appending a note so the reader knows. */
export function buildWorldDigest(entities: Entity[], depth: DigestDepth): string {
  const built = renderDigest(entities, depth);
  if (built.length <= CHAR_BUDGET || depth === 'lean') return built;
  const lower: DigestDepth = depth === 'full' ? 'standard' : 'lean';
  return `${renderDigest(entities, lower)}\n\n(Digest auto-reduced to ${lower} depth to fit the size budget.)`;
}

function renderDigest(entities: Entity[], depth: DigestDepth): string {
  const cap = CAP[depth];
  const lines: string[] = ['# World digest', ''];

  const cast = section(entities, 'cast', cap);
  if (cast.length) {
    lines.push(`## Cast (${cast.length})`);
    for (const c of cast) {
      const bits: string[] = [];
      if (depth !== 'lean') {
        if (c.fields.role) bits.push(`role: ${c.fields.role}`);
        const loc = refName(c.fields.currentLocation);
        if (loc) bits.push(`at: ${loc}`);
      }
      lines.push(`- ${c.name}${bits.length ? ` — ${bits.join('; ')}` : ''}`);
    }
    lines.push('');
  }

  const locations = section(entities, 'locations', cap);
  if (locations.length) {
    lines.push(`## Locations (${locations.length})`);
    for (const l of locations) {
      const parent = depth !== 'lean' ? refName(l.fields.parentId) : undefined;
      lines.push(`- ${l.name}${parent ? ` — inside ${parent}` : ''}`);
    }
    lines.push('');
  }

  const items = section(entities, 'items', cap);
  if (items.length) {
    lines.push(`## Items (${items.length})`);
    for (const it of items) {
      const owner = depth !== 'lean' ? refName(it.fields.currentOwner) : undefined;
      lines.push(`- ${it.name}${owner ? ` — held by ${owner}` : ''}`);
    }
    lines.push('');
  }

  for (const [type, label] of [
    ['factions', 'Factions'],
    ['quests', 'Quests'],
    ['skills', 'Skills'],
  ] as const) {
    const rows = section(entities, type, cap);
    if (!rows.length) continue;
    lines.push(`## ${label} (${rows.length})`);
    for (const r of rows) {
      const status = depth !== 'lean' && r.fields.status ? ` — ${r.fields.status}` : '';
      lines.push(`- ${r.name}${status}`);
    }
    lines.push('');
  }

  if (depth === 'full') {
    const rels = section(entities, 'relationships', cap);
    if (rels.length) {
      lines.push(`## Relationship web (${rels.length})`);
      for (const r of rels) {
        const from = refName(r.fields.from);
        const to = refName(r.fields.to);
        if (from && to) lines.push(`- ${from} → ${to}${r.fields.bondType ? ` (${r.fields.bondType})` : ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}
