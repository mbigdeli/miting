import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Text of whatever a rejected promise carried.
 *
 * Tauri's `invoke` rejects with the Rust `Err` *string*, never an `Error`, so
 * `err instanceof Error ? err.message : 'something failed'` silently threw the
 * real reason away — which is how a failing Ollama pull ended up looking like a
 * button that does nothing. Use this at every `invoke` catch site.
 */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'string') return error.trim() || fallback;
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return error == null ? fallback : String(error);
}

/**
 * Detects if an error message indicates that Ollama is not installed or not running
 * @param errorMessage - The error message to check
 * @returns true if the error indicates Ollama is not installed/running
 */
export function isOllamaNotInstalledError(errorMessage: string): boolean {
  if (!errorMessage) return false;

  const lowerError = errorMessage.toLowerCase();

  // Check for common patterns that indicate Ollama is not installed or not running
  const patterns = [
    'cannot connect',
    'connection refused',
    'cli not found',
    'not in path',
    'ollama cli not found',
    'not found or not in path',
    'please check if the server is running',
    'please check if the ollama server is running',
    'econnrefused',
  ];

  return patterns.some(pattern => lowerError.includes(pattern));
}
