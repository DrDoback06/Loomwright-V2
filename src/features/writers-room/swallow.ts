import type { SyntheticEvent, KeyboardEvent } from 'react';

/** Stop a node view's own chrome from being read as editing.
 *
 * Controls inside a `ReactNodeViewRenderer` sit within the editor's DOM, so
 * every key they see also reaches ProseMirror's keymap: Backspace in a
 * paste box would delete the node holding it, Enter would split a block
 * nobody is editing.
 *
 * **Modified keys are deliberately let through.** Ctrl/Cmd combinations are
 * application shortcuts, not text entry — swallowing them made the command
 * palette unreachable while the caret sat in a section's checkbox, which is
 * a worse bug than the one this guard exists to prevent. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

const stopUnlessShortcut = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) return;
  e.stopPropagation();
};

export const swallowEditorKeys = {
  onKeyDown: stopUnlessShortcut,
  onKeyUp: stopUnlessShortcut,
  onBeforeInput: stop,
  onPaste: stop,
  onDrop: stop,
  onMouseDown: stop,
};
