module.exports = {
  name: "quest-progression",
  description: "Quest-progression pattern: 'the hunt for X' referencing a seeded item.",
  seed: {
    items: [{ id: "auger", name: "Auger of Hess" }],
  },
  chapterId: "ch-fixture-06",
  text: "The hunt for the Auger of Hess had moved into its second phase.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "auger", exactText: "Auger of Hess" },
  ],
  expectedCandidates: [
    {
      entityType: "quests",
      suggestedAction: "create",
      matchType: "new",
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 1,
  maxOccurrences: 3,
};
