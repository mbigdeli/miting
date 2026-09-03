import { beforeEach, describe, expect, it } from "vitest";
import { findLeaveCallButton, resolveInjectionTarget } from "./toolbar-injector.js";

/**
 * Meet ships more than one control-bar layout, and the capture button has to
 * land in both. The 2026 redesign wraps every control in its own group, which
 * broke an injector that identified the row by counting its children.
 */

/** The layout Meet used before 2026: controls sit directly in one wide row. */
function legacyToolbar(): void {
  document.body.innerHTML = `
    <div id="row">
      <span data-is-tooltip-wrapper="true"><button data-is-muted="false">mic</button></span>
      <button><i class="google-symbols">videocam</i></button>
      <button><i class="google-symbols">present_to_all</i></button>
      <button><i class="google-symbols">chat</i></button>
      <button><i class="google-symbols">call_end</i></button>
    </div>`;
}

/** The 2026 layout: each control nested in its own wrapper, so the mic's
 *  grandparent holds two children where it used to hold eight. */
function redesignedToolbar(): void {
  document.body.innerHTML = `
    <div id="bar">
      <div><div><div><span data-is-tooltip-wrapper="true">
        <button data-is-muted="false">mic</button>
      </span></div></div></div>
      <div><button><i class="google-symbols">videocam</i></button></div>
      <div><button><i class="google-symbols">call_end</i></button></div>
    </div>`;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("resolveInjectionTarget", () => {
  it("finds the control row in the legacy layout", () => {
    legacyToolbar();
    const target = resolveInjectionTarget(document);

    expect(target).not.toBeNull();
    expect(target!.row.id).toBe("row");
  });

  it("finds it in the redesigned layout, where child counts no longer say where it is", () => {
    redesignedToolbar();
    const target = resolveInjectionTarget(document);

    expect(target).not.toBeNull();
    // The row is whichever ancestor holds both the mic and the hangup button.
    expect(target!.row.id).toBe("bar");
    expect(target!.row.contains(findLeaveCallButton(document))).toBe(true);
    // Inserting before the mic's own group keeps the button beside the mic.
    expect(target!.before.contains(document.querySelector("button[data-is-muted]"))).toBe(true);
  });

  it("resolves nothing while the toolbar is absent", () => {
    document.body.innerHTML = `<div><button>unrelated</button></div>`;
    expect(resolveInjectionTarget(document)).toBeNull();
  });
});

describe("findLeaveCallButton", () => {
  it("is the signal that the user is still in the call", () => {
    redesignedToolbar();
    expect(findLeaveCallButton(document)).not.toBeNull();
  });

  it("is absent once the call is over, which is what a real teardown looks like", () => {
    document.body.innerHTML = `<div><button>Rejoin</button></div>`;
    expect(findLeaveCallButton(document)).toBeNull();
  });
});
