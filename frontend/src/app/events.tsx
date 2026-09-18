/**
 * The archive saying what changed, instead of being asked (`REV-12`).
 *
 * One `EventSource` for the whole application, opened once behind the session guard and closed
 * when it goes. Each event names a recording or a library and carries nothing about it, so what
 * arrives here is turned into a `Change` and handed to `invalidate` -- the map that already knows
 * what each change makes stale. Nothing in a feature has to know the stream exists.
 *
 * **The stream is the fast path and not the only one.** `FBK-3`'s scoped polling stays, and
 * `useLiveArchive` is what turns it off: while the stream is connected a settling recording makes
 * no requests at all, and if the stream cannot be held -- a reverse proxy that buffers, a browser
 * out of connections to this origin, a session that ended -- the interval comes back and the
 * interface is merely as current as it was before any of this.
 *
 * **Reconnecting refetches; connecting does not.** `EventSource` reopens by itself after a drop,
 * and whatever changed while it was down was announced to nobody. A first connection is
 * different: the views have just fetched, so refetching them would cost every page load a second
 * round of every query on it.
 */

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { DEPLOYMENT_BASE } from '@/api/client';
import { invalidate, type Change } from '@/api/invalidate';

import { LiveContext } from './live-archive';

/** What the instance calls the two things it announces, and the third that names nothing. */
const AUDIO = 'audio';
const LIBRARY = 'library';
const RESYNC = 'resync';

const COALESCE_MS = 200;
/**
 * How long changes are gathered before the cache is told.
 *
 * One upload finishes three jobs -- probe, waveform, transcode -- and against a local archive
 * they land within about 120ms of each other. Acted on as they arrive that is three rounds of
 * invalidation where one would do, and on an import of fifty recordings it is worse than the
 * poll this replaces. Two hundred milliseconds is under the threshold at which somebody would
 * call a screen slow, and a burst about one recording becomes one refetch.
 */

/** What the wire carries: an identity, never contents. */
function uuidOf(data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null && 'uuid' in parsed) {
      return typeof parsed.uuid === 'string' ? parsed.uuid : null;
    }
  } catch {
    // A frame this client cannot read is not a reason to tear the stream down: the next one may
    // be fine, and the poll is still underneath it.
  }
  return null;
}

/** Everything on screen, for a reconnection and for the instance saying it lost our place. */
async function refetchEverything(client: QueryClient): Promise<void> {
  await client.invalidateQueries();
}

/**
 * Changes gathered over a short window and applied once each.
 *
 * Keyed by what the change is about, so a recording that three jobs finished on is invalidated
 * once and two recordings in the same window are still two.
 */
function coalescing(client: QueryClient): {
  add: (key: string, change: Change) => void;
  stop: () => void;
} {
  const pending = new Map<string, Change>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    const changes = [...pending.values()];
    pending.clear();
    for (const change of changes) void invalidate(client, change);
  };

  return {
    add: (key, change) => {
      pending.set(key, change);
      timer ??= setTimeout(flush, COALESCE_MS);
    },
    stop: () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
    },
  };
}

export function LiveArchive({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [live, setLive] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    // jsdom has none, and a browser too old to have one is a browser that polls.
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource(`${DEPLOYMENT_BASE}/api/events`);
    const gathered = coalescing(client);

    source.onopen = () => {
      setLive(true);
      if (opened.current) void refetchEverything(client);
      opened.current = true;
    };
    // Raised both for a drop it will retry and for one it will not, and the difference is not
    // worth reading: either way nothing is arriving, so the polling comes back until an `onopen`
    // says otherwise.
    source.onerror = () => {
      setLive(false);
    };
    source.addEventListener(AUDIO, (event: MessageEvent<string>) => {
      const uuid = uuidOf(event.data);
      if (uuid !== null)
        gathered.add(`${AUDIO}:${uuid}`, { kind: 'recording-settled', recording: uuid });
    });
    source.addEventListener(LIBRARY, (event: MessageEvent<string>) => {
      const uuid = uuidOf(event.data);
      if (uuid !== null) gathered.add(`${LIBRARY}:${uuid}`, { kind: 'library', library: uuid });
    });
    source.addEventListener(RESYNC, () => {
      void refetchEverything(client);
    });

    return () => {
      gathered.stop();
      source.close();
      setLive(false);
    };
  }, [client]);

  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}
