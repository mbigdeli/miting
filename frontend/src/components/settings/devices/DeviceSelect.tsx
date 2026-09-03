'use client';

/** Labelled device dropdown used for the microphone and system-audio rows. */

import type { ComponentType, ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { AudioDevice } from './deviceTypes';

export function DeviceSelect({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
  devices,
  defaultLabel,
  emptyText,
  children,
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onChange: (deviceName: string) => void;
  disabled: boolean;
  devices: AudioDevice[];
  defaultLabel: string;
  emptyText: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-500" />
        <Label htmlFor={id} className="text-[13px] font-medium text-zinc-700">
          {label}
        </Label>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{defaultLabel}</SelectItem>
          {devices.map((device) => (
            <SelectItem
              key={device.name}
              value={`${device.name} (${device.device_type.toLowerCase()})`}
            >
              {device.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {devices.length === 0 && <p className="text-xs text-zinc-500">{emptyText}</p>}
      {children}
    </div>
  );
}
