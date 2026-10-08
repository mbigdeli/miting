'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePreparedExtension } from '@/components/settings/extension/usePreparedExtension';
import { useIsMac } from '@/components/onboarding/shared/useIsMac';
import { displayPath } from '@/lib/extensionGuide';
import { nextStep, staticView, type GuideStep } from '@/lib/extensionDemo';
import { ChromeWindow } from './ChromeWindow';
import { DemoCursor } from './DemoCursor';
import { GuideStepList } from './GuideStepList';
import { useGuideActions } from './useGuideActions';
import { useGuideDemo } from './useGuideDemo';

/**
 * How to add the Chrome extension: three steps on the left, a drawn Chrome
 * window on the right that shows the switch or button each step needs, and a
 * walkthrough with a moving pointer. One component for onboarding, the Home
 * dialog and Settings, so the three never drift apart.
 */
export function ExtensionGuide({ connected, autoPlay = false }: {
  connected: boolean;
  /** Start the pointer walkthrough by itself (onboarding). */
  autoPlay?: boolean;
}) {
  const isMac = useIsMac();
  const { status } = usePreparedExtension();
  const installPath = status?.installPath ?? null;
  const path = displayPath(installPath ?? '');
  const actions = useGuideActions(installPath);
  const demo = useGuideDemo(isMac, path.length, autoPlay && !connected);
  const [picked, setPicked] = useState<GuideStep | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const { stop } = demo;

  // Once it works there is nothing left to show.
  useEffect(() => {
    if (connected) stop();
  }, [connected, stop]);

  const step = picked ?? nextStep(actions.opened, actions.copied);
  const view = demo.frame?.view ?? staticView(step, connected);

  // Any press takes the controls back from the walkthrough.
  const take = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    demo.stop();
    fn(...args);
  };

  return (
    <div ref={root} className="relative flex w-full max-w-[960px] flex-wrap gap-5 text-left">
      <GuideStepList
        isMac={isMac}
        step={demo.frame?.view.step ?? step}
        opened={actions.opened}
        copied={actions.copied}
        connected={connected}
        playing={demo.playing}
        onSelect={take(setPicked)}
        onOpenChrome={take(() => {
          setPicked(2);
          void actions.openChrome();
        })}
        onCopyPath={take(() => {
          setPicked(3);
          void actions.copyPath();
        })}
        onShowInFinder={take(() => void actions.showInFinder())}
        onTogglePlay={demo.playing ? demo.stop : demo.play}
      />
      <ChromeWindow view={view} callouts={!demo.playing} isMac={isMac} path={path} />
      <DemoCursor root={root} move={demo.cursor} tick={demo.tick} />
    </div>
  );
}
