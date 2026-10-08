import { toast } from 'sonner';
import { aiProblem } from './aiProblem';

/** Show why translation failed as an error toast. */
export function toastProblem(reason: unknown): void {
  const problem = aiProblem(reason == null ? null : String(reason));
  toast.error(problem.title, { description: problem.body });
}
