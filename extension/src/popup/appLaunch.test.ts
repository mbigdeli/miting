import { describe, expect, it, vi } from "vitest";
import { ensureDesktopAppRunning, serviceIsConnected, type LaunchDeps } from "./appLaunch.js";
import type { SessionState } from "../shared/types.js";

function session(status: SessionState["localServiceStatus"]): SessionState {
  return { localServiceStatus: status } as SessionState;
}

function deps(overrides: Partial<LaunchDeps> = {}): LaunchDeps {
  return {
    fetchSession: async () => session("unavailable"),
    requestLaunch: async () => ({ ok: true }),
    setLabel: () => undefined,
    onConnected: () => undefined,
    sleep: async () => undefined,
    ...overrides,
  };
}

describe("serviceIsConnected", () => {
  it("treats connected and tray_starting as up", () => {
    expect(serviceIsConnected(session("connected"))).toBe(true);
    expect(serviceIsConnected(session("tray_starting"))).toBe(true);
  });

  it("treats every failure status as down", () => {
    for (const s of ["unavailable", "timeout", "error", "unhealthy", "tray_stopped"] as const) {
      expect(serviceIsConnected(session(s))).toBe(false);
    }
  });
});

describe("ensureDesktopAppRunning", () => {
  it("does not launch when the app is already up", async () => {
    const requestLaunch = vi.fn(async () => ({ ok: true }));
    await ensureDesktopAppRunning(
      deps({ fetchSession: async () => session("connected"), requestLaunch }),
    );
    expect(requestLaunch).not.toHaveBeenCalled();
  });

  it("launches and resolves once health reports connected", async () => {
    const requestLaunch = vi.fn(async () => ({ ok: true }));
    const onConnected = vi.fn();
    let calls = 0;
    const fetchSession = async () => {
      calls += 1;
      return calls > 2 ? session("connected") : session("unavailable");
    };

    await ensureDesktopAppRunning(deps({ fetchSession, requestLaunch, onConnected }));

    expect(requestLaunch).toHaveBeenCalledOnce();
    expect(onConnected).toHaveBeenCalledWith(session("connected"));
  });

  it("surfaces the host error when the launch itself fails", async () => {
    await expect(
      ensureDesktopAppRunning(
        deps({ requestLaunch: async () => ({ ok: false, error: "app binary not found" }) }),
      ),
    ).rejects.toThrow("Could not start Miting: app binary not found");
  });

  it("times out when the app never becomes reachable", async () => {
    await expect(ensureDesktopAppRunning(deps())).rejects.toThrow("still starting");
  });
});
