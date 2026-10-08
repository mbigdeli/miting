'use client';

import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { CHROME_EXTENSIONS_URL } from '@/lib/extensionGuide';

/** The three things the guide's buttons do, and whether each was done. */
export function useGuideActions(installPath: string | null) {
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chrome refuses chrome:// addresses handed to it by another app (it opens
  // a blank tab instead), so the button brings Chrome up and puts the
  // address on the clipboard for the user to paste.
  const openChrome = useCallback(async () => {
    setOpened(true);
    let copiedAddress = true;
    try {
      await navigator.clipboard.writeText(CHROME_EXTENSIONS_URL);
    } catch {
      copiedAddress = false;
    }
    try {
      await invoke('extension_install_open_browser');
    } catch (error) {
      console.warn('[Extension] Could not open Chrome:', error);
    }
    toast.info(
      copiedAddress
        ? `${CHROME_EXTENSIONS_URL} is copied. Paste it into the Chrome address bar.`
        : `In Chrome, go to ${CHROME_EXTENSIONS_URL}.`,
    );
  }, []);

  const copyPath = useCallback(async () => {
    if (!installPath) return;
    try {
      await navigator.clipboard.writeText(installPath);
      setCopied(true);
    } catch {
      toast.error('Could not copy the path. Copy it from Settings, Chrome Extension.');
    }
  }, [installPath]);

  const showInFinder = useCallback(async () => {
    try {
      await invoke('extension_install_open_folder');
    } catch (error) {
      toast.error(String(error));
    }
  }, []);

  return { opened, copied, openChrome, copyPath, showInFinder };
}
