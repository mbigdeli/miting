import { Sparkles } from 'lucide-react';
import { RiClaudeFill, RiOpenaiFill } from 'react-icons/ri';
import { SiNvidia } from 'react-icons/si';
import type { MarkKind } from './options';

/** Brand marks match the engine tiles in Settings. */
const MARKS: Record<MarkKind, React.ReactNode> = {
  nvidia: <SiNvidia size={16} className="text-[#76B900]" />,
  openai: <RiOpenaiFill size={16} className="text-zinc-900" />,
  shenava: <span className="font-vazir text-[17px] font-bold leading-none text-brand">ش</span>,
  claude: <RiClaudeFill size={16} className="text-[#D97757]" />,
  sparkles: <Sparkles className="h-[15px] w-[15px] text-brand" />,
};

export function OptionMark({ kind }: { kind: MarkKind }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-zinc-100"
    >
      {MARKS[kind]}
    </span>
  );
}
