'use client';

/** Bold, italic, underline and bullets for the focused editable text. */
const BUTTONS: { cmd: string; label: string; title: string; className: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
  { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', className: 'italic' },
  { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
  { cmd: 'insertUnorderedList', label: '•', title: 'Bullets', className: '' },
];

export function FormatButtons() {
  return (
    <div className="flex gap-px">
      {BUTTONS.map((b) => (
        <button
          key={b.cmd}
          type="button"
          title={b.title}
          aria-label={b.title}
          // Keep focus (and the selection) in the text being edited.
          onMouseDown={(e) => {
            e.preventDefault();
            document.execCommand(b.cmd);
          }}
          className={`h-6 w-[26px] rounded-[5px] text-[13px] text-zinc-500 hover:bg-zinc-100 ${b.className}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
