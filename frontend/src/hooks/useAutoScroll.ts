import { useRef, useState, useEffect, useCallback, RefObject } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';
import { followAfterScroll, SCROLL_KEYS } from '@/lib/followScroll';

interface UseAutoScrollProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  segments: { id?: string }[];
  isRecording: boolean;
  isPaused: boolean;
  activeSegmentId?: string;
  virtualizer?: Virtualizer<HTMLDivElement, Element>;
  virtualizationThreshold?: number;
  /** Never follow (the meeting details page). */
  disableAutoScroll?: boolean;
}

/**
 * Keep the live transcript at its newest line while recording. Following
 * stops only when the user scrolls away and resumes when they return to the
 * bottom (or press "Jump to latest"); content growing by itself never stops it.
 */
export function useAutoScroll({
  scrollRef,
  segments,
  isRecording,
  isPaused,
  activeSegmentId,
  virtualizer,
  virtualizationThreshold = 10,
  disableAutoScroll = false,
}: UseAutoScrollProps) {
  const useVirtualization = !!virtualizer && segments.length >= virtualizationThreshold;
  const [autoScroll, setAutoScroll] = useState(true);
  const followRef = useRef(true);
  const lastUserInputRef = useRef(0);

  const setFollow = useCallback((on: boolean) => {
    followRef.current = on;
    setAutoScroll(on);
  }, []);

  const pinToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (useVirtualization && virtualizer) {
      virtualizer.scrollToOffset(virtualizer.getTotalSize() + 1000, { align: 'end' });
    }
    el.scrollTop = el.scrollHeight;
  }, [scrollRef, useVirtualization, virtualizer]);

  const scrollToBottom = useCallback(() => {
    setFollow(true);
    pinToBottom();
  }, [pinToBottom, setFollow]);

  // Only the user's own input may stop or resume following.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let dragging = false;
    const mark = () => {
      lastUserInputRef.current = Date.now();
    };
    const onDown = () => {
      dragging = true;
      mark();
    };
    const onUp = () => {
      dragging = false;
    };
    const onKey = (e: KeyboardEvent) => SCROLL_KEYS.has(e.key) && mark();
    const onScroll = () => {
      if (dragging) mark(); // a long scrollbar drag
      const next = followAfterScroll(followRef.current, el, Date.now(), lastUserInputRef.current);
      if (next !== followRef.current) setFollow(next);
    };
    el.addEventListener('wheel', mark, { passive: true });
    el.addEventListener('touchmove', mark, { passive: true });
    el.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp);
    el.addEventListener('keydown', onKey);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', mark);
      el.removeEventListener('touchmove', mark);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollRef, setFollow]);

  const live = !disableAutoScroll && isRecording && !isPaused;

  // New or longer lines.
  useEffect(() => {
    if (live && followRef.current && segments.length > 0) {
      pinToBottom();
      const t = setTimeout(pinToBottom, 60);
      return () => clearTimeout(t);
    }
  }, [segments, live, pinToBottom]);

  // Anything else that grows the content (translations, notes, streaming text).
  useEffect(() => {
    const el = scrollRef.current;
    if (!live || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => followRef.current && pinToBottom());
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [live, scrollRef, pinToBottom, segments.length]);

  // Jump to a chosen line (search results and the like).
  useEffect(() => {
    if (!activeSegmentId) return;
    const index = segments.findIndex((s) => s.id === activeSegmentId);
    if (useVirtualization && virtualizer && index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
    } else {
      document
        .getElementById(`segment-${activeSegmentId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegmentId, useVirtualization, virtualizer, segments]);

  return { autoScroll, setAutoScroll: setFollow, scrollToBottom };
}
