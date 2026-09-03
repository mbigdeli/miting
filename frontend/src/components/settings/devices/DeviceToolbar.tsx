'use client';

/** Header row of the device picker: title, Test-mic toggle, refresh. */

import { RefreshCw } from 'lucide-react';

export function DeviceToolbar({
  disabled,
  canTest,
  isMonitoring,
  onToggleMonitoring,
  refreshing,
  onRefresh,
}: {
  disabled: boolean;
  canTest: boolean;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-[13.5px] font-semibold text-zinc-900">Audio devices</h4>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMonitoring}
          disabled={disabled || !canTest}
          className={`rounded-lg border px-[13px] py-[7px] text-[12.5px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${
            isMonitoring
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-zinc-200 text-zinc-900 hover:border-brand hover:text-brand'
          }`}
        >
          {isMonitoring ? 'Stop test' : 'Test mic'}
        </button>
        <button
          type="button"
          title="Refresh devices"
          onClick={onRefresh}
          disabled={refreshing || disabled}
          className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
