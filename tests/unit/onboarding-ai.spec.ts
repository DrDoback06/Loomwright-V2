import { describe, expect, it } from 'vitest';
import { buildOnboardingPrompt, parseOnboardingReply } from '@/services/onboarding-ai';

describe('buildOnboardingPrompt', () => {
  it('embeds the answer-shaped JSON keys and the "JSON only" instruction', () => {
    const prompt = buildOnboardingPrompt();
    expect(prompt).toContain('Return ONLY a single JSON object');
    for (const key of ['"name"', '"genre"', '"tone"', '"premise"', '"themes"', '"cast"', '"places"']) {
      expect(prompt).toContain(key);
    }
    // It must not ask the AI to write the manuscript.
    expect(prompt).toMatch(/Do not write the manuscript/i);
  });
});

describe('parseOnboardingReply', () => {
  const REPLY = `Sure! Here's your setup:
\`\`\`json
{
  "name": "The Hollow Crown",
  "genre": ["Fantasy", "Romance", "NotARealGenre"],
  "tone": "Grounded",
  "premise": "A queen in exile returns for the succession.",
  "themes": ["loyalty", "debt", "loyalty"],
  "comparables": "The Goblin Emperor meets Master & Commander",
  "isNot": "grimdark",
  "pov": "Third limited",
  "tense": "Past",
  "cast": [
    { "name": "Aelinor Vael", "role": "Protagonist", "note": "Queen in exile." },
    { "note": "no name — dropped" }
  ],
  "places": [{ "name": "Pale Reach", "kind": "Port" }]
}
\`\`\`
Hope that helps!`;

  it('parses a fenced reply and coerces every field', () => {
    const out = parseOnboardingReply(REPLY)!;
    expect(out.name).toBe('The Hollow Crown');
    // Unknown genre filtered; known ones kept in order.
    expect(out.genre).toEqual(['Fantasy', 'Romance']);
    // A bare string tone is coerced to an array.
    expect(out.tone).toEqual(['Grounded']);
    // Duplicate theme de-duplicated.
    expect(out.themes).toEqual(['loyalty', 'debt']);
    expect(out.premise).toContain('returns for the succession');
    expect(out.pov).toBe('Third limited');
    // Nameless cast row dropped.
    expect(out.cast).toEqual([{ name: 'Aelinor Vael', role: 'Protagonist', note: 'Queen in exile.' }]);
    expect(out.places).toEqual([{ name: 'Pale Reach', kind: 'Port' }]);
  });

  it('handles bare (unfenced) JSON in prose', () => {
    const out = parseOnboardingReply('Here you go: {"name":"Salt Road","genre":["Historical"]} — enjoy!')!;
    expect(out.name).toBe('Salt Road');
    expect(out.genre).toEqual(['Historical']);
  });

  it('returns null for junk or an empty object', () => {
    expect(parseOnboardingReply('no json here at all')).toBeNull();
    expect(parseOnboardingReply('{}')).toBeNull();
    expect(parseOnboardingReply('{"unknownKey": 1}')).toBeNull();
  });
});
