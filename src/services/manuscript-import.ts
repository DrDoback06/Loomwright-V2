import { newId } from '@/lib/id';

export interface SplitChapter {
  title: string;
  text: string;
}

/** Chapter-heading heuristics: markdown headings, "Chapter N" lines,
 * roman-numeral or numbered part lines standing alone. */
const HEADING = /^(?:#{1,3}\s+(?<md>.+)|(?<ch>chapter\s+\w+(?:\s*[:—-].*)?)|(?<part>(?:[IVXLC]+|\d+)\.?))\s*$/i;

/** Split pasted/uploaded manuscript text into chapters. If no headings
 * are found the whole text becomes one chapter. */
export function splitManuscript(text: string): SplitChapter[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const chapters: SplitChapter[] = [];
  let title: string | null = null;
  let body: string[] = [];

  const flush = () => {
    const trimmed = body.join('\n').trim();
    if (trimmed || title) {
      chapters.push({
        title: title ?? `Chapter ${chapters.length + 1}`,
        text: trimmed,
      });
    }
    body = [];
  };

  for (const line of lines) {
    const m = line.trim().match(HEADING);
    if (m && line.trim()) {
      // A heading only counts once there's been some content or a prior
      // heading — a manuscript may open with its first heading.
      if (body.join('').trim() || title !== null) flush();
      title = (m.groups?.md ?? m.groups?.ch ?? m.groups?.part ?? '').trim();
      continue;
    }
    body.push(line);
  }
  flush();

  const nonEmpty = chapters.filter((c) => c.text);
  if (nonEmpty.length > 0) return nonEmpty;
  const whole = text.trim();
  return whole ? [{ title: 'Chapter 1', text: whole }] : [];
}

/** Build the TipTap doc + derived paragraphs for a chapter's plain text.
 * Blocks split on blank lines; every block gets a stable pid. */
export function buildChapterDoc(text: string): {
  doc: unknown;
  paragraphs: { id: string; text: string }[];
  wordCount: number;
} {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  const paragraphs = blocks.map((t) => ({ id: newId(), text: t }));
  const doc = {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      attrs: { pid: p.id },
      content: [{ type: 'text', text: p.text }],
    })),
  };
  const wordCount = paragraphs.reduce((sum, p) => sum + p.text.split(/\s+/).length, 0);
  return { doc, paragraphs, wordCount };
}
