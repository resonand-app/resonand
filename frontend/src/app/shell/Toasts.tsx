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

import { Button, Toast, ToastRegion } from '@/design-system';
import type { ToastEntry } from '@/design-system';
import { playerShowing, usePlayback } from '@/player/store';

import { timeoutOf, useToasts } from '@/app/toasts';

export function Toasts() {
  const raised = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  const playerVisible = usePlayback(playerShowing);

  const entries: ToastEntry[] = raised.map((one) => {
    const timeout = timeoutOf(one);
    const action = one.action;
    return {
      id: one.id,
      ...(timeout === undefined ? {} : { timeout }),
      content: (
        <Toast
          tone={one.tone}
          onDismiss={() => {
            dismiss(one.id);
          }}
          {...(action === undefined
            ? {}
            : {
                actions: (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      dismiss(one.id);
                      action.run();
                    }}
                  >
                    {action.label}
                  </Button>
                ),
              })}
        >
          {one.message}
        </Toast>
      ),
    };
  });

  return <ToastRegion toasts={entries} onDismiss={dismiss} playerVisible={playerVisible} />;
}
