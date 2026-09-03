import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

interface StatusOverlaysProps {
  // Status flags
  isProcessing: boolean;      // Processing transcription after recording stops
  isSaving: boolean;          // Saving transcript to database

  // Layout
  sidebarCollapsed: boolean;  // For responsive margin calculation
}

// Internal reusable component for individual status overlays
interface StatusOverlayProps {
  show: boolean;
  message: string;
  progress?: number;
  sidebarCollapsed: boolean;
}

interface EnhancementProgress {
  meeting_id: string;
  stage: string;
  progress_percentage: number;
  message: string;
}

const TERMINAL_STAGES = new Set(['completed', 'skipped', 'error']);

function StatusOverlay({ show, message, progress, sidebarCollapsed }: StatusOverlayProps) {
  if (!show) return null;
  const pct = progress === undefined ? null : Math.min(Math.max(progress, 0), 100);

  return (
    <div className="fixed bottom-4 left-0 right-0 z-10">
      <div
        className="flex justify-center pl-8 transition-[margin] duration-300"
        style={{
          marginLeft: sidebarCollapsed ? '4rem' : '16rem'
        }}
      >
        <div className="w-2/3 max-w-[750px] flex justify-center">
          <div className="bg-white rounded-lg shadow-lg px-4 py-3 min-w-[280px]">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              <span className="text-sm text-gray-700">{message}</span>
              {pct !== null && <span className="text-xs text-gray-500">{Math.round(pct)}%</span>}
            </div>
            {pct !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main exported component - renders multiple status overlays
export function StatusOverlays({
  isProcessing,
  isSaving,
  sidebarCollapsed
}: StatusOverlaysProps) {
  // Enhancement runs in the background after the save returns: the card
  // follows the event stream and lingers briefly on the terminal stage.
  const [enhancementProgress, setEnhancementProgress] = useState<EnhancementProgress | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    listen<EnhancementProgress>('transcript-enhancement-progress', (event) => {
      if (clearTimer) clearTimeout(clearTimer);
      setEnhancementProgress(event.payload);
      if (TERMINAL_STAGES.has(event.payload.stage)) {
        clearTimer = setTimeout(() => setEnhancementProgress(null), 2500);
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch((error) => {
      console.warn('Failed to listen for transcript enhancement progress:', error);
    });
    return () => {
      unlisten?.();
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, []);

  return (
    <>
      {/* Processing status overlay - shown after recording stops while finalizing transcription */}
      <StatusOverlay
        show={isProcessing}
        message="Finalizing transcription..."
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Saving status overlay - the save itself is quick now */}
      <StatusOverlay
        show={isSaving}
        message="Saving transcript..."
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Background transcript-enhancement progress */}
      <StatusOverlay
        show={enhancementProgress !== null}
        message={enhancementProgress?.message ?? ''}
        progress={enhancementProgress?.progress_percentage}
        sidebarCollapsed={sidebarCollapsed}
      />
    </>
  );
}
