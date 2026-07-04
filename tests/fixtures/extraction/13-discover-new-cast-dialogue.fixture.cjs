// Headline offline-discovery proof: a FRESH project (no seed, no AI) must
// discover brand-new cast members from dialogue attribution and honorifics.
module.exports = {
  name: "discover-new-cast-dialogue",
  description: "Fresh project discovers new cast from dialogue attribution + honorific, offline.",
  seed: {},
  chapterId: "ch-fixture-13",
  text: "\"We ride at dawn,\" said Aelinor. Lord Brennan only nodded. Later, Aelinor found Brennan waiting by the gate.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    { entityType: "cast", suggestedAction: "create", matchType: "new" },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 2,
};
