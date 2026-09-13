/**
 * Carrying the position forward between reports (`UI-2a`, §3.1).
 *
 * The audio element is asked where it is four times a second, and two clocks do the asking -- an
 * interval, and the element's own `timeupdate`. They drift against each other, so the gap between
 * two consecutive reports is anywhere from 20ms to 250ms. A drawing that moved only when told
 * steps at that rhythm; one that eases towards each report swings between stalling and sprinting
 * as the gap changes, which is the same jerk with the edges rounded off.
 *
 * So a report is an anchor and not an instruction. Between anchors the drawing works out where
 * the position must be by now, which makes the motion a function of the clock rather than of when
 * a message happened to arrive. A late report re-anchors to a value a few milliseconds different
 * -- a fraction of a pixel -- and an early one costs nothing at all.
 *
 * Its own module so that `Waveform.tsx` exports only a component, which is what lets fast refresh
 * replace it without remounting the tree it sits in.
 */

/**
 * Where the position is `seconds` after a report of `played`.
 *
 * `advance` is how much of the whole recording a second of playback covers, so it already carries
 * the speed: at 2x a drawing moves twice as far between two anchors, without this knowing that
 * playback rates exist.
 */
export function predicted(played: number, seconds: number, advance: number): number {
  return Math.min(1, Math.max(0, played + seconds * advance));
}

/**
 * How long a drawing may stay ahead of a report before the report wins.
 *
 * One report interval with room to spare. Inside it the drawing is ahead because it carried the
 * position forward correctly and the report is the stale one; beyond it the drawing is ahead
 * because it was carried forward from the wrong moment, and no amount of waiting fixes that.
 */
const HOLD_MS = 400;

/**
 * Where to draw when a report lands behind what is already drawn.
 *
 * A report can sit a few milliseconds behind the drawing without being wrong: `currentTime` is
 * quantised to the audio callback, so a position arrives paired with a moment slightly after it
 * was true. Following it back flinches the playhead, which is the one movement nobody misses --
 * so across that gap the drawing holds.
 *
 * **The hold is bounded, and that is the whole point.** An unbounded one keeps whatever the
 * drawing reached, including a position predicted from an anchor that stopped being true --
 * which is what stranded the playhead for the length of every pause, with the sound playing on
 * underneath it. Further ahead than one report's worth of travel is not quantisation, it is a
 * drawing that has run away from the sound, and the sound wins.
 */
export function held(drawn: number, played: number, advance: number): number {
  const ahead = drawn - played;
  return ahead > 0 && ahead <= advance * (HOLD_MS / 1000) ? drawn : played;
}
