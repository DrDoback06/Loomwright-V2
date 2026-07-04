// Offline-discovery proof: locations from "keep of X" / "city of Y" cue
// phrases and directional prepositions, on a fresh project with no AI.
module.exports = {
  name: "discover-location-cue",
  description: "Fresh project discovers new locations from cue phrases + directional prepositions, offline.",
  seed: {},
  chapterId: "ch-fixture-14",
  text: "They crossed into Hesselmark at dusk. The keep of Vraska stood dark against the sky. Beyond the wall lay the city of Dunmark.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    { entityType: "locations", suggestedAction: "create", matchType: "new" },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 1,
};
