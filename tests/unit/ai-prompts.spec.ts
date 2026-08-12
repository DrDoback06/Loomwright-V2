import { describe, expect, it, vi, afterEach } from 'vitest';
import { fitToBudget, TIER_BUDGET, tierForModel } from '@/services/ai/prompts';
import { buildExtractionPrompt } from '@/services/ai/prompts/extraction';
import { buildDeltaPrompt } from '@/services/ai/prompts/delta';
import { buildProseBrief } from '@/services/ai/prompts/prose';
import { completeJson, parseJsonLoose } from '@/services/ai/json';
import * as providers from '@/services/ai/providers';
import { buildCanonFacts, checkDraftAgainstCanon } from '@/services/ai/canon';
import type { Entity } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';

afterEach(() => vi.restoreAllMocks());

function entity(type: EntityType, name: string, fields: Record<string, unknown> = {}): Entity {
  return {
    id: `${type}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    projectId: 'p1',
    type,
    name,
    aliases: [],
    summary: '',
    tags: [],
    fields,
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Entity;
}

describe('model tiering — a free key gets a narrower job, not a worse one', () => {
  it('reads the size out of the model id', () => {
    expect(tierForModel({ provider: 'openai', model: 'gpt-4o-mini' })).toBe('small');
    expect(tierForModel({ provider: 'gemini', model: 'gemini-2.5-flash' })).toBe('small');
    expect(tierForModel({ provider: 'openrouter', model: 'deepseek/deepseek-r1:free' })).toBe('small');
    expect(tierForModel({ provider: 'groq', model: 'llama-3.1-8b-instant' })).toBe('small');
    expect(tierForModel({ provider: 'anthropic', model: 'claude-opus-4' })).toBe('large');
    expect(tierForModel({ provider: 'groq', model: 'llama-3.3-70b-versatile' })).toBe('large');
  });

  it('assumes a local model is small rather than assuming it is not', () => {
    expect(tierForModel({ provider: 'ollama' })).toBe('small');
    expect(tierForModel({ provider: 'ollama', model: 'llama3' })).toBe('small');
  });

  it('gives a small model a smaller bite of the same work', () => {
    expect(TIER_BUDGET.small.chunkChars).toBeLessThan(TIER_BUDGET.large.chunkChars);
    expect(TIER_BUDGET.small.digestChars).toBeLessThan(TIER_BUDGET.large.digestChars);
  });

  it('trims to budget on a sentence boundary', () => {
    const text = 'One sentence here. Another sentence follows. And a third one trails off';
    const out = fitToBudget(text, 40);
    expect(out.trimmed).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(40);
    expect(out.text.trimEnd().endsWith('.')).toBe(true);
  });
});

describe('prompts state the whole contract instead of assuming it', () => {
  it('extraction: contract, worked example, negative example, omission rule', () => {
    const prompt = buildExtractionPrompt([{ type: 'cast', names: ['Vex', 'Marrow'] }]);
    expect(prompt).toContain('OUTPUT RULES');
    expect(prompt).toContain('No markdown code fence');
    expect(prompt).toContain('WORKED EXAMPLE');
    expect(prompt).toContain('WRONG — never reply like any of these');
    expect(prompt).toContain('An empty array is a correct answer');
    // Known names travel so the model re-uses the author's spelling.
    expect(prompt).toContain('Vex, Marrow');
    // The example must be fenced off, or a small model extracts from it.
    expect(prompt).toContain('do NOT extract from this');
  });

  it('extraction: a small model is asked for fewer categories', () => {
    const large = buildExtractionPrompt([], { tier: 'large' });
    const small = buildExtractionPrompt([], { tier: 'small' });
    expect(large).toContain('"quests"');
    expect(small).not.toContain('"quests"');
    expect(small).toContain('"characters"');
  });

  it('mega-prompt: fact shapes, quote requirement, finished-card rule', () => {
    const prompt = buildDeltaPrompt('# World digest', 'Some prose.');
    expect(prompt).toContain('"kind": "item-transfer"');
    expect(prompt).toContain('No quote, no fact');
    expect(prompt).toContain('Never a question');
    expect(prompt).toContain('A suggestion is allowed to be invention. A fact is not.');
    expect(prompt).toContain('# World digest');
    expect(prompt.trimEnd().endsWith('Remember: one JSON object, nothing else.')).toBe(true);
  });

  it('prose brief: form, canon and anti-patterns are all explicit', () => {
    const brief = buildProseBrief({
      mode: 'scene',
      pov: 'third limited',
      tense: 'past',
      length: 'a few paragraphs',
      instruction: 'Vex refuses the blade.',
      context: '- Character Vex — a poisoner',
      facts: ['Saltbrand belongs to Marrow.'],
      style: null,
    });
    expect(brief).toContain('limited to ONE viewpoint character');
    expect(brief).toContain('Past tense throughout');
    expect(brief).toContain('250–400 words');
    expect(brief).toContain('ESTABLISHED CANON');
    expect(brief).toContain('Saltbrand belongs to Marrow.');
    expect(brief).toContain('No preamble, title, chapter heading');
    expect(brief).toContain('Vex refuses the blade.');
  });
});

describe('JSON replies survive what small models actually do to them', () => {
  it('parses fenced, prose-wrapped, trailing-comma and smart-quote replies', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! {"a":1} Hope that helps.')).toEqual({ a: 1 });
    expect(parseJsonLoose('{"a":[1,2,],}')).toEqual({ a: [1, 2] });
    expect(parseJsonLoose('{“a”: 1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('nothing here')).toBeNull();
  });

  it('forces JSON mode and temperature 0 without the caller asking', async () => {
    const spy = vi
      .spyOn(providers, 'completeDetailed')
      .mockResolvedValue({ text: '{"ok":true}', truncated: false, model: 'm' });
    await completeJson({ provider: 'groq' }, { prompt: 'go' });
    expect(spy).toHaveBeenCalledWith(
      { provider: 'groq' },
      expect.objectContaining({ json: true, temperature: 0 })
    );
  });

  it('repairs a malformed reply with one round-trip instead of losing the pass', async () => {
    const spy = vi
      .spyOn(providers, 'completeDetailed')
      .mockResolvedValueOnce({ text: 'here you go: {"facts": [ ', truncated: false, model: 'm' })
      .mockResolvedValueOnce({ text: '{"facts":[]}', truncated: false, model: 'm' });
    const result = await completeJson({ provider: 'groq' }, { prompt: 'go' });
    expect(result.value).toEqual({ facts: [] });
    expect(result.repaired).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not re-ask a truncated reply, and says so instead', async () => {
    const spy = vi
      .spyOn(providers, 'completeDetailed')
      .mockResolvedValue({ text: '{"facts": [{"kind":"item-tra', truncated: true, model: 'm' });
    const result = await completeJson({ provider: 'groq' }, { prompt: 'go' });
    expect(result.value).toBeNull();
    expect(result.truncated).toBe(true);
    expect(result.error).toMatch(/cut off/i);
    // Re-asking would truncate in exactly the same place.
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('canon travels out with the brief and the draft is read on the way back', () => {
  const marrow = entity('cast', 'Marrow', { currentLocation: { id: 'l', type: 'locations', name: 'Ashen Ford' } });
  const vex = entity('cast', 'Vex');
  const saltbrand = entity('items', 'Saltbrand', {
    currentOwner: { id: marrow.id, type: 'cast', name: 'Marrow' },
  });
  const world = [marrow, vex, saltbrand];

  it('states recorded ownership and whereabouts as facts', () => {
    const facts = buildCanonFacts([marrow, saltbrand], world);
    expect(facts).toContain('Marrow was last recorded at Ashen Ford.');
    expect(facts).toContain('Saltbrand belongs to Marrow.');
  });

  it('flags a draft that hands over something the wrong person owns', () => {
    const issues = checkDraftAgainstCanon('Vex handed the Saltbrand to Marrow at the gate.', world);
    const contradiction = issues.find((i) => i.kind === 'contradiction');
    expect(contradiction?.message).toMatch(/records it as Marrow's/);
  });

  it('reports a legitimate change as a change, not an error', () => {
    const issues = checkDraftAgainstCanon('Marrow handed the Saltbrand to Vex at the gate.', world);
    expect(issues.some((i) => i.kind === 'contradiction')).toBe(false);
    expect(issues.some((i) => i.kind === 'change')).toBe(true);
  });

  it('counts names the codex has never seen', () => {
    const issues = checkDraftAgainstCanon(
      '"We ride at dawn," said Aelinor. Lord Brennan only nodded. Aelinor found Brennan waiting.',
      world
    );
    expect(issues.some((i) => i.kind === 'introduction')).toBe(true);
  });

  it('says nothing about an empty draft', () => {
    expect(checkDraftAgainstCanon('   ', world)).toEqual([]);
  });
});
