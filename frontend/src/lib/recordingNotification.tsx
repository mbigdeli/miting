import { toast } from 'sonner';
import { X } from 'lucide-react';
import Analytics from '@/lib/analytics';

/**
 * Shows the recording notification toast with compliance message.
 * Checks user preferences and displays a dismissible toast with:
 * - notice to inform participants
 * - "Don't show again" checkbox
 * - Acknowledgment button
 *
 * @returns Promise<void> - Resolves when notification is shown or skipped
 */
export async function showRecordingNotification(): Promise<void> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load('preferences.json');
    const showNotification = await store.get<boolean>('show_recording_notification') ?? true;

    if (showNotification) {
      let dontShowAgain = false;

      toast.custom(
        (id) => (
          // The Toaster supplies the card frame (see AppToaster); sonner nests
          // custom JSX inside the toast's semibold title slot, hence font-normal.
          <div className="w-full font-normal">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              <p className="text-[13.5px] font-semibold text-zinc-900">Recording started</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => toast.dismiss(id)}
                className="-my-1 -mr-1 ml-auto rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-snug text-zinc-500">
              Let everyone know this miting is being recorded.
            </p>

            <button
              type="button"
              onClick={async () => {
                if (dontShowAgain) {
                  const { Store } = await import('@tauri-apps/plugin-store');
                  const prefs = await Store.load('preferences.json');
                  await prefs.set('show_recording_notification', false);
                  await prefs.save();
                }
                Analytics.trackButtonClick('recording_notification_acknowledged', 'toast');
                toast.dismiss(id);
              }}
              className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-700"
            >
              I&apos;ve told everyone
            </button>

            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11.5px] text-zinc-500 hover:text-zinc-700">
              <input
                type="checkbox"
                onChange={(e) => {
                  dontShowAgain = e.target.checked;
                }}
                className="size-3.5 rounded border-zinc-300 text-brand focus:ring-1 focus:ring-brand"
              />
              <span className="select-none">Don&apos;t show this again</span>
            </label>
          </div>
        ),
        {
          duration: 10000,
          position: 'bottom-right',
        },
      );
    }
  } catch (notificationError) {
    console.error('Failed to show recording notification:', notificationError);
    // Don't fail the recording if notification fails
  }
}
