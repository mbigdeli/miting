import { afterEach, describe, expect, it, vi } from "vitest";
import { extractMeetingCode } from "../../shared/meetUtils.js";
import { extensionContextAlive, meetChangedInPlace, mirrorFalseIsStale } from "./coordinator.js";

/**
 * Full URL guard matrices live in `src/shared/meetUtils.test.ts`.
 * This file keeps a direct contract check next to `MeetCaptureCoordinator` / `beginCapture`.
 */
describe("MeetCaptureCoordinator / beginCapture URL gate", () => {
  it("uses shared extractMeetingCode: null blocks session start", () => {
    expect(extractMeetingCode("https://meet.google.com/new")).toBeNull();
  });

  it("uses shared extractMeetingCode: non-null allows room detection", () => {
    expect(extractMeetingCode("https://meet.google.com/abc-defg-hij")).toBe("abc-defg-hij");
  });
});

/**
 * Reloading an unpacked extension orphans the content scripts already running
 * in open tabs. They keep going, but every message to the extension throws, and
 * the failure read as "Miting could not start recording this meeting" — which
 * sent people checking the app, the pairing and the microphone when the fix was
 * to reload the tab.
 */
describe("extensionContextAlive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true while the extension is still there", () => {
    vi.stubGlobal("chrome", { runtime: { id: "abggedoehnlmbcapbfdikhhnkcckhfck" } });

    expect(extensionContextAlive()).toBe(true);
  });

  it("is false once the extension has been reloaded out from under the tab", () => {
    // Chrome drops `id` on an orphaned context; nothing else announces it.
    vi.stubGlobal("chrome", { runtime: {} });

    expect(extensionContextAlive()).toBe(false);
  });
});

/**
 * A state poll can be computed before session_start lands and applied after.
 * Acting on that one stale "not capturing" answer tore the capture down and
 * restarted it within the same second — two sessions for one meeting.
 */
describe("mirrorFalseIsStale", () => {
  it("distrusts a not-capturing mirror right after our own start", () => {
    expect(mirrorFalseIsStale(10_000, 12_000)).toBe(true);
  });

  it("believes it once the start is old enough to have been seen", () => {
    expect(mirrorFalseIsStale(10_000, 30_000)).toBe(false);
  });
});

/**
 * Meet swaps meetings inside one tab without a pagehide or a new content
 * script. Missing that kept the old session id alive and filed the new
 * meeting's captions under the previous meeting.
 */
describe("meetChangedInPlace", () => {
  it("rotates when the tab now shows a different meeting", () => {
    expect(meetChangedInPlace(true, "abc-defg-hij", "zzz-yyyy-xxx")).toBe(true);
  });

  it("stays put while the meeting is unchanged, idle, or unknown", () => {
    expect(meetChangedInPlace(true, "abc-defg-hij", "abc-defg-hij")).toBe(false);
    expect(meetChangedInPlace(false, "abc-defg-hij", "zzz-yyyy-xxx")).toBe(false);
    expect(meetChangedInPlace(true, null, "zzz-yyyy-xxx")).toBe(false);
  });
});
