import type { RowState } from '@/lib/setupSteps';
import type { MarkKind } from './options';

/** Everything one option row needs to render; built by the step hooks. */
export interface StepRow {
  key: string;
  title: string;
  tag?: string;
  lead?: string;
  /** Formatted size from the backend catalog, once it has loaded. */
  size?: string;
  tip: string;
  mark: MarkKind;
  state: RowState;
  action: 'download' | 'connect';
  /** Draw the action as the primary button (the app it needs is installed). */
  solid?: boolean;
  /** Draw the OR divider above this row. */
  orBefore?: boolean;
  act: () => void;
}
