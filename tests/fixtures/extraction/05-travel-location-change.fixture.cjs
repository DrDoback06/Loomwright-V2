module.exports = {
  name: "travel-location-change",
  description: "Cast crosses a known location. Should produce a travel candidate (update on cast).",
  seed: {
    cast: [{ id: "aelinor", name: "Aelinor" }],
    locations: [{ id: "vraska", name: "Vraska Pass" }],
  },
  chapterId: "ch-fixture-05",
  text: "Aelinor crossed Vraska Pass at first light.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    { entityId: "vraska",  exactText: "Vraska Pass" },
  ],
  expectedCandidates: [
    {
      entityType: "cast",
      suggestedAction: "update",
      matchType: "exact",
      existingEntityId: "aelinor",
      suggestedChanges: { location: "vraska" },
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 2,
  maxOccurrences: 4,
};
