'use client';

import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DeviceError } from './deviceError';

interface DeviceErrorAlertProps {
  error: DeviceError | null;
  onDismiss: () => void;
}

/** Recording-start device error alert (ported from the legacy controls). */
export function DeviceErrorAlert({ error, onDismiss }: DeviceErrorAlertProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className="mt-6 border-red-300 bg-red-50 text-left">
      <AlertCircle className="h-5 w-5 text-red-600" />
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 text-red-600 transition-colors hover:text-red-800"
        aria-label="Close alert"
      >
        <X className="h-4 w-4" />
      </button>
      <AlertTitle className="mb-2 font-semibold text-red-800">{error.title}</AlertTitle>
      <AlertDescription className="text-red-700">
        {error.message.split('\n').map((line, i) => (
          <div key={i} className={i > 0 ? 'ml-2' : ''}>
            {line}
          </div>
        ))}
      </AlertDescription>
    </Alert>
  );
}
