import { describe, expect, it } from "vitest";
import { decideCapture, type AppStateLite } from "./capture-decision.js";

const A = "aaa-aaaa-aaa";
const B = "bbb-bbbb-bbb";

function st(over: Partial<AppStateLite>): AppStateLite {
  return { phase: "idle", companion_should_capture: false, meeting_code: null, ...over };
}

function base() {
  return {
    running: false,
    starting: false,
    myCode: A,
    autoStart: true,
    refusedAutoStart: false,
    startedJustNow: false,
  };
}

describe("decideCapture — the two-tab war is over", () => {
  it("tab B never tears down while the app records tab A", () => {
    // The old global flag turned this exact answer into A's death sentence.
    const d = decideCapture({
      ...base(),
      myCode: B,
      state: st({ phase: "recording", companion_should_capture: false, meeting_code: A }),
    });
    expect(d).toBe("none");
  });

  it("tab B does not even ask while the app records A (no toast spam)", () => {
    const d = decideCapture({
      ...base(),
      myCode: B,
      state: st({ phase: "recording", companion_should_capture: false, meeting_code: A }),
    });
    expect(d).toBe("none");
  });

  it("the recording tab keeps recording when the answer is its own code", () => {
    const d = decideCapture({
      ...base(),
      running: true,
      state: st({ phase: "recording", companion_should_capture: true, meeting_code: A }),
    });
    expect(d).toBe("none");
  });

  it("auto-starts into an idle app", () => {
    expect(decideCapture({ ...base(), state: st({ phase: "idle" }) })).toBe("begin");
  });

  it("auto-starts into its own grace window (rejoin)", () => {
    const d = decideCapture({
      ...base(),
      state: st({ phase: "grace", meeting_code: A }),
    });
    expect(d).toBe("begin");
  });

  it("auto-starts into another meeting's grace window (recorder is free)", () => {
    const d = decideCapture({
      ...base(),
      myCode: B,
      state: st({ phase: "grace", meeting_code: A }),
    });
    expect(d).toBe("begin");
  });

  it("opening B while A sits paused asks — the server hands over", () => {
    const d = decideCapture({
      ...base(),
      myCode: B,
      state: st({ phase: "paused", meeting_code: A }),
    });
    expect(d).toBe("begin");
  });

  it("never auto-resumes the user's own pause", () => {
    const d = decideCapture({
      ...base(),
      state: st({ phase: "paused", meeting_code: A }),
    });
    expect(d).toBe("none");
  });

  it("re-attaches when the app records my code but I am not capturing", () => {
    const d = decideCapture({
      ...base(),
      state: st({ phase: "recording", companion_should_capture: true, meeting_code: A }),
    });
    expect(d).toBe("begin");
  });

  it("a pause from the app tears down quietly", () => {
    const d = decideCapture({
      ...base(),
      running: true,
      state: st({ phase: "paused", companion_should_capture: false, meeting_code: A }),
    });
    expect(d).toBe("teardown_paused");
  });

  it("a stop from the app ends the session", () => {
    const d = decideCapture({
      ...base(),
      running: true,
      state: st({ phase: "idle" }),
    });
    expect(d).toBe("teardown_stop");
  });

  it("a stale mirror right after our own start is ignored", () => {
    const d = decideCapture({
      ...base(),
      running: true,
      startedJustNow: true,
      state: st({ phase: "idle" }),
    });
    expect(d).toBe("none");
  });

  it("a refused auto-start does not retry until the user clicks", () => {
    const d = decideCapture({
      ...base(),
      refusedAutoStart: true,
      state: st({ phase: "idle" }),
    });
    expect(d).toBe("none");
  });

  it("does nothing while a start is in flight", () => {
    expect(decideCapture({ ...base(), starting: true, state: st({ phase: "idle" }) })).toBe("none");
  });

  it("auto-start off means no spontaneous capture", () => {
    expect(decideCapture({ ...base(), autoStart: false, state: st({ phase: "idle" }) })).toBe(
      "none",
    );
  });
});
