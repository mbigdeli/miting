import { beforeEach, describe, expect, it, vi } from "vitest";

// checkServiceHealth decides when the worker re-pairs. It used to re-pair on
// every one minute tick because health never carried the token; now it must
// re-pair only when the app actually rejects the token.

const ensureMock = vi.fn();
const healthMock = vi.fn();
vi.mock("../shared/autoPairing.js", () => ({
  ensureGmeetPairing: (...args: unknown[]) => ensureMock(...args),
}));
vi.mock("../shared/gmeetClient.js", () => ({
  checkGmeetHealth: () => healthMock(),
}));

import { checkServiceHealth } from "./serviceHealth.js";

const PAIRING = { baseUrl: "http://127.0.0.1:5167", token: "t" };
const forced = () => ensureMock.mock.calls.filter((c) => c[0] === true).length;

beforeEach(() => {
  ensureMock.mockReset().mockResolvedValue(PAIRING);
  healthMock.mockReset();
});

describe("checkServiceHealth", () => {
  it("does not re-pair when the app accepts the token", async () => {
    healthMock.mockResolvedValue({ ok: true, data: { authorized: true } });

    expect(await checkServiceHealth()).toBe("connected");
    expect(forced()).toBe(0);
    expect(healthMock).toHaveBeenCalledTimes(1);
  });

  it("re-pairs once and asks again when the token is rejected", async () => {
    healthMock
      .mockResolvedValueOnce({ ok: true, data: { authorized: false } })
      .mockResolvedValueOnce({ ok: true, data: { authorized: true } });

    expect(await checkServiceHealth()).toBe("connected");
    expect(forced()).toBe(1);
    expect(healthMock).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable without re-pairing when the app is not running", async () => {
    healthMock.mockResolvedValue({ ok: false, error: "fetch failed" });

    expect(await checkServiceHealth()).toBe("unavailable");
    expect(forced()).toBe(0);
  });
});
