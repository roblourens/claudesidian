/**
 * Checkbox toggle extension.
 * 
 * Provides Cmd+L to cycle through bullet point states:
 * - Plain bullet: `- `
 * - Unchecked checkbox: `- [ ] `
 * - Checked checkbox: `- [x] `
 * 
 * Then continues cycling: checked -> plain -> unchecked -> checked...
 */

import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';

/**
 * Toggle checkbox state for the current line.
 * Returns true if handled, false otherwise.
 */
function toggleCheckbox(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const lineText = line.text;

  // Match bullet point patterns
  const plainBullet = /^(\s*)- (.*)$/;
  const uncheckedBox = /^(\s*)- \[ \] (.*)$/;
  const checkedBox = /^(\s*)- \[x\] (.*)$/;

  let newText: string;
  let match: RegExpMatchArray | null;

  if ((match = lineText.match(checkedBox))) {
    // Checked -> Unchecked
    const [, indent, rest] = match;
    newText = `${indent}- [ ] ${rest}`;
  } else if ((match = lineText.match(uncheckedBox))) {
    // Unchecked -> Checked
    const [, indent, rest] = match;
    newText = `${indent}- [x] ${rest}`;
  } else if ((match = lineText.match(plainBullet))) {
    // Plain bullet -> Unchecked
    const [, indent, rest] = match;
    newText = `${indent}- [ ] ${rest}`;
  } else {
    // Not a bullet point, do nothing
    return false;
  }

  // Move cursor to the end of the checkbox/bullet prefix
  const checkboxPrefix = /^\s*- \[[ x]\] /;
  const bulletPrefix = /^\s*- /;

  let newCursorOffset = 0;
  if (checkboxPrefix.test(newText)) {
    newCursorOffset = newText.match(checkboxPrefix)?.[0].length ?? 0;
  } else {
    newCursorOffset = newText.match(bulletPrefix)?.[0].length ?? 0;
  }

  view.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: newText,
    },
    selection: {
      anchor: line.from + Math.min(newCursorOffset, newText.length),
    },
  });

  return true;
}

/**
 * Keymap for checkbox toggle.
 */
export const checkboxToggleKeymap = Prec.high(
  keymap.of([
    {
      key: 'Mod-l',
      run: toggleCheckbox,
    },
  ])
);
