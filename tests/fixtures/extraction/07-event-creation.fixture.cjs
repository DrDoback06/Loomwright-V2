module.exports = {
  name: "event-creation",
  description: "Proper-noun event with 'began' verb. Event candidate with suggestedAction 'create'.",
  seed: {},
  chapterId: "ch-fixture-07",
  text: "Then the Auger Wake began, and no one in the Reach slept that night.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    {
      entityType: "events",
      suggestedAction: "create",
      matchType: "new",
    },
  ],
  forbiddenOccurrences: [],
  minOccurrences: 0,
  maxOccurrences: 1,
};
