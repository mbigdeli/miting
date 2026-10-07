interface OnboardingSummaryModelStatusInput {
  selectedModel: string;
  recommendedModel: string;
  selectedModelReady: boolean;
}

interface OnboardingSummaryModelStatus {
  selectedSummaryModel: string;
  summaryModelDownloaded: boolean;
}

export function resolveOnboardingSummaryModelStatus({
  selectedModel,
  recommendedModel,
  selectedModelReady,
}: OnboardingSummaryModelStatusInput): OnboardingSummaryModelStatus {
  const selectedSummaryModel = selectedModel || recommendedModel;

  return {
    selectedSummaryModel,
    summaryModelDownloaded: Boolean(selectedSummaryModel && selectedModelReady),
  };
}

/**
 * How Settings and the setup steps show a built in summary model's size. The
 * number itself always comes from `builtin_ai_list_models` (`size_mb`).
 */
export function formatSummaryModelSizeLabelFromMb(sizeMb: number): string {
  if (sizeMb === 0) {
    return '';
  }

  if (sizeMb >= 1024) {
    return `~${(sizeMb / 1024).toFixed(1)} GiB`;
  }

  return `~${sizeMb} MiB`;
}
