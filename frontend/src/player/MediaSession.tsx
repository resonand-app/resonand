/**
 * The system's own controls (`UI-5e`, §2.3).
 *
 * The lock screen, the headphone buttons, the car. It is what makes the product usable while
 * walking, which is where most of the listening happens -- and it costs one effect.
 *
 * **The mark is the artwork.** There is no other image in the product, and inventing one would
 * mean fetching it from somewhere, which principle 2 forbids. The recording's title is the title
 * and the library is the artist, which is what those two fields mean here.
 */

import { useEffect } from 'react';

import { usePlayback } from './store';

/** The mark, as a data URI. Four strokes, the same geometry as the waveform and the logo. */
const ARTWORK =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
      '<rect width="512" height="512" rx="96" fill="#1a1614"/>' +
      '<g stroke="#e8a33d" stroke-width="34" stroke-linecap="round">' +
      '<line x1="152" y1="212" x2="152" y2="300"/>' +
      '<line x1="220" y1="160" x2="220" y2="352"/>' +
      '<line x1="288" y1="120" x2="288" y2="392"/>' +
      '<line x1="356" y1="196" x2="356" y2="316"/>' +
      '</g></svg>',
  );

export function MediaSession() {
  const recording = usePlayback((state) => state.recording);
  const status = usePlayback((state) => state.status);

  useEffect(() => {
    const session = navigator.mediaSession as MediaSession | undefined;
    if (session === undefined) return;
    if (recording === null) {
      session.metadata = null;
      session.playbackState = 'none';
      return;
    }
    session.metadata = new MediaMetadata({
      title: recording.title,
      artist: recording.library,
      artwork: [{ src: ARTWORK, sizes: '512x512', type: 'image/svg+xml' }],
    });
    session.playbackState = status === 'playing' ? 'playing' : 'paused';
  }, [recording, status]);

  useEffect(() => {
    const session = navigator.mediaSession as MediaSession | undefined;
    if (session === undefined) return;
    const { toggle, nudge } = usePlayback.getState();
    // The same amounts as the interface's own skips and ⇧-arrows (§1.8), because a headphone
    // button and a keyboard shortcut doing different things is a product with two opinions.
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', toggle],
      ['pause', toggle],
      [
        'seekbackward',
        () => {
          nudge(-15);
        },
      ],
      [
        'seekforward',
        () => {
          nudge(15);
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // An action this browser does not know. Not having it is not a failure.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // As above.
        }
      }
    };
  }, []);

  return null;
}
