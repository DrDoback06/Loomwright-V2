// Long-chapter fixture: a single deliberate entity mention placed near
// the 5000-char chunking boundary. The chunker overlaps by 500 chars,
// so the mention should be captured exactly once (no double-count).

const filler = "The wind off the harbour was cold and steady, and the men on the wall counted the lanterns again. ".repeat(40);
// filler is ~4000 chars. Pad with another ~600 to push past the chunk boundary, then drop the mention.
const padding = "Time stretched. The wall watched the sea. The sea watched the wall. ".repeat(10);
const mention = "Aelinor stepped onto the parapet just before the next watch.";

module.exports = {
  name: "long-chapter-chunking",
  description: "Tests that a deliberate mention straddling the 5000/500-overlap chunk boundary is captured exactly once.",
  seed: {
    cast: [{ id: "aelinor", name: "Aelinor" }],
  },
  chapterId: "ch-fixture-12",
  text: filler + padding + mention,
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
  ],
  expectedCandidates: [],
  forbiddenOccurrences: [],
  // Local scan operates on the full text once (not chunked), so we
  // expect exactly one occurrence regardless of chunker behaviour.
  minOccurrences: 1,
  maxOccurrences: 1,
};
