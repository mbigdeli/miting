import { beforeEach, describe, expect, test, vi, afterEach } from 'vitest';
import {
  clearPendingStartRequest,
  REQUEST_TTL_MS,
  startRecordingFromAnywhere,
  takePendingStartRequest,
} from '../../src/lib/startRecordingFromAnywhere';

/**
 * A record command from Chrome used to be a fire-and-forget event sent 250ms
 * after navigating. When the record screen had not mounted its listener yet the
 * request vanished — while the user was already being told recording had begun.
 */

const store = new Map<string, string>();
const dispatched: string[] = [];

beforeEach(() => {
  store.clear();
  dispatched.length = 0;
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', {
    dispatchEvent: (e: Event) => void dispatched.push(e.type),
    setTimeout: (fn: () => void) => void fn(),
  });
  vi.stubGlobal('CustomEvent', class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('startRecordingFromAnywhere', () => {
  test('a request from another screen survives until the recorder mounts', () => {
    const navigate = vi.fn();
    startRecordingFromAnywhere(navigate, '/meetings', 1_000);
    expect(navigate).toHaveBeenCalledWith('/');
    // The screen mounts later and still finds the request.
    expect(takePendingStartRequest(1_500)).toBe(true);
  });

  test('a request is served once, not replayed by the next mount', () => {
    startRecordingFromAnywhere(vi.fn(), '/', 1_000);
    expect(takePendingStartRequest(1_100)).toBe(true);
    expect(takePendingStartRequest(1_200)).toBe(false);
  });

  test('already on the record screen still nudges the live listener', () => {
    const navigate = vi.fn();
    startRecordingFromAnywhere(navigate, '/', 1_000);
    expect(navigate).not.toHaveBeenCalled();
    expect(dispatched).toContain('start-recording-from-sidebar');
  });

  test('a stale request does not start a recording minutes later', () => {
    startRecordingFromAnywhere(vi.fn(), '/meetings', 1_000);
    expect(takePendingStartRequest(1_000 + REQUEST_TTL_MS + 1)).toBe(false);
  });

  test('nothing pending means nothing to start', () => {
    expect(takePendingStartRequest(1_000)).toBe(false);
  });

  test('a refused request can be dropped without acting on it', () => {
    startRecordingFromAnywhere(vi.fn(), '/meetings', 1_000);
    clearPendingStartRequest();
    expect(takePendingStartRequest(1_100)).toBe(false);
  });
});
