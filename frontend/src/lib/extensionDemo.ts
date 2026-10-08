/**
 * The "Show me how" walkthrough of adding the extension, as plain data: a
 * list of frames, each a picture of the fake Chrome window plus where the
 * cursor goes. Kept free of React so the timing and order are unit tested.
 */

/** macOS has no address bar in its folder window: ⌘⇧G opens Go to Folder. */
export type MacStage = 'downloads' | 'keys' | 'goto' | 'paste' | 'pasted' | 'return' | 'ext';

export type GuideStep = 1 | 2 | 3;

export interface DemoView {
  step: GuideStep;
  /** Developer mode switch, and with it the Load unpacked buttons. */
  devOn: boolean;
  /** The folder window Chrome opens for Load unpacked. */
  picker: boolean;
  /** Windows: characters of the path typed so far; null shows all of it. */
  typed: number | null;
  macStage: MacStage | null;
  /** Miting's card in the extensions list. */
  added: boolean;
}

/** Elements the cursor can point at; they carry a matching `data-demo`. */
export type DemoTarget = 'cards' | 'dev' | 'load' | 'addr' | 'list' | 'select';

export interface CursorMove {
  target: DemoTarget;
  dx?: number;
  dy?: number;
  click?: boolean;
  /** Jump instead of gliding (the start of each loop). */
  instant?: boolean;
}

export interface DemoFrame {
  view: DemoView;
  cursor?: CursorMove;
  /** How long this frame stays before the next one. */
  ms: number;
}

/** What the window shows when nobody is playing the walkthrough. */
export function staticView(step: GuideStep, added: boolean): DemoView {
  return { step, devOn: step !== 1, picker: step === 3, typed: null, macStage: null, added };
}

/** The step to point at: the first one the user has not done yet. */
export function nextStep(opened: boolean, copied: boolean): GuideStep {
  if (!opened) return 1;
  return copied ? 3 : 2;
}

const MAC_STAGES: [MacStage, number][] = [
  ['keys', 1500],
  ['goto', 700],
  ['paste', 1100],
  ['pasted', 900],
  ['return', 1000],
  ['ext', 700],
];

export function demoFrames(isMac: boolean, pathLength: number): DemoFrame[] {
  const frames: DemoFrame[] = [];
  let view = staticView(1, false);
  const push = (patch: Partial<DemoView>, ms: number, cursor?: CursorMove) => {
    view = { ...view, ...patch };
    frames.push({ view, ms, cursor });
  };

  push({}, 600, { target: 'cards', dy: 40, instant: true });
  push({}, 900, { target: 'dev' });
  push({ devOn: true }, 1100, { target: 'dev', click: true });
  push({ step: 2 }, 1000, { target: 'load' });
  push(
    { step: 3, picker: true, typed: 0, macStage: isMac ? 'downloads' : null },
    1000,
    { target: 'load', click: true },
  );
  if (isMac) {
    push({}, 700, { target: 'list' });
    for (const [macStage, ms] of MAC_STAGES) push({ macStage }, ms);
  } else {
    push({}, 900, { target: 'addr', dx: -40 });
    push({}, 350, { target: 'addr', dx: -40, click: true });
    for (let typed = 3; typed < pathLength + 3; typed += 3) {
      push({ typed: Math.min(pathLength, typed) }, 28);
    }
    push({}, 600);
  }
  push({}, 900, { target: 'select' });
  push({}, 300, { target: 'select', click: true });
  push({ picker: false, typed: null, macStage: null }, 900, { target: 'cards', dy: 40 });
  push({ added: true }, 2600);
  return frames;
}
