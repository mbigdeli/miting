/**
 * An in-page notice on the Meet tab.
 *
 * Miting refuses to record a second meeting while it is busy, and that refusal
 * was only ever shown as a toast inside the app — on the other side of the
 * screen from the button the user had just pressed. The message belongs where
 * the click happened.
 */

const NOTICE_ID = "mcs-meet-notice";
const VISIBLE_MS = 9000;

export type NoticeKind = "blocked" | "error" | "info";

const ACCENT: Record<NoticeKind, string> = {
  blocked: "#f59e0b",
  error: "#ef4444",
  info: "#0f9d8f",
};

/** Show `message` over the Meet page, replacing any notice already up. */
export function showMeetNotice(message: string, kind: NoticeKind = "info"): void {
  document.getElementById(NOTICE_ID)?.remove();

  const notice = document.createElement("div");
  notice.id = NOTICE_ID;
  notice.setAttribute("role", "status");
  // Inline styles: Meet's own CSS is hostile to injected class names, and a
  // stylesheet would be one more thing to keep in sync.
  Object.assign(notice.style, {
    position: "fixed",
    top: "76px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    maxWidth: "420px",
    padding: "12px 16px",
    borderRadius: "12px",
    borderLeft: `4px solid ${ACCENT[kind]}`,
    background: "#111418",
    color: "#f4f5f7",
    font: "500 13.5px/1.45 'Google Sans', Roboto, system-ui, sans-serif",
    boxShadow: "0 8px 28px rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  } satisfies Partial<CSSStyleDeclaration>);

  const text = document.createElement("span");
  text.textContent = message;
  text.style.flex = "1";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Dismiss");
  Object.assign(close.style, {
    background: "transparent",
    border: "0",
    color: "#9aa0a6",
    cursor: "pointer",
    fontSize: "13px",
    lineHeight: "1",
    padding: "2px",
  } satisfies Partial<CSSStyleDeclaration>);
  close.addEventListener("click", () => notice.remove());

  notice.append(text, close);
  document.body.appendChild(notice);

  window.setTimeout(() => notice.remove(), VISIBLE_MS);
}
