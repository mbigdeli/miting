/**
 * Note bodies are HTML from a contentEditable box and are shown with
 * dangerouslySetInnerHTML, so only plain formatting tags survive, with no
 * attributes at all. Everything else is reduced to its text.
 */
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'ul', 'ol', 'li', 'div', 'p']);

export function sanitizeNoteHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(\/?)\s*([a-z0-9]+)[^>]*>/gi, (_m, slash: string, tag: string) => {
      const t = tag.toLowerCase();
      return ALLOWED.has(t) ? `<${slash}${t}>` : '';
    });
}

/** Text of a note body, for emptiness checks and previews. */
export function noteText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An Ask AI answer (short Markdown) as note HTML: bold, italics, bullets. */
export function answerToNoteHtml(question: string, answerMd: string): string {
  const inline = (s: string) =>
    escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, '$1<i>$2</i>');
  const out: string[] = [`<b>${escapeHtml(question.trim())}</b>`];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of answerMd.split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) list.push(inline(bullet[1]));
    else {
      flush();
      if (line) out.push(`<div>${inline(line)}</div>`);
    }
  }
  flush();
  return out.join('');
}
