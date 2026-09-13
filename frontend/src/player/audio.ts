/**
 * The sound (`UI-5b`, §3.1).
 *
 * One `HTMLAudioElement`, outside React, driven by the store and reporting back to it. Outside
 * React because it is the one object in the interface that must not be recreated: a re-render
 * that made a new element would restart the recording, and the whole point of the player is that
 * it survives every navigation.
 *
 * **Authorisation is the session cookie.** `<audio>` cannot send a header, and the interface is
 * served from the same origin as the API, so `src="/api/audio/<uuid>/stream"` carries the cookie
 * like every other request. `POST /api/audio/{uuid}/playback-token` is the **fallback, not the
 * default** (§3.1): a token in a URL lands in browser history, gets copied into a chat, and
 * outlives the reason it was minted -- so it is used only when the cookie was not enough, which
 * is a browser refusing cookies on media requests.
 *
 * **Seeking is the browser's.** `GET /api/audio/{uuid}/stream` honours `Range`, so setting
 * `currentTime` into the last minute of a three-hour file fetches that minute rather than the
 * three hours before it. Nothing here implements seeking; what it does is make sure the request
 * that carries it is one the API answers.
 */

import { post } from '@/api/client';

import { usePlayback } from './store';
import type { PlaybackState, Playing } from './store';

/** How often the position is reported while playing. A drawing carries it forward in between. */
const REPORT_MS = 250;

let element: HTMLAudioElement | null = null;
let attachedTo: string | null = null;
let usingToken = false;

/** The element, made on first use. */
export function audio(): HTMLAudioElement {
  element ??= new Audio();
  return element;
}

/** Where a recording's audio is. Relative, same-origin, cookie-authorised. */
export function streamUrl(uuid: string, token?: string): string {
  const path = `/api/audio/${encodeURIComponent(uuid)}/stream`;
  return token === undefined ? path : `${path}?token=${encodeURIComponent(token)}`;
}

/**
 * Keep the element in step with the store.
 *
 * Called once, by the component that owns the player. It subscribes rather than reacting to
 * renders, so a route change cannot interrupt playback -- there is nothing to unmount.
 */
export function connect(): () => void {
  const media = audio();
  const { report } = usePlayback.getState();

  const tick = () => {
    report({ positionMs: Math.round(media.currentTime * 1000) });
  };
  const onLoaded = () => {
    report({ durationMs: Number.isFinite(media.duration) ? Math.round(media.duration * 1000) : 0 });
  };
  const onEnded = () => {
    // Paused at the end rather than stopped: the bar stays, showing what was just heard, which
    // is what somebody who wants to play it again is looking for.
    report({ status: 'paused' });
  };
  const onFailed = () => {
    void recover(media);
  };
  const onPlaying = () => {
    report({ status: 'playing' });
  };
  const onWaiting = () => {
    report({ status: 'buffering' });
  };

  media.addEventListener('timeupdate', tick);
  // Where it stopped and where it landed, both read from the element. Pausing without one of
  // these freezes the position at the last routine report, which is up to a quarter of a second
  // behind the sound -- and a seek while paused produces no routine report at all.
  media.addEventListener('pause', tick);
  media.addEventListener('seeked', tick);
  media.addEventListener('loadedmetadata', onLoaded);
  media.addEventListener('durationchange', onLoaded);
  media.addEventListener('ended', onEnded);
  media.addEventListener('error', onFailed);
  media.addEventListener('playing', onPlaying);
  media.addEventListener('waiting', onWaiting);
  const ticking = setInterval(() => {
    if (!media.paused) tick();
  }, REPORT_MS);

  const unsubscribe = usePlayback.subscribe((state) => {
    apply(media, state);
  });
  apply(media, usePlayback.getState());

  return () => {
    clearInterval(ticking);
    media.removeEventListener('timeupdate', tick);
    media.removeEventListener('pause', tick);
    media.removeEventListener('seeked', tick);
    media.removeEventListener('loadedmetadata', onLoaded);
    media.removeEventListener('durationchange', onLoaded);
    media.removeEventListener('ended', onEnded);
    media.removeEventListener('error', onFailed);
    media.removeEventListener('playing', onPlaying);
    media.removeEventListener('waiting', onWaiting);
    unsubscribe();
  };
}

/** Make the element be what the store says. */
function apply(media: HTMLAudioElement, state: PlaybackState): void {
  const recording: Playing | null = state.recording;
  if (recording === null) {
    if (attachedTo !== null) {
      media.pause();
      media.removeAttribute('src');
      media.load();
      attachedTo = null;
      usingToken = false;
    }
    return;
  }

  if (attachedTo !== recording.uuid) {
    attachedTo = recording.uuid;
    usingToken = false;
    media.src = streamUrl(recording.uuid);
    media.load();
  }

  if (state.rate !== media.playbackRate) media.playbackRate = state.rate;

  if (state.seekingToMs !== null) {
    const target = state.seekingToMs / 1000;
    if (Math.abs(media.currentTime - target) > 0.05) media.currentTime = target;
  }

  const shouldPlay = state.status === 'playing' || state.status === 'buffering';
  // Never `play()` an element sitting at its end: that is what restarts a recording from the
  // beginning. An element that has ended has already paused itself, and the `ended` report that
  // says so arrives a task later -- so any update landing in between (a position read at the
  // end, a rate, anything) would find `playing` and a paused element and start it over. Ending
  // is `paused` at the end (§3.1), and getting back to the start is asking for it.
  if (shouldPlay && media.paused && !media.ended) start(media);
  if (!shouldPlay && !media.paused) media.pause();
}

/**
 * Ask it to play, and believe the answer.
 *
 * Autoplay refused, a source that will not decode, or an environment with no decoder at all --
 * all three end the same way, and saying so is better than a transport that looks pressed and
 * produces silence. `play()` returns nothing at all in some environments (jsdom, and browsers
 * old enough not to matter), which is why the result is checked rather than awaited blindly.
 */
function start(media: HTMLAudioElement): void {
  const started: Promise<void> | undefined = media.play();
  if (started as Promise<void> | undefined) {
    void started.catch(() => {
      usePlayback.getState().report({ status: 'failed' });
    });
  }
}

/**
 * Try once with a playback token, then give up and say so.
 *
 * The cookie is the default and this is the fallback (§3.1). One attempt: a second failure is not
 * an authorisation problem, and a loop of token requests behind a broken file is a loop nobody
 * can see.
 */
async function recover(media: HTMLAudioElement): Promise<void> {
  const { recording, report } = usePlayback.getState();
  if (recording === null || usingToken) {
    report({ status: 'failed' });
    return;
  }
  usingToken = true;
  try {
    const minted = await post('/api/audio/{audio_uuid}/playback-token', {
      path: { audio_uuid: recording.uuid },
    });
    media.src = streamUrl(recording.uuid, minted.token);
    media.load();
    start(media);
  } catch {
    report({ status: 'failed' });
  }
}

/** Forget the element. Tests only -- the application has exactly one for its whole life. */
export function reset(): void {
  element = null;
  attachedTo = null;
  usingToken = false;
}
