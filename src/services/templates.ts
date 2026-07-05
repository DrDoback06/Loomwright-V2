import { db } from '@/db/schema';
import type { BoardTemplate, Entity, EntityTemplate, GraphEdge, GraphNode, Template } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';
import { newId } from '@/lib/id';

/** Nine code-level genre starters (legacy parity: high fantasy /
 * grimdark / science fiction × class / race / skill). Builtins are
 * merged at read, can't be removed, and never export. Field ids match
 * the live entity configs so the create drawer prefills cleanly. */
export const BUILTIN_ENTITY_TEMPLATES: EntityTemplate[] = [
  et('hf-class', 'High fantasy — Knight-errant (class)', 'classes', 'A wandering sworn sword, bound to a code and a lord long dead.', {
    category: 'Martial', role: 'Defender',
    description: 'Heavy harness, heavier oaths. Welcome at any hearth that fears the road.',
    restrictions: ['Keep the code', 'Never refuse sanctuary'],
  }),
  et('hf-race', 'High fantasy — Hollowfolk (race)', 'races', 'Quiet people of the barrow-downs who remember older names for things.', {
    category: 'Folk', description: 'Small, grave-mannered, long-memoried. They bury nothing they might need again.',
    traits: ['Dark-sighted', 'Old-tongued'], weaknesses: ['Sun-shy'], habitat: 'Barrows and under-hills',
  }),
  et('hf-skill', 'High fantasy — Wardlight (skill)', 'skills', 'A ward of pale light that turns aside what hates the living.', {
    skillType: 'active', cost: 'A candle of vigour', description: 'A raised circle of light; nothing hungry crosses it while the caster holds.',
  }),
  et('gd-class', 'Grimdark — Plague-surgeon (class)', 'classes', 'Half feared, half prayed to; paid in coin nobody else will touch.', {
    category: 'Functionary', role: 'Healer',
    description: 'Knows what the beaked mask is really for. Keeps a second ledger of the ones who could not pay.',
    restrictions: ['Sworn to enter any afflicted house'],
  }),
  et('gd-race', 'Grimdark — Ashborn (race)', 'races', 'Descendants of a burned city; grief carried in the blood.', {
    category: 'Folk', description: 'Grey-skinned, slow to trust, slower to forget. Their dead are ash already; nothing else can be taken.',
    traits: ['Fire-hardened', 'Unforgetting'], weaknesses: ['Marked — recognised anywhere'],
  }),
  et('gd-skill', 'Grimdark — Last rites (skill)', 'skills', 'Words that keep the dead from getting back up. Usually.', {
    skillType: 'triggered', cost: 'A memory of the deceased', description: 'Spoken over a body within a day of death. The speaker forgets one true thing about them.',
  }),
  et('sf-class', 'Science fiction — Voidwright (class)', 'classes', 'Hull-and-vacuum engineer; the crew lives because the voidwright is paranoid.', {
    category: 'Functionary', role: 'Crafter',
    description: 'Certified for exterior work. Counts seals twice, oxygen three times, and favours owed forever.',
  }),
  et('sf-race', 'Science fiction — Kessari (race)', 'races', 'Gene-adapted orbital clans who never renounced the homeworld’s debts.', {
    category: 'Alien', description: 'Tall, low-gravity frames; bones like scaffolding. Clan tattoos record cargo manifests.',
    traits: ['Vacuum-tolerant (brief)', 'Perfect inertial sense'], weaknesses: ['Brittle under full gravity'],
  }),
  et('sf-skill', 'Science fiction — Ghost handshake (skill)', 'skills', 'Spoofing a dead crewmate’s credentials past a ship’s security layer.', {
    skillType: 'active', cost: 'Burns the credential afterwards', description: 'Works exactly once per identity; the ship remembers being fooled.',
  }),
];

function et(
  slug: string,
  name: string,
  entityType: EntityType,
  summary: string,
  fields: Record<string, unknown>
): EntityTemplate {
  return { id: `builtin:${slug}`, projectId: '', kind: 'entity', name, entityType, summary, fields, createdAt: 0 };
}

export function isBuiltinTemplate(t: Template): boolean {
  return t.id.startsWith('builtin:');
}

/** Builtins first, then user templates newest-first. */
export async function listTemplates(projectId: string): Promise<Template[]> {
  const user = await db.templates.where('projectId').equals(projectId).toArray();
  user.sort((a, b) => b.createdAt - a.createdAt);
  return [...BUILTIN_ENTITY_TEMPLATES, ...user];
}

/** Snapshot an entity's shape with its identity stripped — name,
 * aliases, and tracking fields don't ride along. */
export async function saveEntityTemplate(
  projectId: string,
  entity: Entity,
  name?: string
): Promise<EntityTemplate> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity.fields)) {
    if (key === 'firstChapter' || key === 'notes') continue;
    fields[key] = value;
  }
  const template: EntityTemplate = {
    id: newId(),
    projectId,
    kind: 'entity',
    name: name?.trim() || `${entity.name} template`,
    entityType: entity.type,
    summary: entity.summary,
    fields,
    createdAt: Date.now(),
  };
  await db.templates.add(template);
  return template;
}

/** The create-drawer prefill for a template (flat form shape). */
export function entityInitialFrom(template: EntityTemplate): Record<string, unknown> {
  return { summary: template.summary, ...template.fields };
}

/** Snapshot a tangle board's cards + threads, positions normalised so
 * the top-left card sits at the origin. */
export async function saveBoardTemplate(
  projectId: string,
  name: string,
  cards: GraphNode[],
  edges: GraphEdge[]
): Promise<BoardTemplate> {
  const minX = cards.length ? Math.min(...cards.map((c) => c.x)) : 0;
  const minY = cards.length ? Math.min(...cards.map((c) => c.y)) : 0;
  const template: BoardTemplate = {
    id: newId(),
    projectId,
    kind: 'board',
    name: name.trim() || 'Board template',
    cards: cards.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY })),
    edges: edges.map((e) => ({ ...e })),
    createdAt: Date.now(),
  };
  await db.templates.add(template);
  return template;
}

/** Stamp a board template onto a board at a point: fresh node ids,
 * edges rewired to the new ids, positions offset to the stamp point. */
export function instantiateBoardTemplate(
  template: BoardTemplate,
  at: { x: number; y: number }
): { cards: GraphNode[]; edges: GraphEdge[] } {
  const idMap = new Map<string, string>();
  const cards = template.cards.map((c) => {
    const id = newId();
    idMap.set(c.id, id);
    return { ...c, id, x: c.x + at.x, y: c.y + at.y };
  });
  const edges = template.edges
    .filter((e) => idMap.has(e.from) && idMap.has(e.to))
    .map((e) => ({ ...e, id: newId(), from: idMap.get(e.from)!, to: idMap.get(e.to)! }));
  return { cards, edges };
}

export async function deleteTemplate(id: string): Promise<void> {
  if (id.startsWith('builtin:')) return;
  await db.templates.delete(id);
}
