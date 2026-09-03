import { describe, expect, test } from 'vitest';
import { cliConnectionView, type CliStatusLike } from '../../src/lib/cliProviderStatus';

const status = (over: Partial<CliStatusLike> = {}): CliStatusLike => ({
  connected: true,
  cli_installed: true,
  ...over,
});

describe('cliConnectionView', () => {
  test('no status yet reads as checking', () => {
    expect(cliConnectionView(null)).toEqual({ state: 'checking', text: 'Checking…' });
  });

  test('missing CLI keeps the backend detail', () => {
    const view = cliConnectionView(status({ cli_installed: false, detail: 'codex not on PATH' }));
    expect(view).toEqual({ state: 'missing', text: 'codex not on PATH' });
  });

  test('missing CLI falls back to its own wording', () => {
    expect(cliConnectionView(status({ cli_installed: false })).text).toBe(
      'CLI not found on this machine.',
    );
  });

  test('installed but signed out', () => {
    expect(cliConnectionView(status({ connected: false })).state).toBe('signed-out');
  });

  test('connected shows account and version on one line', () => {
    const view = cliConnectionView(
      status({ user_email: 'a@b.com', cli_version: 'codex-cli 0.145.0' }),
    );
    expect(view).toEqual({ state: 'connected', text: 'Connected as a@b.com · codex-cli 0.145.0' });
  });

  test('connected without extras stays short', () => {
    expect(cliConnectionView(status())).toEqual({ state: 'connected', text: 'Connected' });
  });

  test('Claude falls back to subscription type when there is no version', () => {
    expect(cliConnectionView(status({ subscription_type: 'Max' })).text).toBe('Connected · Max');
  });
});
