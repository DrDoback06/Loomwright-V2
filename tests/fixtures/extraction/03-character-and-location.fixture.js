module.exports = {
  name: "character-and-location",
  description: "Two seeded cast and one seeded location. No travel verb; just co-occurrence.",
  seed: {
    cast: [
      { id: "aelinor", name: "Aelinor" },
      { id: "saren",   name: "Saren" },
    ],
    locations: [
      { id: "vraska",  name: "Vraska Pass" },
    ],
  },
  chapterId: "ch-fixture-03",
  text: "At Vraska Pass the wind never stopped. Aelinor leaned on the rampart while Saren counted the watch.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    { entityId: "saren",   exactText: "Saren" },
    { entityId: "vraska",  exactText: "Vraska Pass" },
  ],
  expectedCandidates: [],
  forbiddenOccurrences: [],
  minOccurrences: 3,
  maxOccurrences: 5,
};
