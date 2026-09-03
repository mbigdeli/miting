/**
 * Device-error parsing for recording start failures.
 * Ported unchanged from the legacy <RecordingControls /> so users keep getting
 * the same actionable guidance in the redesigned Record screen.
 */

export interface DeviceError {
  title: string;
  message: string;
}

export function parseDeviceError(errorMsg: string): DeviceError {
  if (errorMsg.includes('microphone') || errorMsg.includes('mic') || errorMsg.includes('input')) {
    return {
      title: 'Microphone Not Available',
      message:
        'Unable to access your microphone. Please check that:\n• Your microphone is connected\n• The app has microphone permissions\n• No other app is using the microphone',
    };
  }
  if (errorMsg.includes('system audio') || errorMsg.includes('speaker') || errorMsg.includes('output')) {
    return {
      title: 'System Audio Not Available',
      message:
        'Unable to capture system audio. Please check that:\n• A virtual audio device (like BlackHole) is installed\n• The app has screen recording permissions (macOS)\n• System audio is properly configured',
    };
  }
  if (errorMsg.includes('permission')) {
    return {
      title: 'Permission Required',
      message:
        'Recording permissions are required. Please:\n• Grant microphone access in System Settings\n• Grant screen recording access for system audio (macOS)\n• Restart the app after granting permissions',
    };
  }
  return {
    title: 'Recording Failed',
    message: 'Unable to start recording. Please check your audio device settings and try again.',
  };
}
