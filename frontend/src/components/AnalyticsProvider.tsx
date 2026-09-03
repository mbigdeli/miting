'use client';

import React, { useEffect, ReactNode, useRef, useState, createContext } from 'react';
import { bootstrapAnalytics } from '@/lib/analyticsBootstrap';

interface AnalyticsProviderProps {
  children: ReactNode;
}

interface AnalyticsContextType {
  isAnalyticsOptedIn: boolean;
  setIsAnalyticsOptedIn: (optedIn: boolean) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextType>({
  isAnalyticsOptedIn: true,
  setIsAnalyticsOptedIn: () => { },
});

/**
 * Analytics is on by default (write-only public key). Meeting content is
 * never captured: replay inputs are masked and transcript/summary surfaces
 * carry ph-no-capture, so recordings show layout and clicks, not content.
 */
export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [isAnalyticsOptedIn, setIsAnalyticsOptedIn] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    let teardown: (() => void) | undefined;
    bootstrapAnalytics()
      .then((cleanup) => {
        teardown = cleanup;
      })
      .catch(console.error);

    return () => teardown?.();
  }, []);

  return (
    <AnalyticsContext.Provider value={{ isAnalyticsOptedIn, setIsAnalyticsOptedIn }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
