module.exports = {
  name: "tracking-controls",
  description:
    "Per-entity tracking controls: case-sensitive matching and phrase exclusions. " +
    "Fixture 11 cannot prove either — its 'hess' is already rejected by the word " +
    "boundary inside 'hessian', so it passes identically with these controls on or " +
    "off. This one fails if they are not wired.",
  seed: {
    cast: [
      // Names that are also ordinary words. Without caseSensitive, "red" in
      // "the red door" and "may" in "may not return" both match.
      //
      // Note what case-sensitivity CANNOT do: a sentence-initial "May" is
      // genuinely capitalised, so it still matches. That case needs an
      // exclusion phrase, which is exactly why both controls exist.
      { id: "red", name: "Red", caseSensitive: true },
      { id: "may", name: "May", caseSensitive: true },
    ],
    locations: [
      // The entity is Reach. "the Reach" is a different thing in this world —
      // a region, not the place — so it must never count as a mention.
      { id: "reach", name: "Reach", exclusions: ["the Reach"] },
    ],
  },
  chapterId: "ch-fixture-tracking",
  text:
    "The red door had not been painted in years. Ships from the Reach came twice " +
    "a year, and the crews may not return before winter.",
  expectedOccurrences: [],
  expectedCandidates: [],
  forbiddenOccurrences: [
    // lowercase "red" — suppressed by caseSensitive
    { entityId: "red" },
    // lowercase "may" — suppressed by caseSensitive
    { entityId: "may" },
    // "the Reach" — suppressed by the exclusion phrase
    { entityId: "reach" },
  ],
  minOccurrences: 0,
  maxOccurrences: 0,
};
