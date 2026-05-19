module.exports = {
  name: "alias-nickname",
  description: "Cast member referred to by full name and capitalised alias in same chapter.",
  seed: {
    cast: [{ id: "aelinor", name: "Aelinor", aliases: ["Ael of Hess"] }],
  },
  chapterId: "ch-fixture-02",
  text: "Aelinor stood at the parapet. \"Ael of Hess,\" the captain said. Aelinor did not turn.",
  paragraphs: null,
  expectedOccurrences: [
    { entityId: "aelinor", exactText: "Aelinor" },
    { entityId: "aelinor", exactText: "Ael of Hess" },
  ],
  expectedCandidates: [],
  forbiddenOccurrences: [],
  minOccurrences: 3,
  maxOccurrences: 6,
};
