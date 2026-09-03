'use client';

/**
 * Shown when a recording starts without a usable microphone.
 *
 * The call is still being captured — a Google Meet session keeps its captions
 * — so this is not a failure to announce and walk away from. It is a thing the
 * user can fix in one click, and sending them to Settings to hunt for the
 * device list made a two-second fix feel like a bug report. The picker is
 * here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { AlertTriangle, Mic, X } from 'lucide-react';
import type { AudioDevice } from '@/components/settings/devices/deviceTypes';
import type { RecordingPreferences } from '@/components/settings/recordingPreferences';

export function MicrophoneErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pending = listen<string>('recording-error', (event) => {
      setMessage(event.payload);
      invoke<AudioDevice[]>('list_audio_devices')
        .then((all) => setDevices(all.filter((d) => d.device_type === 'Input')))
        .catch(() => setDevices([]));
    });
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);

  const choose = useCallback(async (name: string) => {
    setSaving(true);
    try {
      // Read-modify-write: the microphone is one field of the recording
      // preferences, and sending a fresh object would blank the save folder
      // and format the user already chose.
      const prefs = await invoke<RecordingPreferences>('get_recording_preferences');
      await invoke('set_recording_preferences', {
        preferences: { ...prefs, preferred_mic_device: name },
      });
      toast.success(`Microphone set to ${name}`, {
        description: 'Start the recording again to capture audio.',
      });
      setMessage(null);
    } catch (error) {
      toast.error('Could not save the microphone', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  if (!message) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200 bg-amber-50 px-5 py-3.5">
      <div className="mx-auto flex max-w-[900px] items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-amber-900">{message}</p>

          {devices.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-amber-700" />
              {devices.map((device) => (
                <button
                  key={device.name}
                  type="button"
                  disabled={saving}
                  onClick={() => choose(device.name)}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {device.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-amber-700">
              No microphones are visible to Miting. Connect one, or check the
              system privacy settings that let apps use it.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setMessage(null)}
          className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
