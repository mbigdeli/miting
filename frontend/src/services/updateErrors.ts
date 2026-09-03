/**
 * Human-readable messages for Tauri updater failures.
 *
 * `plugin:updater|check` rejects with the Rust `Display` string, not an Error
 * object, so `error.message` is `undefined` at the call site — that is what
 * produced the bare "Unknown error" toast. Map the known variants here instead.
 */

/** Machine-readable cause, useful for logging and tests. */
export type UpdateErrorKind =
  | 'not-configured'
  | 'unreachable'
  | 'offline'
  | 'no-build-for-platform'
  | 'bad-signature'
  | 'in-progress'
  | 'unknown';

export interface UpdateErrorInfo {
  kind: UpdateErrorKind;
  message: string;
  /** Original text, kept for the console. */
  raw: string;
}

const MESSAGES: Record<UpdateErrorKind, string> = {
  'not-configured': 'This build has no update channel configured.',
  unreachable: 'Update server is unreachable right now. Try again later.',
  offline: 'No internet connection — connect and try again.',
  'no-build-for-platform': 'No update is published for your platform yet.',
  'bad-signature': 'The update failed its signature check and was not installed.',
  'in-progress': 'An update check is already running.',
  unknown: '',
};

const PATTERNS: ReadonlyArray<[UpdateErrorKind, RegExp]> = [
  ['in-progress', /already in progress/i],
  ['not-configured', /does not have any endpoints|must use a secure protocol/i],
  [
    'offline',
    /error sending request|dns error|failed to lookup|connection (refused|reset)|timed out|network is unreachable|error trying to connect/i,
  ],
  [
    'unreachable',
    /did not respond with a successful status code|could not fetch a valid release json|status: 4\d\d|status: 5\d\d/i,
  ],
  ['no-build-for-platform', /was not found in the response `platforms`|fallback platforms/i],
  ['bad-signature', /signature|minisign/i],
];

/**
 * Kinds that mean "the update channel had nothing to say", not "the app is
 * broken". A manual check treats these as up-to-date rather than alarming the
 * user — the release may simply not be published yet.
 */
const BENIGN: ReadonlySet<UpdateErrorKind> = new Set([
  'unreachable',
  'offline',
  'no-build-for-platform',
]);

export const isBenignUpdateError = (kind: UpdateErrorKind): boolean => BENIGN.has(kind);

/** Extract the raw text from whatever the updater rejected with. */
export function rawUpdateError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? '');
}

/** Classify an updater rejection and produce a user-facing message. */
export function describeUpdateError(error: unknown): UpdateErrorInfo {
  const raw = rawUpdateError(error).trim();

  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(raw)) return { kind, message: MESSAGES[kind], raw };
  }

  // Never fall back to "Unknown error": the raw text beats no information.
  return {
    kind: 'unknown',
    message: raw ? `Update check failed: ${raw}` : 'Update check failed for an unknown reason.',
    raw,
  };
}

/** Error carrying the classified `kind` so callers can branch without regex. */
export class UpdateCheckError extends Error {
  readonly kind: UpdateErrorKind;
  readonly raw: string;

  constructor(info: UpdateErrorInfo) {
    super(info.message);
    this.name = 'UpdateCheckError';
    this.kind = info.kind;
    this.raw = info.raw;
  }
}

/** Normalise any rejection into an `UpdateCheckError` (idempotent). */
export function toUpdateCheckError(error: unknown): UpdateCheckError {
  if (error instanceof UpdateCheckError) return error;
  return new UpdateCheckError(describeUpdateError(error));
}
