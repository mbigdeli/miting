'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';

interface ModelSettingsDialogProps {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSave: (config?: ModelConfig) => Promise<void>;
  /**
   * Registration callback: receives a function that opens this dialog.
   * Used by the generation error path to auto-open model settings
   * (same mechanism the legacy SummaryGeneratorButtonGroup used).
   */
  registerOpen?: (openFn: () => void) => void;
}

export default function ModelSettingsDialog({
  modelConfig,
  setModelConfig,
  onSave,
  registerOpen,
}: ModelSettingsDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (registerOpen) registerOpen(() => setOpen(true));
  }, [registerOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Model Settings</DialogTitle>
        </VisuallyHidden>
        <ModelSettingsModal
          onSave={async (config) => {
            await onSave(config);
            setOpen(false);
          }}
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          skipInitialFetch={true}
          layout="dialog"
        />
      </DialogContent>
    </Dialog>
  );
}
