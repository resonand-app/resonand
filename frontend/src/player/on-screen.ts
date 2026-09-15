/**
 * Which recording is drawing its own waveform right now (`UI-11h`, §3.1).
 *
 * There is one sound and two surfaces that can draw its shape, and exactly one of them draws it
 * at a time: two waveforms at two scales drifting a frame apart is what makes people believe
 * there are two players. The detail view's 130px waveform wins while it is on screen, and the bar
 * takes the shape back the moment it is not.
 *
 * **It is visibility and not the route.** The detail waveform scrolls away under the transcript
 * (`UI-11g`), so being on a recording's page stopped answering the question -- somebody reading
 * the transcript of the thing they are listening to is on that page with no waveform in front of
 * them, and that is precisely when the bar has to have one.
 *
 * A store rather than a prop because the two surfaces are on opposite sides of the shell: the bar
 * is outside the routes and outlives them, and the view that publishes here is inside one.
 */

import { create } from 'zustand';

interface OnScreenWaveform {
  /** The recording whose own waveform is on screen, or null when none is. */
  uuid: string | null;
  show: (uuid: string) => void;
  /** Guarded by uuid: a view being replaced must not clear the flag its replacement just set. */
  hide: (uuid: string) => void;
}

export const useOnScreenWaveform = create<OnScreenWaveform>((set) => ({
  uuid: null,
  show: (uuid) => {
    set({ uuid });
  },
  hide: (uuid) => {
    set((state) => (state.uuid === uuid ? { uuid: null } : state));
  },
}));
