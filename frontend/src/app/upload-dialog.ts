/**
 * Reaching the upload dialog from below the shell (`UI-18a1`).
 *
 * The dialog itself belongs to `AppShell` and must stay there: what an upload starts has to
 * outlive the screen it was started from, so the state that opens it cannot live in a view
 * (`UI-18`, §3.3). But that left every screen underneath unable to *ask* -- and `UI-10a`'s empty
 * state is an invitation to upload something, with no way to accept it. An invitation whose
 * button cannot exist is worse than no invitation.
 *
 * So the state stays where it was and only the verb is published. Nothing here holds whether the
 * dialog is open; a caller can open it and cannot close it, read it or race it.
 *
 * **Which library it lands in is not a parameter.** `AppShell` reads that off the path, so a
 * caller on a library screen already gets that library and a caller anywhere else gets the
 * chooser. Passing it would be a second answer to a question that already has one.
 */

import { createContext, useContext } from 'react';

/**
 * The context rather than a wrapper component, so this module exports no component at all and
 * stays a plain `.ts` beside the rest of the spine.
 */
export const OpenUploadContext = createContext<(() => void) | null>(null);

/**
 * Open the upload dialog, or `null` where there is no shell around this component.
 *
 * `null` rather than a throw or a no-op function: the specimen page and a good many tests render
 * a view on its own, and a caller that has to draw a button only when there is something for it
 * to do needs to be able to ask.
 */
export function useOpenUpload(): (() => void) | null {
  return useContext(OpenUploadContext);
}
