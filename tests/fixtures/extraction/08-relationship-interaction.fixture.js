module.exports = {
  name: "relationship-interaction",
  description: "Two seeded cast and a relationship verb between them. Relationship candidate created.",
  seed: {
    cast: [
      { id: "aelinor", name: "Aelinor" },
      { id: "saren",   name: "Saren" },
    ],
  },
  chapterId: "ch-fixture-08",
  text: "Aelinor whispered to Saren at the gate, and the courier did not turn.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    { entityId: "saren",   exactText: "Saren" },
  ],
  expectedCandidates: [
    {
      entityType: "relationships",
      suggestedAction: "create",
      matchType: "new",
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 2,
  maxOccurrences: 4,
};
