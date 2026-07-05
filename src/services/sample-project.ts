import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { createProject } from '@/db/repos/projects';
import { getOrCreateMap, placePin } from '@/db/repos/atlas';
import { createGraph, addNode, addEdge } from '@/db/repos/graphs';
import { buildChapterDoc } from '@/services/manuscript-import';
import { extractChapter } from '@/services/extraction/session';
import type { Chapter } from '@/db/types';
import { newId } from '@/lib/id';

export const SAMPLE_PROJECT_NAME = 'Sample — The Hollow Crown';

const CH1 = `Aelinor Vael reached Pale Reach two days ahead of the frost. The city smelled of tar and old rope, and the harbour bells were ringing the short peal that meant a ship had failed to come home.

Captain Brec met her at the water stairs. "You shouldn't be here," he said, which from Brec was a warm welcome. He carried the Blackwork Blade wrapped in oilcloth, as if cloth could make it less stolen.

"The Saltborn Company watches the north gate," Aelinor said. "So we won't use the north gate."`;

const CH2 = `They took the old drovers' road toward Vraska Pass. Maren rode ahead — she had run this route with smugglers' salt for three winters and knew which mile-stones lied.

By dusk the wind had teeth. Brec built a fire in the lee of a fallen watchtower and Aelinor sat with the Blackwork Blade across her knees, reading the maker's mark by firelight. A crown, hollow at the centre.

"Whoever holds it holds the succession," Maren said quietly. "That's the story anyway."`;

/** Build the opt-in sample project: a compact, coherent story world that
 * exercises every core surface — codex, quests, canvases, chapters, and
 * a review queue populated by a real extraction pass. Remove it like any
 * project (switcher ▸ Delete) — deletion is already deep. */
export async function createSampleProject(): Promise<string> {
  const project = await createProject(SAMPLE_PROJECT_NAME, 'Low fantasy');
  const projectId = project.id;

  const aelinor = await createEntity({
    projectId, type: 'cast', name: 'Aelinor Vael', aliases: ['Ael'],
    summary: 'Queen in exile, returning for the succession.', tags: ['royal'],
    fields: { role: 'Protagonist', pronouns: 'she/her' },
  });
  const brec = await createEntity({
    projectId, type: 'cast', name: 'Captain Brec', aliases: ['Brec'],
    summary: 'Harbour captain; loyal, disapproving.', tags: [],
    fields: { role: 'Ally', pronouns: 'he/him' },
  });
  await createEntity({
    projectId, type: 'cast', name: 'Maren', aliases: [],
    summary: 'Smuggler who knows the salt routes.', tags: [],
    fields: { role: 'Ally', pronouns: 'she/her' },
  });
  const paleReach = await createEntity({
    projectId, type: 'locations', name: 'Pale Reach', aliases: [],
    summary: 'A harbour city of tar and bells.', tags: [],
    fields: { kind: 'Port' },
  });
  const vraska = await createEntity({
    projectId, type: 'locations', name: 'Vraska Pass', aliases: [],
    summary: 'A cold road through the mountains.', tags: [],
    fields: { kind: 'Mountain Pass' },
  });
  await createEntity({
    projectId, type: 'items', name: 'Blackwork Blade', aliases: [],
    summary: 'A stolen sword marked with a hollow crown.', tags: [],
    fields: { currentOwner: { id: brec.id, type: 'cast', name: 'Captain Brec' } },
  });
  await createEntity({
    projectId, type: 'factions', name: 'Saltborn Company', aliases: [],
    summary: 'Mercenaries watching the gates.', tags: [],
    fields: {},
  });
  await createEntity({
    projectId, type: 'quests', name: 'Reach the succession stone', aliases: [],
    summary: 'Cross the pass before the frost closes it.', tags: [],
    fields: {
      steps: [
        { text: 'Slip out of Pale Reach unseen', status: 'done' },
        { text: 'Cross Vraska Pass before the frost', status: 'active' },
        { text: 'Present the Blackwork Blade', status: 'pending' },
      ],
    },
  });

  // Atlas pins + a small tangle board so the canvases aren't empty.
  const map = await getOrCreateMap(projectId);
  await placePin(map.id, { id: paleReach.id, type: 'locations', name: 'Pale Reach' }, 320, 620);
  await placePin(map.id, { id: vraska.id, type: 'locations', name: 'Vraska Pass' }, 640, 320);
  const board = await createGraph('tangle', projectId, 'Loose threads');
  const n1 = await addNode('tangle', board.id, {
    label: 'Who failed to come home?', x: 200, y: 160,
  });
  const n2 = await addNode('tangle', board.id, {
    label: 'Aelinor Vael', x: 460, y: 260,
    entity: { id: aelinor.id, type: 'cast', name: 'Aelinor Vael' },
  });
  if (n1 && n2) {
    await addEdge('tangle', board.id, { from: n1.id, to: n2.id, label: 'concerns', directed: true });
  }

  // Two real chapters; extraction fills the review queue honestly.
  const texts = [
    { title: 'Chapter 1 — The Short Peal', text: CH1 },
    { title: 'Chapter 2 — The Drovers’ Road', text: CH2 },
  ];
  for (let i = 0; i < texts.length; i += 1) {
    const built = buildChapterDoc(texts[i].text);
    const now = Date.now();
    const chapter: Chapter = {
      id: newId(),
      projectId,
      title: texts[i].title,
      order: i,
      doc: built.doc,
      paragraphs: built.paragraphs,
      wordCount: built.wordCount,
      createdAt: now,
      updatedAt: now,
    };
    await db.chapters.add(chapter);
    await extractChapter(chapter);
  }

  return projectId;
}
