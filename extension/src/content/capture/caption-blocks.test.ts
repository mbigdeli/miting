import { describe, expect, it } from "vitest";
import { CaptionBlockTracker } from "./caption-blocks.js";

/**
 * Meet revises EARLIER caption blocks while later ones grow. Addressing each
 * block by a stable per-session number is what lets those revisions land on
 * the right row instead of being lost or glued onto the wrong turn.
 */
describe("CaptionBlockTracker", () => {
  const el = () => document.createElement("div");

  it("pins one number to each block for the life of the session", () => {
    const t = new CaptionBlockTracker();
    const a = el();
    const b = el();

    expect(t.seqFor(a)).toBe(1);
    expect(t.seqFor(b)).toBe(2);
    // The same node keeps its number however often it is seen.
    expect(t.seqFor(a)).toBe(1);
  });

  it("reports a block changed only when its content actually moved", () => {
    const t = new CaptionBlockTracker();
    const seq = t.seqFor(el());

    expect(t.changed(seq, "Sam", "salam")).toBe(true);
    expect(t.changed(seq, "Sam", "salam")).toBe(false);
    // A tail revision of an EARLIER block — the case the last-block model lost.
    expect(t.changed(seq, "Sam", "salam chetori")).toBe(true);
    // The speaker name rendering late counts as a change too.
    expect(t.changed(seq, null, "salam chetori")).toBe(true);
  });

  it("starts numbering fresh for a new session", () => {
    const t = new CaptionBlockTracker();
    t.seqFor(el());
    t.seqFor(el());

    t.reset();

    expect(t.seqFor(el())).toBe(1);
  });

  it("continues a resumed session's numbering above its stored rows", () => {
    const t = new CaptionBlockTracker();
    // The server holds rows 1..4 from before the rejoin.
    t.seed(5);

    expect(t.seqFor(el())).toBe(5);
    // A seed can only move numbering forward, never back over stored rows.
    t.seed(2);
    expect(t.seqFor(el())).toBe(6);
  });
});
