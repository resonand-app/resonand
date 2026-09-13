/**
 * Where the toasts are drawn (`FBK-1`, `UI-35f`).
 *
 * Handed to the frame rather than rendered inside a view, like the player and the upload tray: a
 * write can fail while somebody is navigating away from the screen that started it, and a region
 * that unmounted with the view would be a region that announces nothing exactly then.
 *
 * It sits above the player when there is one, which is the region's own rule -- the play button is
 * the one control that must stay reachable while anything else is happening.
 */

import { Toast, ToastRegion } from '@/design-system';
import type { ToastEntry } from '@/design-system';
import { playerShowing, usePlayback } from '@/player/store';

import { FAILED_AFTER_MS, useToasts } from '@/app/toasts';

export function Toasts() {
  const raised = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  const playerVisible = usePlayback(playerShowing);

  const entries: ToastEntry[] = raised.map((one) => ({
    id: one.id,
    // Longer than the region's default for a failure, and the default for everything else.
    ...(one.tone === 'failed' ? { timeout: FAILED_AFTER_MS } : {}),
    content: (
      <Toast
        tone={one.tone}
        onDismiss={() => {
          dismiss(one.id);
        }}
      >
        {one.message}
      </Toast>
    ),
  }));

  return <ToastRegion toasts={entries} onDismiss={dismiss} playerVisible={playerVisible} />;
}
