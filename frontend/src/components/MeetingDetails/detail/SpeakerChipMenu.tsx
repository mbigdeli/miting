'use client';

interface Props {
  name: string;
  chipClass: string;
  others: string[];
  onMove?: (to: string) => void;
}

/**
 * A speaker chip in the transcript. When other speakers exist it doubles as a
 * picker: "this block was actually said by…" moves the lines to that speaker.
 */
export default function SpeakerChipMenu({ name, chipClass, others, onMove }: Props) {
  const chip = `rounded-full px-2 py-0.5 text-[12.5px] font-semibold ${chipClass}`;
  if (!onMove || others.length === 0) {
    return <span className={chip}>{name}</span>;
  }
  return (
    <label className={`relative cursor-pointer ${chip} hover:ring-1 hover:ring-zinc-300`} title="Said by someone else? Pick who">
      {name}
      <select
        aria-label={`Move these lines from ${name} to another speaker`}
        value=""
        onChange={(e) => e.target.value && onMove(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Said by…
        </option>
        {others.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
