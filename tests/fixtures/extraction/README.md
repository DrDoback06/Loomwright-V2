# Extraction Fixtures

Each `*.fixture.js` file in this directory describes one extraction
scenario with seeded entities, chapter text, and expectations.

Used by:
- `scripts/smoke-services.js` — runs every fixture in-process against
  the real `ExtractionService` and asserts the expected occurrences
  and candidates.
- (Future) end-to-end browser tests that load fixtures and verify the
  Writer's Room rendering path.

## Fixture shape

```js
module.exports = {
  name: "...",            // kebab-case unique id
  description: "...",
  seed: {                 // entities to load before extraction runs
    cast:      [{ id, name, aliases?: [] }],
    locations: [...],
    items:     [...],
    stats:     [...],
    ...
  },
  chapterId: "ch-fixture-...",
  text: "...",            // chapter body
  paragraphs: null,       // or [{ id, start, end }] for paragraph metadata
  expectedOccurrences: [  // SUBSET; minimum the extractor must produce
    { entityId, exactText }
  ],
  expectedCandidates: [   // SUBSET; minimum the extractor must produce
    { entityType, suggestedAction, matchType, existingEntityId?, name? }
  ],
  forbiddenOccurrences: [ // entities that must NOT be matched
    { entityId }
  ],
  minOccurrences: <n>,
  maxOccurrences: <n>,
};
```

The harness in `scripts/smoke-services.js` iterates these fixtures,
loads them into the in-process shimmed backend, calls
`ExtractionService.runExtraction`, and verifies the assertions.

Fixtures should be lightweight and self-contained — synthetic Pale
Reach-flavoured text close to the bundled sample world.
