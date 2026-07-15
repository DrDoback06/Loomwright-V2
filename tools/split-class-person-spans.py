from pathlib import Path
path = Path('src/services/extraction/discovery.ts')
text = path.read_text(encoding='utf-8')
old = """      if (surface.length >= 2 && !NER_STOPWORDS.has(surface.toLowerCase())) {
        spans.push({ surface, start, end, atSentenceStart: atStart && first === index });
      }
"""
new = """      if (surface.length >= 2 && !NER_STOPWORDS.has(surface.toLowerCase())) {
        const segment = tokens.slice(first, last + 1);
        const classWords = new Set([
          'berserker','warrior','knight','mage','wizard','sorcerer','warlock','hunter','assassin',
          'rogue','paladin','cleric','druid','monk','ranger','bard','necromancer','artificer',
          'guardian','reaver','dreadknight',
        ]);
        let splitAfter = -1;
        for (let tokenIndex = 0; tokenIndex <= segment.length - 3; tokenIndex += 1) {
          if (classWords.has(segment[tokenIndex].word.toLowerCase())) splitAfter = tokenIndex;
        }
        const trailing = splitAfter >= 0 ? segment.slice(splitAfter + 1) : [];
        const trailingLooksHuman =
          trailing.length >= 2 &&
          trailing.length <= 4 &&
          trailing.every((token) => /^[A-Z][A-Za-z'’-]*$/.test(token.word));
        if (splitAfter >= 0 && trailingLooksHuman) {
          const classStart = segment[0].start;
          const classEnd = segment[splitAfter].end;
          const personStart = trailing[0].start;
          const personEnd = trailing[trailing.length - 1].end;
          spans.push({
            surface: text.slice(classStart, classEnd),
            start: classStart,
            end: classEnd,
            atSentenceStart: atStart && first === index,
          });
          spans.push({
            surface: text.slice(personStart, personEnd),
            start: personStart,
            end: personEnd,
            atSentenceStart: false,
          });
        } else {
          spans.push({ surface, start, end, atSentenceStart: atStart && first === index });
        }
      }
"""
if old not in text:
    raise SystemExit('span insertion point not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
