/** A block as BlockNote hands it over: only what the check needs. */
export interface BlockLike {
  id: string;
  type: string;
  props?: { checked?: boolean };
  children?: BlockLike[];
}

/** id -> checked for every checklist item, nested ones included. */
export function checkStates(blocks: BlockLike[], out = new Map<string, boolean>()): Map<string, boolean> {
  for (const b of blocks) {
    if (b.type === 'checkListItem') out.set(b.id, !!b.props?.checked);
    if (b.children?.length) checkStates(b.children, out);
  }
  return out;
}

/**
 * Whether an existing checklist item was ticked or unticked. New or removed
 * items are ordinary edits (they wait for Save); only a tick saves at once.
 */
export function tickChanged(before: Map<string, boolean>, after: Map<string, boolean>): boolean {
  for (const [id, checked] of after) {
    const was = before.get(id);
    if (was !== undefined && was !== checked) return true;
  }
  return false;
}
