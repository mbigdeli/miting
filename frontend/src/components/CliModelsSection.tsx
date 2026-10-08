/**
 * Manual model entry for a CLI provider (codex / claude-code), shown only when
 * the verified list is empty — the refresh action itself now sits next to the
 * model picker. A typed id is probed with a real call before it is saved.
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CliModelEntry, CliProvider, validateCliModel } from '@/services/cliModelService';
import { toErrorMessage } from '@/lib/utils';

interface Props {
  provider: CliProvider;
  connected: boolean;
  models: CliModelEntry[] | null;
  loading: boolean;
  onValidated: (id: string) => void;
}

const DOCS: Record<CliProvider, string> = {
  codex: 'https://platform.openai.com/docs/models',
  'claude-code': 'https://docs.claude.com/en/docs/about-claude/models',
};

export function CliModelsSection({ provider, connected, models, loading, onValidated }: Props) {
  const [customModel, setCustomModel] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validatedCount = models ? models.filter((m) => m.id !== 'default').length : 0;
  const showFallback = !loading && models !== null && validatedCount === 0;

  const submitCustomModel = async () => {
    if (!customModel.trim() || validating) return;
    setValidating(true);
    setValidationError(null);
    try {
      const outcome = await validateCliModel(provider, customModel);
      if (outcome.valid) {
        onValidated(customModel.trim());
        setCustomModel('');
      } else {
        setValidationError(outcome.error ?? 'The model was rejected.');
      }
    } catch (err) {
      setValidationError(toErrorMessage(err, 'The model could not be verified.'));
    } finally {
      setValidating(false);
    }
  };

  if (!showFallback) return null;

  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <div className="text-xs text-muted-foreground">
        No verified models yet. Paste a model id:{' '}
        <button
          type="button"
          className="text-primary underline"
          onClick={() => invoke('api_open_external', { url: DOCS[provider] })}
        >
          model docs
        </button>
        .
      </div>
      <div className="flex items-center space-x-2">
        <Input
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitCustomModel()}
          placeholder={provider === 'codex' ? 'e.g. gpt-5.6-sol' : 'e.g. claude-sonnet-4-6'}
          className="h-8 max-w-[240px] text-sm"
          disabled={validating || !connected}
        />
        <Button
          type="button"
          size="sm"
          onClick={submitCustomModel}
          disabled={validating || !connected || !customModel.trim()}
        >
          {validating ? 'Verifying…' : 'Verify & add'}
        </Button>
      </div>
      {!connected && (
        <div className="text-xs text-amber-600">Sign in first to verify a model.</div>
      )}
      {validationError && <div className="break-words text-xs text-red-600">{validationError}</div>}
    </div>
  );
}
