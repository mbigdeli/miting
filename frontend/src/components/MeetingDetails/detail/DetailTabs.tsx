'use client';

export type DetailTabId = 'overview' | 'transcript' | 'details';

const TABS: Array<{ id: DetailTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'details', label: 'Details' },
];

/** Overview / Transcript / Details tab bar (mockups 2h/2i/2w; Action plan is out of scope). */
export default function DetailTabs({
  active,
  onSelect,
}: {
  active: DetailTabId;
  onSelect: (tab: DetailTabId) => void;
}) {
  return (
    <div className="mt-[18px] flex border-b border-zinc-200" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onSelect(tab.id)}
          className={
            active === tab.id
              ? '-mb-px mr-5 border-b-2 border-zinc-900 px-0.5 py-2.5 text-[13.5px] font-semibold text-zinc-900'
              : 'mr-5 px-0.5 py-2.5 text-[13.5px] font-medium text-zinc-500 transition-colors hover:text-zinc-900'
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
