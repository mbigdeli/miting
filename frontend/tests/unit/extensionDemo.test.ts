import { describe, expect, it } from 'vitest';
import { demoFrames, nextStep, staticView } from '@/lib/extensionDemo';

const PATH = 'C:\\Users\\you\\AppData\\Roaming\\Miting\\extension';

describe('nextStep', () => {
  it('points at the first step not done', () => {
    expect(nextStep(false, false)).toBe(1);
    expect(nextStep(true, false)).toBe(2);
    expect(nextStep(true, true)).toBe(3);
  });
});

describe('staticView', () => {
  it('shows Developer mode off only on step 1 and the folder window on step 3', () => {
    expect(staticView(1, false)).toMatchObject({ devOn: false, picker: false });
    expect(staticView(2, false)).toMatchObject({ devOn: true, picker: false });
    expect(staticView(3, false)).toMatchObject({ devOn: true, picker: true, typed: null });
  });
});

describe('demoFrames on Windows', () => {
  const frames = demoFrames(false, PATH.length);

  it('types the whole path into the address bar', () => {
    const typed = frames.map((f) => f.view.typed).filter((t): t is number => t !== null);
    expect(Math.max(...typed)).toBe(PATH.length);
    expect(frames.some((f) => f.view.macStage !== null)).toBe(false);
  });

  it('clicks Developer mode, Load unpacked, then Select Folder, in that order', () => {
    const clicks = frames.filter((f) => f.cursor?.click).map((f) => f.cursor?.target);
    expect(clicks).toEqual(['dev', 'load', 'addr', 'select']);
  });

  it('ends with Miting added and the folder window closed', () => {
    const last = frames[frames.length - 1].view;
    expect(last).toMatchObject({ added: true, picker: false, step: 3 });
  });
});

describe('demoFrames on macOS', () => {
  const frames = demoFrames(true, PATH.length);

  it('uses Go to Folder instead of typing into an address bar', () => {
    const stages = frames.map((f) => f.view.macStage).filter(Boolean);
    expect(stages).toEqual(expect.arrayContaining(['keys', 'goto', 'paste', 'return', 'ext']));
    expect(frames.some((f) => (f.view.typed ?? 0) > 0)).toBe(false);
    expect(frames.some((f) => f.cursor?.target === 'addr')).toBe(false);
  });

  it('only shows the keys after the folder window opened', () => {
    const open = frames.findIndex((f) => f.view.picker);
    const keys = frames.findIndex((f) => f.view.macStage === 'keys');
    expect(open).toBeGreaterThan(-1);
    expect(keys).toBeGreaterThan(open);
  });
});
