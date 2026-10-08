'use client';

import { useRouter } from 'next/navigation';
import { aiProblem } from '@/lib/translation/aiProblem';

/** Why translation cannot run, with a way to fix it in Settings. */
export function ConnectAiNotice({ reason, onNavigate }: { reason: string | null; onNavigate?: () => void }) {
  const router = useRouter();
  const problem = aiProblem(reason);
  return (
    <div>
      <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <p className="text-[13px] font-semibold text-amber-900">{problem.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-[18px] text-amber-800">{problem.body}</p>
      </div>
      {problem.needsSettings && (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            router.push('/settings?tab=summaryModels');
          }}
          className="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-zinc-900 text-[13px] font-medium text-white hover:bg-zinc-800"
        >
          {reason === 'no_ai_configured' ? 'Connect an AI' : 'Open AI settings'}
        </button>
      )}
    </div>
  );
}
