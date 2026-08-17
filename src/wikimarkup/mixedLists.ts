// One thing the staged Doc cannot say for itself: a `#*` sub-bullet under a numbered
// step. Docs has no mixed numbered/bulleted preset, so one `createParagraphBullets`
// preset covers every level of a list (O6/D11) — nesting and the unbroken numbering
// survive, the sub-marker TYPE does not: `#*` shows as `a.`/`b.` in the Doc and comes
// back from `to-markup` as `##`.
//
// So the Doc build plants a reminder where the loss happens, as an HTML comment (a D22
// protected token, therefore verbatim through the round-trip and invisible on SUMO) —
// the editor sees it in the markup at exactly the moment they paste into SUMO.

import type { Block } from "./docModel.js";

/** Stable prefix, so re-staging markup that already carries a note doesn't double it. */
export const NOTE_PREFIX = "<!-- TODO (sumo-kb-tools):";

export const MIXED_LIST_NOTE =
  `${NOTE_PREFIX} some sub-steps in the list below are "#*" bullets in the wiki source, ` +
  `but a Google Doc list can only carry one marker style, so they show as "a./b." here ` +
  `and come back from to-markup as "##". Restore "#*" before pasting into SUMO, then ` +
  `delete this comment. -->`;

function noteBlock(): Block {
  // A token-only line, tight so it hugs the list it is about (D20) — the Doc gets no
  // extra blank line and the round-trip puts the comment on its own source line.
  return { type: "paragraph", runs: [{ text: MIXED_LIST_NOTE, token: true }], tight: true };
}

function alreadyNoted(block: Block | undefined): boolean {
  if (!block || block.type !== "paragraph") return false;
  return block.runs.map((r) => r.text).join("").trimStart().startsWith(NOTE_PREFIX);
}

/**
 * Insert a reminder above every list whose nested items lose their marker type.
 * Returns a new block array; `notes` is how many reminders were added.
 */
export function noteMixedListMarkers(blocks: Block[]): { blocks: Block[]; notes: number } {
  const out: Block[] = [];
  let notes = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== "listItem" || (i > 0 && blocks[i - 1].type === "listItem")) {
      out.push(block);
      continue;
    }

    // Start of a contiguous list run — does any nested item differ from the type of the
    // level-1 item it sits under? That outermost type is the one the preset follows.
    let lossy = false;
    let outerOrdered = block.ordered;
    for (let j = i; j < blocks.length; j++) {
      const item = blocks[j];
      if (item.type !== "listItem") break;
      if (item.level <= 1) outerOrdered = item.ordered;
      else if (item.ordered !== outerOrdered) lossy = true;
    }

    if (lossy && !alreadyNoted(blocks[i - 1])) {
      out.push(noteBlock());
      notes++;
    }
    out.push(block);
  }

  return { blocks: out, notes };
}
