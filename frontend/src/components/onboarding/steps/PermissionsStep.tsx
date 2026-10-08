import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OnboardingContainer } from '../OnboardingContainer';
import { onboardingStepCount } from '../shared/stepCount';
import { PermissionRow } from '../shared';
import { useOnboarding } from '@/contexts/OnboardingContext';

type PendingPermission = 'microphone' | 'systemAudio' | null;

export function PermissionsStep() {
  const { setPermissionStatus, setPermissionsSkipped, permissions, completeOnboarding } = useOnboarding();
  const [pendingPermission, setPendingPermission] = useState<PendingPermission>(null);

  // Check permissions - only logs current state, doesn't auto-authorize
  // Actual permission checks are done via explicit user actions (clicking Enable)
  const checkPermissions = useCallback(async () => {
    console.log('[PermissionsStep] Current permission states:');
    console.log(`  - Microphone: ${permissions.microphone}`);
    console.log(`  - System Audio: ${permissions.systemAudio}`);
    // Don't auto-set permissions based on device availability
    // Permissions should only be set after explicit user action via Enable button
  }, [permissions.microphone, permissions.systemAudio]);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Request microphone permission
  const handleMicrophoneAction = async () => {
    if (pendingPermission) return;

    if (permissions.microphone === 'denied') {
      // Try to open system settings
      try {
        await invoke('open_system_settings');
      } catch {
        alert('Please enable microphone access in System Preferences > Security & Privacy > Microphone');
      }
      return;
    }

    setPendingPermission('microphone');
    try {
      console.log('[PermissionsStep] Triggering microphone permission...');
      const granted = await invoke<boolean>('trigger_microphone_permission');
      console.log('[PermissionsStep] Microphone permission result:', granted);

      if (granted) {
        setPermissionStatus('microphone', 'authorized');
      } else {
        // Permission was denied or dialog was dismissed
        setPermissionStatus('microphone', 'denied');
      }
    } catch (err) {
      console.error('[PermissionsStep] Failed to request microphone permission:', err);
      setPermissionStatus('microphone', 'denied');
    } finally {
      setPendingPermission(null);
    }
  };

  // Request system audio permission
  const handleSystemAudioAction = async () => {
    if (pendingPermission) return;

    if (permissions.systemAudio === 'denied') {
      // Try to open system settings
      try {
        await invoke('open_system_settings');
      } catch {
        alert('Please enable Audio Capture in System Settings → Privacy & Security → Audio Capture');
      }
      return;
    }

    setPendingPermission('systemAudio');
    try {
      console.log('[PermissionsStep] Triggering Audio Capture permission...');
      // Backend creates Core Audio tap, captures audio, and verifies it's not silence
      // Returns true if permission granted and audio verified, false if denied (silence)
      const granted = await invoke<boolean>('trigger_system_audio_permission_command');
      console.log('[PermissionsStep] System audio permission result:', granted);

      if (granted) {
        setPermissionStatus('systemAudio', 'authorized');
        console.log('[PermissionsStep] Audio Capture permission verified - audio is not silence');
      } else {
        // Permission was denied (audio is silence)
        setPermissionStatus('systemAudio', 'denied');
        console.log('[PermissionsStep] Audio Capture permission denied - audio is silence');
      }
    } catch (err) {
      console.error('[PermissionsStep] Failed to request system audio permission:', err);
      setPermissionStatus('systemAudio', 'denied');
    } finally {
      setPendingPermission(null);
    }
  };

  const handleFinish = async () => {
    try {
      await completeOnboarding();
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const handleSkip = async () => {
    setPermissionsSkipped(true);
    await handleFinish();
  };

  const allPermissionsGranted =
    permissions.microphone === 'authorized' &&
    permissions.systemAudio === 'authorized';

  const footer = pendingPermission
    ? { text: 'Waiting for the permission dialog…', tone: 'text-zinc-400' }
    : permissions.microphone === 'denied'
    ? { text: 'Enable the microphone in System Settings, then return here.', tone: 'text-red-600' }
    : permissions.systemAudio === 'denied'
    ? { text: 'Enable Audio Capture in System Settings, then return here.', tone: 'text-red-600' }
    : allPermissionsGranted
    ? { text: 'Ready to record.', tone: 'text-green-600' }
    : permissions.microphone === 'authorized'
    ? { text: 'Enable system audio to continue.', tone: 'text-zinc-400' }
    : { text: 'Both permissions are required to record a miting.', tone: 'text-zinc-400' };

  return (
    <OnboardingContainer
      title="Grant permissions"
      description="Miting needs your microphone and system audio to record both sides of a miting."
      step={5}
      totalSteps={onboardingStepCount(true)}
    >
      <div className="mt-8 grid w-full max-w-[460px] gap-3">
        <PermissionRow
          icon={<Mic className="h-[17px] w-[17px]" />}
          title="Microphone"
          description="Captures your voice"
          pendingDescription="Requesting access…"
          status={permissions.microphone}
          isPending={pendingPermission === 'microphone'}
          onAction={handleMicrophoneAction}
        />

        <PermissionRow
          icon={<Volume2 className="h-[17px] w-[17px]" />}
          title="System audio"
          description="Captures the other participants"
          pendingDescription="Verifying audio…"
          status={permissions.systemAudio}
          isPending={pendingPermission === 'systemAudio'}
          onAction={handleSystemAudioAction}
        />
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={!allPermissionsGranted}
        className="mt-7 h-11 w-[280px] rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        Finish setup
      </button>

      <p className={cn('mt-3 text-xs', footer.tone)}>{footer.text}</p>

      <button
        type="button"
        onClick={handleSkip}
        className="mt-4 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
      >
        I&apos;ll do this later
      </button>
    </OnboardingContainer>
  );
}
