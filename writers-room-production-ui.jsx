// =====================================================================
// writers-room-production-ui.jsx — DOM-level production controls for the
// existing Writer's Room without re-rendering its uncontrolled editor.
// =====================================================================

(function () {
  const service = window.LoomwrightBackend?.WriterRoomProductionService;
  if (!service || window.__LW_WRITER_PRODUCTION_UI__) return;
  window.__LW_WRITER_PRODUCTION_UI__ = true;

  let findDialog = null;
  let commentDialog = null;
  let matches = [];
  let currentMatch = -1;
  let inputTimer = null;
  let dragSourceId = null;
  let pendingCommentMeta = null;

  function notify(message) {
    try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_) {}
  }
  function button(label, testId, handler, title) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "wr-toolbar__btn wr-prod-btn";
    el.textContent = label;
    el.title = title || label;
    el.setAttribute("data-testid", testId);
    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", handler);
    return el;
  }
  function ensureProductionGroup(toolbar) {
    if (!toolbar || toolbar.querySelector("[data-ui='WriterProductionToolbar']")) return;
    const group = document.createElement("div");
    group.className = "wr-toolbar__group wr-prod-toolbar";
    group.setAttribute("data-ui", "WriterProductionToolbar");
    group.append(
      button("P", "wr-tb-paragraph", () => service.formatBlock("paragraph"), "Paragraph block"),
      button("↶", "wr-tb-undo", async () => { if (!(await service.undo())) notify("Nothing earlier to restore."); }, "Undo structured edit"),
      button("↷", "wr-tb-redo", async () => { if (!(await service.redo())) notify("Nothing later to restore."); }, "Redo structured edit"),
      button("Comment", "wr-tb-range-comment", openCommentDialog, "Comment on exact selected text"),
    );
    toolbar.appendChild(group);
  }
  function bindExistingToolbar(toolbar) {
    if (!toolbar) return;
    const controls = [
      { title: "Heading", testId: "wr-tb-heading", run: () => service.formatBlock("heading") },
      { title: "Scene break", testId: "wr-tb-scene-break", run: () => service.insertSceneBreak() },
      { title: "Quote", testId: "wr-tb-quote", run: () => service.formatBlock("quote") },
      { title: "Find / replace", testId: "wr-tb-find-replace", run: openFindDialog },
    ];
    controls.forEach((control) => {
      const el = Array.from(toolbar.querySelectorAll("button")).find((candidate) => candidate.title === control.title || candidate.title?.startsWith(control.title) || candidate.getAttribute("data-testid") === control.testId);
      if (!el) return;
      if (el.disabled) el.disabled = false;
      if (el.hasAttribute("disabled")) el.removeAttribute("disabled");
      if (el.getAttribute("aria-disabled") !== "false") el.setAttribute("aria-disabled", "false");
      if (el.title !== control.title) el.title = control.title;
      el.setAttribute("data-testid", control.testId);
      if (el.dataset.productionBound) return;
      el.dataset.productionBound = "true";
      el.addEventListener("mousedown", (event) => event.preventDefault());
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        control.run();
      }, true);
    });
    ensureProductionGroup(toolbar);
  }

  function ensureFindDialog() {
    if (findDialog) return findDialog;
    const wrap = document.createElement("div");
    wrap.className = "wr-prod-dialog-backdrop";
    wrap.hidden = true;
    wrap.setAttribute("data-testid", "wr-find-dialog");
    wrap.innerHTML = `
      <section class="wr-prod-dialog" role="dialog" aria-modal="true" aria-labelledby="wr-find-title">
        <header><div><div class="wr-prod-dialog__eyebrow">Manuscript tools</div><h2 id="wr-find-title">Find & replace</h2></div><button type="button" data-action="close" aria-label="Close">×</button></header>
        <label>Find<input data-field="query" data-testid="wr-find-query" autocomplete="off"></label>
        <label>Replace with<input data-field="replacement" data-testid="wr-replace-value" autocomplete="off"></label>
        <label class="wr-prod-check"><input type="checkbox" data-field="case"> Match case</label>
        <div class="wr-prod-dialog__status" data-field="status">Enter at least one character.</div>
        <footer>
          <button type="button" data-action="next" data-testid="wr-find-next">Find next</button>
          <button type="button" data-action="replace" data-testid="wr-replace-current">Replace</button>
          <button type="button" data-action="replace-all" data-testid="wr-replace-all">Replace all</button>
        </footer>
      </section>`;
    document.body.appendChild(wrap);
    const query = wrap.querySelector("[data-field='query']");
    const replacement = wrap.querySelector("[data-field='replacement']");
    const caseBox = wrap.querySelector("[data-field='case']");
    const status = wrap.querySelector("[data-field='status']");
    const refresh = () => {
      matches = service.findMatches(query.value, { caseSensitive: caseBox.checked });
      currentMatch = matches.length ? Math.min(Math.max(currentMatch, 0), matches.length - 1) : -1;
      status.textContent = matches.length ? `${currentMatch + 1} of ${matches.length} matches` : (query.value ? "No matches" : "Enter at least one character.");
      return matches;
    };
    const next = () => {
      refresh();
      if (!matches.length) return;
      currentMatch = (currentMatch + 1) % matches.length;
      service.selectMatch(matches[currentMatch]);
      status.textContent = `${currentMatch + 1} of ${matches.length} matches`;
    };
    query.addEventListener("input", () => { currentMatch = -1; refresh(); });
    caseBox.addEventListener("change", () => { currentMatch = -1; refresh(); });
    query.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); next(); } });
    wrap.querySelector("[data-action='close']").addEventListener("click", () => { wrap.hidden = true; service.bodyElement()?.focus(); });
    wrap.querySelector("[data-action='next']").addEventListener("click", next);
    wrap.querySelector("[data-action='replace']").addEventListener("click", async () => {
      refresh();
      if (!matches.length) return;
      if (currentMatch < 0) currentMatch = 0;
      await service.replaceMatch(matches[currentMatch], replacement.value);
      currentMatch = -1;
      refresh();
      next();
    });
    wrap.querySelector("[data-action='replace-all']").addEventListener("click", async () => {
      const count = await service.replaceAll(query.value, replacement.value, { caseSensitive: caseBox.checked });
      currentMatch = -1;
      refresh();
      notify(count ? `Replaced ${count} occurrence${count === 1 ? "" : "s"}.` : "No matches to replace.");
    });
    wrap.addEventListener("mousedown", (event) => { if (event.target === wrap) wrap.hidden = true; });
    findDialog = wrap;
    return wrap;
  }
  function openFindDialog() {
    const dialog = ensureFindDialog();
    dialog.hidden = false;
    const query = dialog.querySelector("[data-field='query']");
    query.focus();
    query.select();
  }

  function restorePendingCommentSelection() {
    const range = pendingCommentMeta?.range;
    if (!range) return false;
    try {
      const selection = window.getSelection?.();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    } catch (_) {
      return false;
    }
  }
  function ensureCommentDialog() {
    if (commentDialog) return commentDialog;
    const wrap = document.createElement("div");
    wrap.className = "wr-prod-dialog-backdrop";
    wrap.hidden = true;
    wrap.setAttribute("data-testid", "wr-range-comment-dialog");
    wrap.innerHTML = `
      <section class="wr-prod-dialog" role="dialog" aria-modal="true" aria-labelledby="wr-comment-title">
        <header><div><div class="wr-prod-dialog__eyebrow">Exact-range comment</div><h2 id="wr-comment-title">Comment on selection</h2></div><button type="button" data-action="close" aria-label="Close">×</button></header>
        <blockquote data-field="quote"></blockquote>
        <label>Comment<textarea data-field="note" data-testid="wr-range-comment-text" rows="5" placeholder="What should change, or what needs discussion?"></textarea></label>
        <div class="wr-prod-dialog__status" data-field="status"></div>
        <footer><button type="button" data-action="cancel">Cancel</button><button type="button" class="is-primary" data-action="save" data-testid="wr-range-comment-save">Add comment</button></footer>
      </section>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.hidden = true; pendingCommentMeta = null; service.bodyElement()?.focus(); };
    wrap.querySelector("[data-action='close']").addEventListener("click", close);
    wrap.querySelector("[data-action='cancel']").addEventListener("click", close);
    wrap.querySelector("[data-action='save']").addEventListener("click", async () => {
      const status = wrap.querySelector("[data-field='status']");
      const noteText = wrap.querySelector("[data-field='note']").value.trim();
      restorePendingCommentSelection();
      const result = await service.createRangeComment(noteText);
      if (!result || result.error) {
        status.textContent = result?.error || "Select text within one paragraph first.";
        return;
      }
      close();
      notify("Range comment added to the manuscript margin.");
    });
    commentDialog = wrap;
    return wrap;
  }
  function openCommentDialog() {
    const meta = service.rangeMetadata();
    if (!meta || meta.error || !meta.quote) {
      notify(meta?.error || "Select text within one paragraph before adding a range comment.");
      return;
    }
    pendingCommentMeta = meta;
    const dialog = ensureCommentDialog();
    dialog.querySelector("[data-field='quote']").textContent = `“${meta.quote}”`;
    dialog.querySelector("[data-field='note']").value = "";
    dialog.querySelector("[data-field='status']").textContent = `${meta.rangeStart}–${meta.rangeEnd} in this block`;
    dialog.hidden = false;
    dialog.querySelector("[data-field='note']").focus();
  }

  function bindBody(body) {
    if (!body || body.dataset.productionBound) return;
    body.dataset.productionBound = "true";
    setTimeout(() => {
      service.restoreStructuredHtml();
      service.ensureSeed();
    }, 0);
    body.addEventListener("input", () => {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => service.capture("typing"), 300);
    });
    body.addEventListener("keydown", (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFindDialog();
        return;
      }
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) service.redo(); else service.undo();
      }
    });
  }

  function chapterIdFromNode(node) {
    const testId = node?.getAttribute("data-testid") || "";
    return testId.startsWith("wr-chapter-") ? testId.slice("wr-chapter-".length) : null;
  }
  function bindChapterNode(node) {
    if (!node || node.dataset.productionDragBound) return;
    const id = chapterIdFromNode(node);
    if (!id) return;
    node.dataset.productionDragBound = "true";
    node.draggable = true;
    node.setAttribute("aria-description", "Drag to reorder. Alt plus arrow keys also moves this chapter.");
    node.addEventListener("dragstart", (event) => {
      dragSourceId = id;
      node.classList.add("is-dragging");
      event.dataTransfer?.setData("text/loomwright-chapter", id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    node.addEventListener("dragend", () => { dragSourceId = null; node.classList.remove("is-dragging"); });
    node.addEventListener("dragover", (event) => { event.preventDefault(); node.classList.add("is-drop-target"); });
    node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
    node.addEventListener("drop", async (event) => {
      event.preventDefault();
      node.classList.remove("is-drop-target");
      const source = event.dataTransfer?.getData("text/loomwright-chapter") || dragSourceId;
      if (source && source !== id) await service.reorderChapter(source, id, "before");
    });
    node.addEventListener("keydown", async (event) => {
      if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const siblings = Array.from(node.parentElement?.querySelectorAll("[data-testid^='wr-chapter-']") || []);
      const index = siblings.indexOf(node);
      const target = event.key === "ArrowLeft" ? siblings[index - 1] : siblings[index + 1];
      const targetId = chapterIdFromNode(target);
      if (!targetId) return;
      await service.reorderChapter(id, targetId, event.key === "ArrowLeft" ? "before" : "after");
      setTimeout(() => document.querySelector(`[data-testid='wr-chapter-${id}']`)?.focus(), 0);
    });
  }

  function bindAll(root = document) {
    bindExistingToolbar(root.querySelector?.("[data-ui='ManuscriptToolbar']") || document.querySelector("[data-ui='ManuscriptToolbar']"));
    bindBody(root.querySelector?.("[data-testid='wr-manuscript-body']") || document.querySelector("[data-testid='wr-manuscript-body']"));
    (root.querySelectorAll?.("[data-testid^='wr-chapter-']") || []).forEach(bindChapterNode);
    document.querySelectorAll("[data-testid^='wr-chapter-']").forEach(bindChapterNode);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes?.forEach((node) => {
      if (node.nodeType !== 1) return;
      bindAll(node);
    }));
    bindAll(document);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
  window.addEventListener("lw:manuscript-chapters-updated", () => setTimeout(() => bindAll(document), 0));
  window.addEventListener("lw:set-active-chapter", () => setTimeout(() => { service.restoreStructuredHtml({ force: true }); service.ensureSeed(); bindAll(document); }, 0));
  window.addEventListener("beforeunload", () => service.capture("before-unload"));
  bindAll(document);
})();
