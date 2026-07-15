import { describe, expect, it } from 'vitest';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { KnownEntity } from '@/services/extraction/known-index';

const nuancedChapter = `
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
Graham had once won West Midlands Strongest Man.
Grimguff raised Council-Tax-Evader and aimed it at the swan.
`;

function candidate(result: ReturnType<typeof runLocalExtraction>, name: string) {
  return result.candidates.find((row) => row.name.toLowerCase() === name.toLowerCase());
}

describe('nuanced contextual discovery', () => {
  it('keeps real entities and preserves uncertain interpretations at lower confidence', () => {
    const result = runLocalExtraction({ text: nuancedChapter, entities: [] });

    expect(candidate(result, 'Graham Hendricks')?.entityType).toBe('cast');
    expect(candidate(result, 'Pipkins')?.entityType).toBe('cast');
    expect(candidate(result, 'Grimguff')?.entityType).toBe('cast');
    expect(candidate(result, 'Gerald Swan')?.entityType).toBe('cast');
    expect(candidate(result, 'Darren Fletchley')?.entityType).toBe('cast');
    expect(candidate(result, 'Dreadknight Berserker')?.entityType).toBe('classes');
    expect(candidate(result, 'Poundland')?.entityType).toBe('locations');
    expect(candidate(result, 'Knife')?.entityType).toBe('items');

    expect(candidate(result, 'Slap')?.entityType).toBe('skills');
    expect(candidate(result, 'Slap')?.confidence).toBeLessThan(0.6);
    expect(candidate(result, 'Run')?.entityType).toBe('skills');
    expect(candidate(result, "It's a Swan with a Knife")?.entityType).toBe('quests');
    expect(candidate(result, 'Claimwise')?.entityType).toBe('cast');
    expect(candidate(result, 'West Midlands Strongest Man')?.interpretation?.kind).toBe('title');
    expect(candidate(result, 'Council-Tax-Evader')?.typeSuggestions?.some((suggestion) => suggestion.type === 'items')).toBe(true);
    expect(candidate(result, 'British')?.typeSuggestions?.[0]?.type).toBe('races');

    expect(result.candidates.map((row) => row.name)).not.toContain("I'm");
  });

  it('normalises possessives and resolves them to an existing entity', () => {
    const entities: KnownEntity[] = [
      { id: 'cast-grimguff', type: 'cast', name: 'Grimguff', aliases: [] },
    ];
    const result = runLocalExtraction({
      text: "Grimguff's stomach clenched. Grimguff's coat was torn.",
      entities,
    });
    expect(result.candidates.map((row) => row.name)).not.toContain("Grimguff's");
    expect(result.occurrences.filter((occurrence) => occurrence.entityId === 'cast-grimguff').length).toBeGreaterThanOrEqual(2);
  });
});
