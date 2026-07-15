// =====================================================================
// writers-room-production-service.jsx — production editing helpers layered
// over the existing uncontrolled Writer's Room contentEditable canvas.
// =====================================================================

(function () {
  const backend = window.LoomwrightBackend;
  if (!backend || backend.WriterRoomProductionService) return;

  const HISTORY_KEY = "writer_room_history_v1";
  const MAX_HISTORY = 80;
  let suppressCapture = false;
  let restoredChapterId = null;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const nowIso = () => new Date().toISOString();
  const uuid = (prefix = "wr") => prefix + "-" + (window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const escapeSelector = (value) => window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");

  function bodyElement() {
    return document.querySelector("[data-testid='wr-manuscript-body']");
  }
  function titleElement() {
    return document.querySelector("[data-ui='ManuscriptTitle']");
  }
  function chapterId() {
    return document.querySelector("[data-ui='ManuscriptCanvas'][data-chapter-id]")?.getAttribute("data-chapter-id") || null;
  }
  function paragraphElement(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return element?.closest?.("[data-paragraph-id]") || null;
  }
  function historyState() {
    const raw = backend.StorageService?.getSync?.(HISTORY_KEY, null);
    return raw && raw.byChapter ? raw : { version: 1, byChapter: {}, updatedAt: null };
  }
  async function saveHistory(state) {
    const next = { ...state, version: 1, updatedAt: nowIso() };
    await backend.StorageService?.set?.(HISTORY_KEY, next);
    window.dispatchEvent(new CustomEvent("lw:writer-history-updated", { detail: { chapterId: chapterId() } }));
    return next;
  }
  function currentSnapshot(reason = "edit") {
    const body = bodyElement();
    const title = titleElement();
    if (!body) return null;
    return {
      id: uuid("wrs"),
      html: body.innerHTML || "",
      title: (title?.innerText || "").trim(),
      reason,
      createdAt: nowIso(),
    };
  }
  async function capture(reason = "edit", options = {}) {
    if (suppressCapture) return null;
    const cid = chapterId();
    const snapshot = currentSnapshot(reason);
    if (!cid || !snapshot) return null;
    const state = historyState();
    const row = state.byChapter[cid] || { entries: [], index: -1 };
    const current = row.entries[row.index] || null;
    if (!options.force && current && current.html === snapshot.html && current.title === snapshot.title) return current;
    const kept = row.entries.slice(0, row.index + 1);
    kept.push(snapshot);
    const entries = kept.slice(-MAX_HISTORY);
    state.byChapter[cid] = { entries, index: entries.length - 1 };
    await saveHistory(state);
    return snapshot;
  }
  async function ensureSeed(reason = "chapter-open") {
    const cid = chapterId();
    if (!cid) return null;
    const state = historyState();
    const row = state.byChapter[cid];
    if (row?.entries?.length) return row.entries[row.index];
    return capture(reason, { force: true });
  }
  async function applySnapshot(snapshot) {
    if (!snapshot) return false;
    const body = bodyElement();
    const title = titleElement();
    if (!body) return false;
    suppressCapture = true;
    body.innerHTML = snapshot.html || "";
    if (title) title.textContent = snapshot.title || "Untitled";
    body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
    suppressCapture = false;
    return true;
  }
  async function stepHistory(direction) {
    const cid = chapterId();
    if (!cid) return false;
    const state = historyState();
    const row = state.byChapter[cid];
    if (!row?.entries?.length) return false;
    const nextIndex = Math.max(0, Math.min(row.entries.length - 1, row.index + direction));
    if (nextIndex === row.index) return false;
    row.index = nextIndex;
    state.byChapter[cid] = row;
    await saveHistory(state);
    return applySnapshot(row.entries[nextIndex]);
  }

  function selectionBlocks() {
    const body = bodyElement();
    const selection = window.getSelection?.();
    if (!body || !selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer)) return [];
    const blocks = Array.from(body.querySelectorAll("[data-paragraph-id]")).filter((block) => {
      try { return range.intersectsNode(block); } catch (_) { return false; }
    });
    return blocks.length ? blocks : [paragraphElement(selection.anchorNode)].filter(Boolean);
  }
  function replaceBlockTag(block, tag, kind) {
    if (!block || block.tagName?.toLowerCase() === tag.toLowerCase()) {
      if (block) block.setAttribute("data-block-type", kind);
      return block;
    }
    const replacement = document.createElement(tag);
    Array.from(block.attributes || []).forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    replacement.innerHTML = block.innerHTML;
    replacement.classList.add("wr-p");
    replacement.setAttribute("data-block-type", kind);
    if (kind === "heading") replacement.classList.add("wr-p--heading");
    if (kind === "quote") replacement.classList.add("wr-p--quote");
    block.replaceWith(replacement);
    return replacement;
  }
  async function formatBlock(kind) {
    const tag = kind === "heading" ? "h2" : kind === "quote" ? "blockquote" : "p";
    await capture("before-format", { force: true });
    const blocks = selectionBlocks();
    if (!blocks.length) return false;
    blocks.forEach((block) => replaceBlockTag(block, tag, kind));
    bodyElement()?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBlock" }));
    await capture("format-" + kind, { force: true });
    return true;
  }
  async function insertSceneBreak() {
    const body = bodyElement();
    if (!body) return false;
    await capture("before-scene-break", { force: true });
    const selection = window.getSelection?.();
    const current = paragraphElement(selection?.anchorNode) || body.lastElementChild;
    const marker = document.createElement("div");
    marker.className = "wr-scene-break";
    marker.setAttribute("data-kind", "scene-break");
    marker.setAttribute("data-paragraph-id", uuid("sb"));
    marker.setAttribute("contenteditable", "false");
    marker.innerHTML = '<span class="wr-scene-break__line"></span><span aria-hidden="true">※ &nbsp; ※ &nbsp; ※</span><span class="wr-scene-break__line"></span>';
    const next = document.createElement("p");
    next.className = "wr-p";
    next.setAttribute("data-paragraph-id", uuid("p"));
    next.innerHTML = "<br>";
    if (current?.parentNode === body) {
      current.after(marker, next);
    } else {
      body.append(marker, next);
    }
    const range = document.createRange();
    range.selectNodeContents(next);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    next.focus?.();
    body.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
    await capture("insert-scene-break", { force: true });
    return true;
  }

  function editableTextNodes(root = bodyElement()) {
    if (!root || !document.createTreeWalker) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[data-kind='scene-break']")) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[contenteditable='false']")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
  function findMatchesInText(text, query, options = {}) {
    const source = String(text || "");
    const needle = String(query || "");
    if (!needle) return [];
    const haystack = options.caseSensitive ? source : source.toLowerCase();
    const target = options.caseSensitive ? needle : needle.toLowerCase();
    const rows = [];
    let index = 0;
    while ((index = haystack.indexOf(target, index)) >= 0) {
      rows.push({ start: index, end: index + target.length });
      index += Math.max(1, target.length);
    }
    return rows;
  }
  function findMatches(query, options = {}) {
    const nodes = editableTextNodes();
    const rows = [];
    nodes.forEach((node) => {
      findMatchesInText(node.nodeValue || "", query, options).forEach((match) => rows.push({ ...match, node }));
    });
    return rows;
  }
  function selectMatch(match) {
    if (!match?.node) return false;
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);
    const selection = window.getSelection?.();
    selection?.removeAllRanges();
    selection?.addRange(range);
    match.node.parentElement?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    return true;
  }
  async function replaceMatch(match, replacement) {
    if (!match?.node) return false;
    await capture("before-replace", { force: true });
    const text = match.node.nodeValue || "";
    match.node.nodeValue = text.slice(0, match.start) + String(replacement || "") + text.slice(match.end);
    bodyElement()?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
    await capture("replace", { force: true });
    return true;
  }
  async function replaceAll(query, replacement, options = {}) {
    const matches = findMatches(query, options);
    if (!matches.length) return 0;
    await capture("before-replace-all", { force: true });
    [...matches].reverse().forEach((match) => {
      const text = match.node.nodeValue || "";
      match.node.nodeValue = text.slice(0, match.start) + String(replacement || "") + text.slice(match.end);
    });
    bodyElement()?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
    await capture("replace-all", { force: true });
    return matches.length;
  }

  function rangeMetadata() {
    const body = bodyElement();
    const selection = window.getSelection?.();
    if (!body || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer)) return null;
    const startBlock = paragraphElement(range.startContainer);
    const endBlock = paragraphElement(range.endContainer);
    if (!startBlock || startBlock !== endBlock) return { error: "Select text within one block." };
    const before = document.createRange();
    before.selectNodeContents(startBlock);
    before.setEnd(range.startContainer, range.startOffset);
    const through = document.createRange();
    through.selectNodeContents(startBlock);
    through.setEnd(range.endContainer, range.endOffset);
    return {
      chapterId: chapterId(),
      paragraphId: startBlock.getAttribute("data-paragraph-id"),
      rangeStart: before.toString().length,
      rangeEnd: through.toString().length,
      quote: range.toString().replace(/\s+/g, " ").trim(),
      blockType: startBlock.getAttribute("data-block-type") || startBlock.tagName.toLowerCase(),
      anchorTextLength: (startBlock.textContent || "").length,
      range,
    };
  }
  async function createRangeComment(noteText = "") {
    const meta = rangeMetadata();
    if (!meta || meta.error || !meta.quote) return meta || { error: "Select text first." };
    const note = await backend.ManuscriptNoteService?.createNote?.({
      chapterId: meta.chapterId,
      paragraphId: meta.paragraphId,
      rangeStart: meta.rangeStart,
      rangeEnd: meta.rangeEnd,
      quote: meta.quote,
      noteText,
      source: "selection-range",
      anchorVersion: { textLength: meta.anchorTextLength, blockType: meta.blockType },
    });
    if (note?.id) {
      try {
        const span = document.createElement("span");
        span.className = "wr-range-comment";
        span.setAttribute("data-comment-id", note.id);
        span.appendChild(meta.range.extractContents());
        meta.range.insertNode(span);
      } catch (_) {}
      bodyElement()?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBackColor" }));
      await capture("range-comment", { force: true });
    }
    return note;
  }

  function reorderState(state, sourceId, targetId, position = "before") {
    const chapters = clone(state?.chapters || []);
    const sourceIndex = chapters.findIndex((row) => row.id === sourceId);
    const targetIndex = chapters.findIndex((row) => row.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return clone(state);
    const [source] = chapters.splice(sourceIndex, 1);
    let insertion = chapters.findIndex((row) => row.id === targetId);
    if (position === "after") insertion += 1;
    chapters.splice(Math.max(0, insertion), 0, source);
    return {
      ...clone(state),
      chapters: chapters.map((row, index) => ({ ...row, num: index + 1, slotNumber: index + 1 })),
    };
  }
  async function reorderChapter(sourceId, targetId, position = "before") {
    const service = backend.ManuscriptChapterService;
    if (!service || !sourceId || !targetId) return false;
    const before = service.loadSync();
    const next = reorderState(before, sourceId, targetId, position);
    if (JSON.stringify(before.chapters || []) === JSON.stringify(next.chapters || [])) return false;
    await service.save(next);
    window.dispatchEvent(new CustomEvent("lw:writer-chapter-reordered", { detail: { sourceId, targetId, position } }));
    return true;
  }

  function persistedStructuredHtml(cid = chapterId()) {
    if (!cid) return "";
    const state = backend.ManuscriptChapterService?.loadSync?.() || {};
    return state.manuscripts?.[cid]?.html || "";
  }
  function restoreStructuredHtml(options = {}) {
    const cid = chapterId();
    const body = bodyElement();
    if (!cid || !body) return false;
    if (!options.force && restoredChapterId === cid) return false;
    const html = persistedStructuredHtml(cid);
    restoredChapterId = cid;
    if (!html || !/<(?:h[1-6]|blockquote|div)[^>]*(?:data-block-type|data-kind=["']scene-break)/i.test(html)) return false;
    if (body.innerHTML !== html) body.innerHTML = html;
    return true;
  }

  const service = {
    HISTORY_KEY,
    bodyElement,
    titleElement,
    chapterId,
    capture,
    ensureSeed,
    undo: () => stepHistory(-1),
    redo: () => stepHistory(1),
    historyState,
    formatBlock,
    insertSceneBreak,
    findMatches,
    selectMatch,
    replaceMatch,
    replaceAll,
    rangeMetadata,
    createRangeComment,
    reorderChapter,
    restoreStructuredHtml,
    persistedStructuredHtml,
    _test: { findMatchesInText, reorderState },
  };

  backend.WriterRoomProductionService = service;
  window.WriterRoomProductionService = service;
  window.dispatchEvent(new CustomEvent("lw:writer-production-ready"));
})();
