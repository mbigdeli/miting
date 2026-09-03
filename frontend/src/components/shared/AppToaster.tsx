'use client';

/**
 * App-wide toast surface, restyled onto the redesign's zinc/teal tokens.
 *
 * `unstyled` drops sonner's own skin (its visual rules are all guarded by
 * `[data-styled='true']`) while keeping its positioning, stacking and swipe
 * behaviour, so every toast in the app inherits the card look below without
 * touching the ~40 `toast.*` call sites.
 */

import { Toaster } from 'sonner';

// `pr-10` reserves the lane the absolutely-positioned close button sits in.
const TOAST =
  'group relative flex w-full items-start gap-2.5 rounded-[10px] border border-zinc-200 bg-white p-4 pr-10 ' +
  'font-inter text-[13px] text-zinc-900 shadow-[0_10px_30px_-12px_rgba(24,24,27,.25)]';

const BUTTON =
  'shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors';

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      closeButton
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: TOAST,
          content: 'flex min-w-0 flex-1 flex-col gap-0.5',
          title: 'text-[13.5px] font-semibold leading-snug text-zinc-900',
          description: 'text-xs leading-snug !text-zinc-500',
          icon: 'mt-px flex size-4 shrink-0 items-center justify-center',
          actionButton: `${BUTTON} bg-brand text-white hover:bg-teal-700`,
          cancelButton: `${BUTTON} border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50`,
          // sonner only positions this from its own skin, which `unstyled` drops.
          closeButton:
            'absolute right-3 top-3.5 grid size-5 place-items-center rounded-full border ' +
            'border-zinc-200 bg-white text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700',
          // Type accents stay on the border + icon so the card itself never
          // turns into a solid colour block. `!` beats the base border colour:
          // Tailwind orders utilities by its own rules, not class-attr order.
          success: '[&_[data-icon]]:text-brand !border-brand/30',
          error: '[&_[data-icon]]:text-red-600 !border-red-200',
          warning: '[&_[data-icon]]:text-amber-500 !border-amber-200',
          info: '[&_[data-icon]]:text-zinc-400',
          loading: '[&_[data-icon]]:text-zinc-400',
        },
      }}
    />
  );
}
