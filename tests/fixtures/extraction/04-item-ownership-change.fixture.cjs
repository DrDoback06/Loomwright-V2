module.exports = {
  name: "item-ownership-change",
  description: "Cast hands an item to another cast — should produce an item-ownership candidate with suggestedChanges.ownerId.",
  seed: {
    cast: [
      { id: "aelinor", name: "Aelinor" },
      { id: "saren",   name: "Saren" },
    ],
    items: [
      { id: "auger", name: "Auger of Hess" },
    ],
  },
  chapterId: "ch-fixture-04",
  text: "Aelinor handed the Auger of Hess to Saren without a word.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    { entityId: "saren",   exactText: "Saren" },
    { entityId: "auger",   exactText: "Auger of Hess" },
  ],
  expectedCandidates: [
    {
      entityType: "items",
      suggestedAction: "update",
      matchType: "exact",
      existingEntityId: "auger",
      suggestedChanges: { ownerId: "saren" },
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 3,
  maxOccurrences: 5,
};
