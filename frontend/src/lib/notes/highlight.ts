/** Splits a transcript line into plain and tinted parts for quoted text. */
export type HighlightKind = 'saved' | 'pending';

export interface Part {
  text: string;
  kind?: HighlightKind;
}

export function splitHighlights(text: string, quotes: { quote: string; kind: HighlightKind }[]): Part[] {
  const marks: { start: number; end: number; kind: HighlightKind }[] = [];
  for (const q of quotes) {
    const needle = q.quote.trim();
    if (!needle) continue;
    const start = text.indexOf(needle);
    if (start < 0) continue;
    const end = start + needle.length;
    // A pending selection wins over an older tint on the same words.
    const clash = marks.findIndex((m) => start < m.end && end > m.start);
    if (clash >= 0) {
      if (q.kind === 'pending') marks.splice(clash, 1);
      else continue;
    }
    marks.push({ start, end, kind: q.kind });
  }
  marks.sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.start < at) continue;
    if (m.start > at) parts.push({ text: text.slice(at, m.start) });
    parts.push({ text: text.slice(m.start, m.end), kind: m.kind });
    at = m.end;
  }
  if (at < text.length || parts.length === 0) parts.push({ text: text.slice(at) });
  return parts;
}

/** Friendly words for the error codes Ask AI can return. */
export function askErrorText(code: string): string {
  if (code.includes('no_ai_configured')) return 'No AI is connected. Pick one in Settings > Summary.';
  if (code.includes('missing_api_key')) return 'The AI you picked needs an API key. Add it in Settings > Summary.';
  if (code.includes('claude_code_not_installed')) return 'Claude Code is not installed on this computer.';
  if (code.includes('claude_code_not_logged_in')) return 'Claude Code is not signed in.';
  if (code.includes('empty_answer')) return 'The AI sent back an empty answer. Try asking again.';
  return 'The AI could not answer right now. Try again in a moment.';
}
