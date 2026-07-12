import { describe, expect, it } from 'vitest';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { KnownEntity } from '@/services/extraction/known-index';

const noisyChapter = `
Blood welled through the torn fabric of the hi-vis vest he'd been wearing since the Jobcentre, back when he'd been Graham Hendricks.
Dreadknight Berserker Graham Hendricks still believed you should wear what the system gave you.

"You're bleeding!" Pipkins was at his side instantly.
"It's fine," Graham said.
"It's not fine, you dense prick! IT'S A SWAN WITH A KNIFE, GRIMGUFF. THERE'S NO SPEECH FOR THIS."

Grimguff looked. The bread knife had no business looking so professional.
Slap. Slap. Slap.
The screen glitched. Went black. Then a single word: RUN.
"I'm not dying in a car park," Graham said.
A Snickers he'd been saving for tactical sustenance rolled from his pocket.
They had looted Poundland before Gerald Swan found them.
Darren Fletchley waved from across the road.
The CLAIMWISE software lit up on the terminal.
British rain rattled against the windows.
`;

describe('contextual discovery quality', () => {
  it('keeps real people and places while rejecting dialogue fragments, commands and adjectives', () => {
    const result = runLocalExtraction({ text: noisyChapter, entities: [] });
    const names = result.candidates.map((candidate) => candidate.name);
    const byName = new Map(result.candidates.map((candidate) => [candidate.name, candidate]));

    expect(names).toContain('Graham Hendricks');
    expect(names).toContain('Pipkins');
    expect(names).toContain('Grimguff');
    expect(names).toContain('Gerald Swan');
    expect(names).toContain('Darren Fletchley');
    expect(byName.get('Gerald Swan')?.entityType).toBe('cast');
    expect(byName.get('Darren Fletchley')?.entityType).toBe('cast');
    expect(byName.get('Dreadknight Berserker')?.entityType).toBe('classes');

    for (const forbidden of [
      "IT'S A SWAN WITH A KNIFE",
      'Slap',
      'RUN',
      "I'm",
      'British',
      'CLAIMWISE',
    ]) {
      expect(names, `should reject ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('normalises possessives and resolves them to an existing entity', () => {
    const entities: KnownEntity[] = [
      { id: 'cast-grimguff', type: 'cast', name: 'Grimguff', aliases: [] },
    ];
    const result = runLocalExtraction({
      text: "Grimguff's stomach clenched. Grimguff's coat was torn.",
      entities,
    });
    expect(result.candidates.map((candidate) => candidate.name)).not.toContain("Grimguff's");
    expect(result.occurrences.filter((occurrence) => occurrence.entityId === 'cast-grimguff').length).toBeGreaterThanOrEqual(2);
  });
});
