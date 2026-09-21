/**
 * Reading a recording's shape off the wire (`UI-31b`, `ING-5`, `ING-14`).
 *
 * `GET /api/audio/{uuid}/waveform` is the one endpoint that does not answer JSON. It serves the
 * peaks as the compact binary they are stored as, because expanding them would make the two
 * places the waveform is drawn smallest -- eighty cards on the landing page, a twenty-pixel
 * column in the dense list -- cost tens of megabytes to draw pictures a centimetre wide.
 *
 * So this is deliberately not in `client.ts`. That wrapper's contract is that every call is
 * checked against the published document and resolves to a typed body; a binary response has no
 * body type to check against, and threading an `arrayBuffer` branch through it would make every
 * JSON call read as though it might not be one. What it does share is the part that matters:
 * the same origin, the same cookie, and the same `ApiProblem` on failure, so a caller catches
 * one kind of error here as everywhere else.
 *
 * **The version byte is refused rather than assumed.** A blob written by a newer instance read as
 * though it were this format produces a plausible-looking picture of the wrong recording, which
 * is the one class of bug nobody ever reports. Both formats the backend writes are read here,
 * and anything else throws.
 */

import { useQuery } from '@tanstack/react-query';

import { DEPLOYMENT_BASE } from './client';
import { keys } from './keys';
import { ApiProblem, problemFrom, unreachable } from './problem';

/** Interleaved `min, max` per bucket, each in -1…1 -- the shape `Waveform` takes. */
export type Peaks = readonly number[];

/** The format the backend writes: version, duration in ms, bucket count, then int8 pairs. */
const HEADER_BYTES = 9;

/** Version 1: version, peaks per second, bucket count. Still served by an instance not yet re-derived. */
const HEADER_V1_BYTES = 6;

/** `MAX_PEAK` in `resonand.media.waveform`. What an int8 peak is divided by to reach -1…1. */
const MAX_PEAK = 127;

export interface Waveform {
  /** How much time the picture covers. Stored rather than derived, so it survives resampling. */
  durationMs: number;
  peaks: Peaks;
}

/**
 * Unpack a stored waveform.
 *
 * The pairs are read as signed bytes, which `DataView.getInt8` does and `Uint8Array` does not --
 * a quiet passage is a small negative number, and read unsigned it becomes a loud one.
 */
export function decodeWaveform(blob: ArrayBuffer): Waveform {
  if (blob.byteLength < HEADER_V1_BYTES) {
    throw new Error('This is too short to be a waveform.');
  }
  const view = new DataView(blob);
  const version = view.getUint8(0);
  const { durationMs, count, offset } = headerOf(view, version);
  const available = Math.min(count, Math.floor((blob.byteLength - offset) / 2));
  const peaks: number[] = new Array<number>(available * 2);
  for (let index = 0; index < available * 2; index += 1) {
    peaks[index] = view.getInt8(offset + index) / MAX_PEAK;
  }
  return { durationMs, peaks };
}

function headerOf(
  view: DataView,
  version: number,
): { durationMs: number; count: number; offset: number } {
  if (version === 1) {
    // A rate and a count give a duration exactly, which is why version 1 is read rather than
    // refused: there is nothing to guess.
    const perSecond = view.getUint8(1);
    const count = view.getUint32(2, true);
    return {
      durationMs: perSecond === 0 ? 0 : Math.round((count * 1000) / perSecond),
      count,
      offset: HEADER_V1_BYTES,
    };
  }
  if (version !== 2) {
    throw new Error(
      `This waveform is in format version ${String(version)} and this build reads 1 and 2. ` +
        'Peaks are derived data: recompute them.',
    );
  }
  return {
    durationMs: view.getUint32(1, true),
    count: view.getUint32(5, true),
    offset: HEADER_BYTES,
  };
}

/**
 * Fetch a recording's peaks, reduced to the number of buckets a drawing has room for.
 *
 * `peaks` is what makes this affordable: a 48-minute recording stores about 28,800 pairs, and a
 * library card draws them into 320 pixels. Asking for more than are stored returns what is
 * stored -- the server does not invent the difference, and neither does the client.
 */
export async function fetchWaveform(
  uuid: string,
  buckets: number,
  signal?: AbortSignal,
): Promise<Waveform> {
  const url = `${DEPLOYMENT_BASE}/api/audio/${encodeURIComponent(uuid)}/waveform?peaks=${String(buckets)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      headers: { accept: 'application/octet-stream' },
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw unreachable(cause);
  }
  if (!response.ok) throw await problemFrom(response);
  return decodeWaveform(await response.arrayBuffer());
}

/**
 * How many pairs each drawing has room for.
 *
 * Asking for the stored 28,800 pairs of a 48-minute recording to draw a picture 320 pixels wide
 * would be a megabyte for a thumbnail, and 20 pixels of dense row is worse (`ING-14`). The server
 * reduces on the way out and `resamplePeaks` reduces again to the pixels actually available, with
 * the same arithmetic on both sides so one recording draws one shape everywhere.
 */
export const BUCKETS = { card: 160, row: 40, detail: 1200 } as const;

/**
 * A recording's peaks, cached for as long as the tab lives.
 *
 * `staleTime: Infinity` because peaks are derived from a file that does not change: a recording
 * whose waveform has been computed has the same waveform for ever, and the one transition that
 * matters -- not computed, then computed -- is a change to `has_waveform` on the recording, which
 * is what `enabled` reads.
 */
export function useWaveform(
  uuid: string,
  buckets: number,
  enabled: boolean,
): { peaks: Peaks | undefined; pending: boolean } {
  const query = useQuery({
    queryKey: keys.waveform(uuid, buckets),
    queryFn: ({ signal }) => fetchWaveform(uuid, buckets, signal),
    enabled: enabled && uuid !== '',
    staleTime: Infinity,
  });
  return { peaks: query.data?.peaks, pending: query.data === undefined };
}

export { ApiProblem };
