// =====================================================================
// writers-room-production-rules.jsx — compatibility rules for exact-range
// manuscript comments created through ManuscriptNoteService.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  const notes = backend?.ManuscriptNoteService;
  if (!notes || notes.__rangeMetadataRulesInstalled) return;

  const originalCreate = notes.createNote?.bind(notes);
  if (!originalCreate) return;

  notes.createNote = async function createNoteWithRangeMetadata(fields = {}) {
    const note = await originalCreate(fields);
    if (!note?.id || fields.rangeStart == null || fields.rangeEnd == null) return note;

    const patch = {
      rangeStart: Number(fields.rangeStart),
      rangeEnd: Number(fields.rangeEnd),
      quote: fields.quote || note.quote || "",
      source: fields.source || "selection-range",
      blockType: fields.blockType || fields.anchorVersion?.blockType || null,
      anchorVersion: fields.anchorVersion || null,
    };

    if (notes.updateNote) await notes.updateNote(note.id, patch);
    const persisted = notes.listByChapterSync?.(fields.chapterId || note.chapterId)?.find((row) => row.id === note.id);
    return persisted || { ...note, ...patch };
  };

  notes.__rangeMetadataRulesInstalled = true;
  window.dispatchEvent(new CustomEvent("lw:writer-range-note-rules-ready"));
})();
