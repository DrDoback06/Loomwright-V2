module.exports = {
  name: "false-positive-trap",
  description: "Common words that should NOT match seeded entities: 'hess' lowercased, 'pass' as a common noun, 'reach' as a verb.",
  seed: {
    // 'Hess' would be a seeded surname; should only match when capitalised + isolated.
    cast: [{ id: "hess", name: "Hess" }],
    // 'Pass' as a seeded location — must not collide with the verb/common noun.
    locations: [{ id: "vraska", name: "Vraska Pass" }],
  },
  chapterId: "ch-fixture-11",
  text: "She did not pass the test on hessian cloth. Reach for the lantern, the courier said.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [],
  forbiddenOccurrences: [
    { entityId: "hess" },
    { entityId: "vraska" },
  ],
  minOccurrences: 0,
  maxOccurrences: 0,
};
