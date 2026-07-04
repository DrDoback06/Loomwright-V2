module.exports = {
  name: "lore-canon-mention",
  description: "Lore-flag phrase produces a lore candidate of scope 'world-history' or 'legend'.",
  seed: {},
  chapterId: "ch-fixture-10",
  text: "Centuries ago the Reach had been green, and the rivers ran the other way.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    {
      entityType: "lore",
      suggestedAction: "create",
      matchType: "new",
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 0,
  maxOccurrences: 1,
};
