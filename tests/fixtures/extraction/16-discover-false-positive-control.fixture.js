// False-positive control for offline discovery: sentence-initial common
// words ("Morning") and single-mention bare proper nouns must NOT become
// candidates or occurrences.
module.exports = {
  name: "discover-false-positive-control",
  description: "Sentence-initial common words and single-mention proper nouns produce no candidates.",
  seed: {},
  chapterId: "ch-fixture-16",
  text: "Then the men marched on. Morning came. Then they rested a while. Morning came again, grey and cold. Nothing else stirred.",
  paragraphs: null,
  expectedOccurrences: [],
  expectedCandidates: [],
  forbiddenOccurrences: [],
  maxOccurrences: 0,
};
