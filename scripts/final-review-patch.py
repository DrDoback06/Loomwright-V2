from pathlib import Path

review = Path('src/features/review/ReviewSurface.tsx')
text = review.read_text(encoding='utf-8')
anchor = '''                <button
                  type="button"
                  className="lw-identitycard__evidencebtn"
'''
assert text.count(anchor) == 1, 'review evidence anchor changed'
preview = '''                {cluster.candidates.some((candidate) => candidate.summary || candidate.sourceQuote) ? (
                  <div className="lw-identitycard__glance" aria-label="Extraction preview">
                    {cluster.candidates.slice(0, 2).map((candidate) => (
                      <div key={candidate.id} className="lw-identitycard__glanceitem">
                        {candidate.summary ? <p>{candidate.summary}</p> : null}
                        {candidate.sourceQuote ? <blockquote>“{candidate.sourceQuote}”</blockquote> : null}
                      </div>
                    ))}
                    {cluster.candidates.length > 2 ? (
                      <span>+ {cluster.candidates.length - 2} more extracted record{cluster.candidates.length - 2 === 1 ? '' : 's'}</span>
                    ) : null}
                  </div>
                ) : null}

'''
text = text.replace(anchor, preview + anchor, 1)
accept = '                      Accept as new\n'
assert text.count(accept) >= 2, 'accept labels changed'
text = text.replace(
    accept,
    "                      {cluster.candidates[0].source === 'handoff' ? 'Accept' : 'Accept as new'}\n",
    1,
)
text = text.replace(
    accept,
    "                      {candidate.source === 'handoff' ? 'Accept' : 'Accept as new'}\n",
    1,
)
review.write_text(text, encoding='utf-8')

editor = Path('src/features/codex/EntityEditorDrawer.tsx')
text = editor.read_text(encoding='utf-8')
old = '                        aria-label="Reroll field"'
new = "                        aria-label={field.kind === 'pills' ? `Reroll ${field.label}` : 'Reroll field'}"
assert text.count(old) == 1, 'reroll label anchor changed'
editor.write_text(text.replace(old, new, 1), encoding='utf-8')

styles = Path('src/styles/components.css')
text = styles.read_text(encoding='utf-8')
assert '.lw-identitycard__glance {' not in text, 'glance styles already present'
text += '''

.lw-identitycard__glance {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: 1px solid var(--line-1);
  border-radius: var(--r-4);
  background: var(--bg-tint);
}

.lw-identitycard__glanceitem {
  display: grid;
  gap: var(--sp-2);
}

.lw-identitycard__glanceitem + .lw-identitycard__glanceitem {
  padding-top: var(--sp-3);
  border-top: 1px solid var(--line-1);
}

.lw-identitycard__glance p,
.lw-identitycard__glance blockquote {
  margin: 0;
}

.lw-identitycard__glance p {
  color: var(--ink-2);
  font-size: var(--fs-sm);
}

.lw-identitycard__glance blockquote {
  color: var(--ink-2);
  font-family: var(--font-serif);
  font-style: italic;
}

.lw-identitycard__glance > span {
  color: var(--ink-4);
  font-size: var(--fs-2xs);
}
'''
styles.write_text(text, encoding='utf-8')
