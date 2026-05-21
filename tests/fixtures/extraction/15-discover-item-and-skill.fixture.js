// Offline-discovery proof: a named item ("called Big Sword") and a named
// skill ("skill called Power Strike") on a fresh project with no AI. Mirrors
// the owner's flagship example ("Steve found a weapon called Big Sword...").
module.exports = {
  name: "discover-item-and-skill",
  description: "Fresh project discovers a named item and a named skill, offline.",
  seed: {},
  chapterId: "ch-fixture-15",
  text: "Steve found a weapon called Big Sword. When he gripped it, he learned a skill called Power Strike.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    { entityType: "items", suggestedAction: "create", matchType: "new" },
    { entityType: "skills", suggestedAction: "create", matchType: "new" },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 1,
};
