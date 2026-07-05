import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { createProject } from '@/db/repos/projects';
import { saveAiSettings } from '@/services/ai/settings';
import { buildChapterDoc, splitManuscript } from '@/services/manuscript-import';
import { extractChapter } from '@/services/extraction/session';
import type { StyleProfile } from '@/services/style-analysis';
import type { Chapter } from '@/db/types';
import { newId } from '@/lib/id';

export interface CastSeed {
  name: string;
  role: string;
  note: string;
}

export interface PlaceSeed {
  name: string;
  kind: string;
}

export interface OnboardingAnswers {
  name: string;
  genre: string[];
  premise: string;
  themes: string[];
  tone: string[];
  comparables: string;
  isNot: string;
  pov: string;
  tense: string;
  styleSample: string;
  styleProfile: StyleProfile | null;
  cast: CastSeed[];
  places: PlaceSeed[];
  manuscript: string;
  runExtraction: boolean;
  aiMode: 'local-only' | 'byok';
  privacyAsk: boolean;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  name: '',
  genre: [],
  premise: '',
  themes: [],
  tone: [],
  comparables: '',
  isNot: '',
  pov: '',
  tense: '',
  styleSample: '',
  styleProfile: null,
  cast: [],
  places: [],
  manuscript: '',
  runExtraction: true,
  aiMode: 'byok',
  privacyAsk: true,
};

const DRAFT_KEY = 'global:onboardingDraft';

export async function saveOnboardingDraft(answers: OnboardingAnswers): Promise<void> {
  await db.uiState.put({ key: DRAFT_KEY, value: answers });
}

export async function loadOnboardingDraft(): Promise<OnboardingAnswers | null> {
  const row = await db.uiState.get(DRAFT_KEY);
  return (row?.value as OnboardingAnswers) ?? null;
}

export async function clearOnboardingDraft(): Promise<void> {
  await db.uiState.delete(DRAFT_KEY);
}

export interface OnboardingResult {
  projectId: string;
  castCreated: number;
  placesCreated: number;
  chaptersCreated: number;
  candidatesFound: number;
  referencesCreated: number;
}

/** The wizard's "Open the door": create the project and seed everything
 * the interview captured. Every answer is consumed — nothing dead. */
export async function applyOnboarding(answers: OnboardingAnswers): Promise<OnboardingResult> {
  const genreLabel = answers.genre.join(', ');
  const toneLabel = answers.tone.join(', ');
  const project = await createProject(answers.name.trim() || 'Untitled project', genreLabel || undefined);
  const projectId = project.id;

  // Interview answers persist (sans full manuscript) for later reference.
  await db.settings.put({
    key: `${projectId}:onboarding`,
    value: { ...answers, manuscript: undefined, manuscriptLength: answers.manuscript.length },
  });
  await saveAiSettings(projectId, {
    mode: answers.aiMode,
    privacy: answers.privacyAsk ? 'ask' : 'always-allow',
  });

  // Cast + world seeds.
  for (const seed of answers.cast) {
    if (!seed.name.trim()) continue;
    await createEntity({
      projectId,
      type: 'cast',
      name: seed.name.trim(),
      aliases: [],
      summary: seed.note.trim(),
      tags: [],
      fields: seed.role ? { role: seed.role } : {},
    });
  }
  for (const seed of answers.places) {
    if (!seed.name.trim()) continue;
    await createEntity({
      projectId,
      type: 'locations',
      name: seed.name.trim(),
      aliases: [],
      summary: '',
      tags: [],
      fields: { kind: seed.kind || 'Other' },
    });
  }

  // References: the story foundation, the style sample, and the AI brief.
  let referencesCreated = 0;
  const addReference = async (name: string, kind: string, body: string, extra: Record<string, unknown> = {}) => {
    if (!body.trim()) return;
    await createEntity({
      projectId,
      type: 'references',
      name,
      aliases: [],
      summary: body.slice(0, 140).replace(/\s+/g, ' '),
      tags: ['onboarding'],
      fields: { kind, body, ...extra },
    });
    referencesCreated += 1;
  };
  const foundation = [
    answers.premise && `Premise: ${answers.premise}`,
    genreLabel && `Genre: ${genreLabel}`,
    answers.themes.length > 0 && `Themes: ${answers.themes.join(', ')}`,
    toneLabel && `Tone: ${toneLabel}`,
    answers.comparables && `Comparable to: ${answers.comparables}`,
    answers.isNot && `This story is NOT: ${answers.isNot}`,
  ]
    .filter(Boolean)
    .join('\n');
  await addReference('Story foundation', 'onboarding answer', foundation);
  await addReference('Style sample', 'style sample', answers.styleSample, { isStyleSample: true });
  const brief = [
    `Project brief for "${answers.name}"${genreLabel ? ` (${genreLabel})` : ''}.`,
    foundation,
    answers.pov && `POV: ${answers.pov}${answers.tense ? `, ${answers.tense} tense` : ''}.`,
    answers.styleProfile && `Voice: ${answers.styleProfile.notes.join(' ')}`,
  ]
    .filter(Boolean)
    .join('\n');
  await addReference('Project brief (AI context)', 'AI instruction', brief, { includeInAI: true });

  // Manuscript → chapters (+ optional first extraction, through review).
  let candidatesFound = 0;
  const split = splitManuscript(answers.manuscript);
  const chapters: Chapter[] = [];
  for (let i = 0; i < split.length; i += 1) {
    const built = buildChapterDoc(split[i].text);
    const now = Date.now();
    const chapter: Chapter = {
      id: newId(),
      projectId,
      title: split[i].title,
      order: i,
      doc: built.doc,
      paragraphs: built.paragraphs,
      wordCount: built.wordCount,
      createdAt: now,
      updatedAt: now,
    };
    await db.chapters.add(chapter);
    chapters.push(chapter);
  }
  if (answers.runExtraction) {
    for (const chapter of chapters) {
      const summary = await extractChapter(chapter);
      candidatesFound += summary.candidateCount;
    }
  }

  return {
    projectId,
    castCreated: answers.cast.filter((c) => c.name.trim()).length,
    placesCreated: answers.places.filter((p) => p.name.trim()).length,
    chaptersCreated: chapters.length,
    candidatesFound,
    referencesCreated,
  };
}
