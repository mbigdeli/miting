import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIC_GRANTED_KEY,
  PERMISSION_PAGE,
  grantMicrophone,
  isMicrophoneGranted,
  openPermissionPage,
} from "./grantMicrophone.js";

// The stored flag is what the background worker reads before mixing the local
// mic into a capture, so both branches must write it — a stale `true` records
// silence, a stale `false` silently drops the user's own voice.

let store: Record<string, unknown>;

function stubChrome(): void {
  store = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(store, values);
        }),
      },
    },
    runtime: { getURL: (path: string) => `chrome-extension://abc/${path}` },
    tabs: { create: vi.fn(async () => undefined) },
  };
}

function stubNavigator(over: Record<string, unknown>): void {
  // `navigator` is a getter-only global in the node environment.
  Object.defineProperty(globalThis, "navigator", {
    value: over,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  stubChrome();
});

describe("grantMicrophone", () => {
  it("stops the probe tracks and remembers the grant", async () => {
    const stop = vi.fn();
    stubNavigator({
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    });

    await expect(grantMicrophone()).resolves.toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(store[MIC_GRANTED_KEY]).toBe(true);
  });

  it("records a refusal instead of leaving the flag stale", async () => {
    store[MIC_GRANTED_KEY] = true;
    stubNavigator({
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new Error("NotAllowedError");
        }),
      },
    });

    await expect(grantMicrophone()).resolves.toBe(false);
    expect(store[MIC_GRANTED_KEY]).toBe(false);
  });
});

describe("isMicrophoneGranted", () => {
  it("prefers the live Permissions API and syncs the flag", async () => {
    stubNavigator({ permissions: { query: vi.fn(async () => ({ state: "granted" })) } });

    await expect(isMicrophoneGranted()).resolves.toBe(true);
    expect(store[MIC_GRANTED_KEY]).toBe(true);
  });

  it("reports a prompt state as not granted", async () => {
    store[MIC_GRANTED_KEY] = true;
    stubNavigator({ permissions: { query: vi.fn(async () => ({ state: "prompt" })) } });

    await expect(isMicrophoneGranted()).resolves.toBe(false);
    expect(store[MIC_GRANTED_KEY]).toBe(false);
  });

  it("falls back to the stored flag where the API is unavailable", async () => {
    store[MIC_GRANTED_KEY] = true;
    stubNavigator({
      permissions: {
        query: vi.fn(async () => {
          throw new Error("unsupported");
        }),
      },
    });

    await expect(isMicrophoneGranted()).resolves.toBe(true);
  });
});

describe("openPermissionPage", () => {
  it("opens the only remaining extension page, not the deleted options page", () => {
    openPermissionPage();
    expect((globalThis as any).chrome.tabs.create).toHaveBeenCalledWith({
      url: `chrome-extension://abc/${PERMISSION_PAGE}`,
    });
    expect(PERMISSION_PAGE).toBe("permission.html");
  });
});
