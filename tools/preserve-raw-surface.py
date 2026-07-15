from pathlib import Path
path = Path('src/services/extraction/discovery.ts')
text = path.read_text(encoding='utf-8')
old = """  const groups = new Map<string, { surface: string; occ: ProperNounSpan[] }>();
  for (const span of spans) {
    const quality = assessCandidateQuality({ text, surface: span.surface, occurrences: [span], entities });
    const key = quality.canonical.toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { surface: quality.canonical, occ: [] });
    const group = groups.get(key)!;
    group.occ.push(span);
    if (!span.atSentenceStart) group.surface = quality.canonical;
  }

  for (const group of groups.values()) {
    if (out.length >= maxCandidates) break;
    const quality = assessCandidateQuality({
      text,
      surface: group.surface,
      occurrences: group.occ,
      entities,
    });
"""
new = """  const groups = new Map<string, { surface: string; rawSurface: string; occ: ProperNounSpan[] }>();
  for (const span of spans) {
    const quality = assessCandidateQuality({ text, surface: span.surface, occurrences: [span], entities });
    const key = quality.canonical.toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { surface: quality.canonical, rawSurface: span.surface, occ: [] });
    const group = groups.get(key)!;
    group.occ.push(span);
    if (!span.atSentenceStart) {
      group.surface = quality.canonical;
      group.rawSurface = span.surface;
    }
  }

  for (const group of groups.values()) {
    if (out.length >= maxCandidates) break;
    const quality = assessCandidateQuality({
      text,
      surface: group.rawSurface,
      occurrences: group.occ,
      entities,
    });
"""
if old not in text:
    raise SystemExit('target block not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
