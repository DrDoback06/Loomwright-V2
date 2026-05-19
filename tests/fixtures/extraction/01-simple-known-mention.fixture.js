module.exports = {
  name: "simple-known-mention",
  description: "Single seeded cast member mentioned twice in one chapter. Expect 2 occurrences, 0 candidates.",
  seed: {
    cast: [{ id: "aelinor", name: "Aelinor" }],
  },
  chapterId: "ch-fixture-01",
  text: "Aelinor walked the wall at dawn. Far below, the harbour stirred, and Aelinor turned for home.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
  ],
  expectedCandidates: [],
  forbiddenOccurrences: [],
  minOccurrences: 2,
  maxOccurrences: 4,
};
