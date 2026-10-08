import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ExtensionGuide } from '@/components/extension-guide/ExtensionGuide';
import { useExtensionConnection } from '@/components/extension-guide/useExtensionConnection';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { OnboardingContainer } from '../OnboardingContainer';
import { onboardingStepCount } from '../shared/stepCount';
import { useIsMac } from '../shared/useIsMac';

/**
 * Setup step 4: add the Chrome extension. Shown to everyone, because people
 * did not know it existed, and skippable from the X or the link. The pointer
 * walkthrough starts by itself; Continue waits until the app hears from the
 * extension. On a Mac the permissions step follows, elsewhere this ends setup.
 */
export function ChromeExtensionStep() {
  const { goNext, completeOnboarding } = useOnboarding();
  const isMac = useIsMac();
  const connection = useExtensionConnection();
  const [isCompleting, setIsCompleting] = useState(false);

  const finish = async () => {
    if (isMac) {
      goNext();
      return;
    }
    setIsCompleting(true);
    try {
      await completeOnboarding();
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete setup', { description: 'Please try again.' });
      setIsCompleting(false);
    }
  };
  const skip = () => void finish();

  return (
    <OnboardingContainer
      title="Add Miting to Google Meet"
      description="Miting reads the captions Meet already shows, so your notes say who said what."
      step={4}
      totalSteps={onboardingStepCount(isMac)}
      className="py-10"
      onClose={isCompleting ? undefined : skip}
    >
      <div className="mt-6 flex w-full justify-center">
        {connection.loaded && (
          <ExtensionGuide connected={connection.everConnected} autoPlay={!connection.everConnected} />
        )}
      </div>

      <button
        type="button"
        onClick={skip}
        disabled={!connection.everConnected || isCompleting}
        className="mt-6 flex h-11 min-w-[280px] items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : connection.everConnected ? (
          'Continue'
        ) : (
          'Waiting for Chrome'
        )}
      </button>

      <button
        type="button"
        onClick={skip}
        disabled={isCompleting}
        className="mt-3 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
      >
        Skip, I don&apos;t use Google Meet
      </button>
    </OnboardingContainer>
  );
}
