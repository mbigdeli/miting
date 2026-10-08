/** User-facing text for why translation cannot run or stopped. */

export interface AiProblem {
  title: string;
  body: string;
  /** True when the fix is in Settings > AI notes. */
  needsSettings: boolean;
}

export function aiProblem(reason: string | null | undefined): AiProblem {
  switch (reason) {
    case 'no_ai_configured':
      return { title: 'No AI connected', body: 'Translation uses the AI you set up for notes.', needsSettings: true };
    case 'missing_api_key':
      return { title: 'Your AI needs its key', body: 'Add the API key for your AI in Settings.', needsSettings: true };
    case 'claude_code_not_installed':
      return { title: 'Claude Code is not installed', body: 'Install it, or pick another AI for notes.', needsSettings: true };
    case 'claude_code_not_logged_in':
      return { title: 'Claude Code is signed out', body: 'Sign in again from Settings.', needsSettings: true };
    default:
      return {
        title: 'Translation stopped',
        body: reason ? reason.slice(0, 160) : 'Something went wrong. Try again.',
        needsSettings: false,
      };
  }
}
