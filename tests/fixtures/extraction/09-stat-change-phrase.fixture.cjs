module.exports = {
  name: "stat-change-phrase",
  description: "Pattern <actor>'s <stat> <verb> for a seeded cast member. Stat candidate created.",
  seed: {
    cast: [{ id: "aelinor", name: "Aelinor" }],
  },
  chapterId: "ch-fixture-09",
  text: "Aelinor's resolve hardened against the wind.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
  ],
  expectedCandidates: [
    {
      entityType: "stats",
      suggestedAction: "create",
      matchType: "new",
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 1,
  maxOccurrences: 3,
};
