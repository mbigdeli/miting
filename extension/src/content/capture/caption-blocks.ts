/**
 * Per-block caption identity.
 *
 * Meet renders each utterance as its own DOM block and keeps REVISING earlier
 * blocks while later ones grow — a long turn gets its tail rewritten while the
 * next speaker's block is already on screen. Following only "the last block"
 * lost those revisions outright (a whole turn once survived as one word), and
 * no text-similarity rule can say which row an update belongs to. A number per
 * block can: the tracker pins one per-session sequence number to each DOM
 * node, and the server upserts by it.
 */

export class CaptionBlockTracker {
  private seqs = new WeakMap<Element, number>();
  private next = 1;
  /** What was last sent per block, so an unchanged block costs nothing. */
  private lastSent = new Map<number, string>();

  /** The stable per-session number for this block, assigned on first sight. */
  seqFor(block: Element): number {
    const existing = this.seqs.get(block);
    if (existing !== undefined) return existing;
    const assigned = this.next;
    this.next += 1;
    this.seqs.set(block, assigned);
    return assigned;
  }

  /** True when this block's content differs from what was already sent. */
  changed(seq: number, speaker: string | null, text: string): boolean {
    const key = `${speaker ?? ""}\u0000${text}`;
    if (this.lastSent.get(seq) === key) return false;
    this.lastSent.set(seq, key);
    return true;
  }

  /** A new session starts its numbering (and its dedup memory) fresh. */
  reset(): void {
    this.seqs = new WeakMap();
    this.next = 1;
    this.lastSent.clear();
  }

  /**
   * Continue a resumed session's numbering ABOVE its stored rows.
   *
   * A rejoin renders a fresh caption region, and numbering it from 1 made the
   * upserts overwrite the session's own opening rows — "the previous
   * meeting's transcript vanished and a short piece of the new speech sat in
   * its place" was exactly this. The server, which owns the rows, says where
   * to continue from.
   */
  seed(nextSeq: number): void {
    if (Number.isInteger(nextSeq) && nextSeq > this.next) {
      this.next = nextSeq;
    }
  }
}
