/**
 * A recording that is not finished being made, and how often to ask again (`FBK-3`).
 *
 * A recording exists the moment its bytes land, and four things happen to it afterwards -- probe,
 * waveform, transcode, transcribe -- none of which the upload waits for (`JOB-1`). So the card
 * that appears at the end of an upload is a card with no duration and no shape, and on a small
 * file every one of those jobs has finished about three seconds later. Nothing was asking, and
 * `invalidate({kind: 'upload'})` fires once, at the one moment those fields are guaranteed absent.
 *
 * **Two clocks, because two different things are being waited for.** A missing duration or a
 * missing waveform is seconds of work and is worth three seconds of impatience. A transcription is
 * minutes or hours of somebody else's queue, and a badge that changes within half a minute of the
 * truth is a badge that is right.
 *
 * **A recording stops being watched once it is old, whatever it is missing.** A probe that failed
 * leaves `duration_ms` null forever, and a predicate that read only the fields would poll that row
 * for as long as the tab stayed open. Age is the bound, and it is honest about what it means: a
 * derivative that has not arrived in `WATCH_FOR_MS` is not arriving in the next three seconds, and
 * the queue in Administration is where a failure that old is answered rather than here.
 *
 * Nothing here polls an archive at rest. Every interval is `false` unless a row says otherwise,
 * which is what makes this affordable on an instance that is only ever read.
 */

/** How often to ask while a derivative is missing from a recording that has just arrived. */
export const SETTLING_POLL_MS = 3_000;

/** How often to ask while a transcription is running. Half a minute is close enough for a badge. */
export const RUNNING_POLL_MS = 30_000;

/** How long after it arrived a recording is still expected to be growing its derivatives. */
export const WATCH_FOR_MS = 15 * 60_000;

/** The fields this reads. Both `AudioSummary` and `AudioDetail` carry every one of them. */
export interface Settling {
  created_at: string;
  duration_ms: number | null;
  has_waveform: boolean;
  transcription_state: string;
}

/** Whether a recording arrived recently enough that its derivatives are still expected. */
function isYoung(recording: Settling, now: number): boolean {
  const arrived = Date.parse(recording.created_at);
  // An unparseable date is not a reason to poll forever. It is a reason to stop.
  return Number.isFinite(arrived) && now - arrived < WATCH_FOR_MS;
}

/** Whether the probe and the waveform job have both landed. */
function hasDerivatives(recording: Settling): boolean {
  return recording.duration_ms !== null && recording.has_waveform;
}

/**
 * How often a view drawing these recordings should ask again, or `false` for not at all.
 *
 * Takes the whole list rather than one row because that is what the answer is about: one row still
 * being made is the whole list being out of date, and the fastest thing anybody is waiting for is
 * what sets the pace.
 */
export function intervalFor(recordings: readonly Settling[], now = Date.now()): number | false {
  let running = false;
  for (const recording of recordings) {
    if (!hasDerivatives(recording) && isYoung(recording, now)) return SETTLING_POLL_MS;
    if (recording.transcription_state === 'running') running = true;
  }
  return running ? RUNNING_POLL_MS : false;
}

/** The same answer for a single recording, which is what the detail view has. */
export function intervalForOne(recording: Settling | undefined, now = Date.now()): number | false {
  return recording === undefined ? false : intervalFor([recording], now);
}
