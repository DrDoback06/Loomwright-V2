// Offline discovery must surface characters introduced WITHOUT an explicit
// speech verb — the common cases: a name hugging a quotation mark
// (`"…!" Pipkins`) and a sentence-opening name + action verb (`Grimguff
// looked.`). It must NOT mistake ALL-CAPS signage ("CIVIC PARTICIPANT") or
// in-quote contraction openers ("It's", "You're") for characters.
module.exports = {
  name: "discover-implicit-dialogue",
  description: "Implicit dialogue attribution + subject-verb intros surface cast; signage and contractions do not.",
  seed: {},
  chapterId: "ch-fixture-17",
  text:
    "The vest still said CIVIC PARTICIPANT across the back.\n\n" +
    "\"You're bleeding!\" Pipkins was at his side instantly, small hands reaching for the wound.\n\n" +
    "\"It's fine.\"\n\n" +
    "\"It's not fine, you dense prick! Look at it!\"\n\n" +
    "Grimguff looked. The cut was clean, almost surgical.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [
    { entityType: "cast", suggestedAction: "create", matchType: "new" },
  ],
  expectedCandidateNames: ["Pipkins", "Grimguff"],
  forbiddenCandidateNames: ["CIVIC PARTICIPANT", "It's", "You're"],
  forbiddenOccurrences: [],
};
