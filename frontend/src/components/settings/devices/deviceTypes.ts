/** Audio-device types + analytics metadata shared by the device picker. */

export interface AudioDevice {
  name: string;
  device_type: 'Input' | 'Output';
}

export interface SelectedDevices {
  micDevice: string | null;
  systemDevice: string | null;
}

export interface AudioLevelData {
  device_name: string;
  device_type: string;
  rms_level: number;
  peak_level: number;
  is_active: boolean;
}

export interface AudioLevelUpdate {
  timestamp: number;
  levels: AudioLevelData[];
}

/** Anonymous device category for analytics (never the device name itself). */
export function deviceMetadata(deviceName: string) {
  const nameLower = deviceName.toLowerCase();
  const isBluetooth =
    nameLower.includes('airpods') ||
    nameLower.includes('bluetooth') ||
    nameLower.includes('wireless') ||
    nameLower.includes('wh-') || // Sony WH-* series
    nameLower.includes('bt ');

  let category = 'wired';
  if (deviceName === 'default') category = 'default';
  else if (nameLower.includes('airpods')) category = 'airpods';
  else if (isBluetooth) category = 'bluetooth';

  return { isBluetooth, category };
}
