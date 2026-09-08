/**
 * The results, grouped under the recording they were found in (`UI-16d`, `DEC-4`, §V6).
 *
 * A flat list of matches lets one long interview bury everything else: forty matches in a
 * three-hour recording are one result with forty matches, never forty results. So the unit here is
 * a recording, and what it carries -- the library it is in, when it was recorded, whether it has
 * been transcribed -- is what somebody uses to recognise it before they open anything.
 *
 * **Three matches, and then a count.** The database groups them and sends the best three with
 * `total_matches` beside them, so `+N more` opens the recording at its transcript rather than
 * revealing a fourth line that was never sent. Past three the question has stopped being which
 * recording and started being where in it, and that is the transcript's screen.
 *
 * **Each match carries the fragment the database marked and the moment it is at.** The fragment
 * arrives with `<mark>` around what matched and is rendered as marking rather than as markup
 * (`fragment.tsx`); the timestamp is the same `18:04` shape a transcript line uses, because it is
 * the same thing -- a place in a recording, not a length.
 *
 * **Pressing a match plays from that moment and stays here** (`UI-16e`). That is the behaviour the
 * screen exists for: you found the moment, you heard it, you keep looking. Navigating to the
 * detail view instead would defeat it -- three matches in three recordings would be three
 * round trips through a screen nobody asked to be on, and the results you were comparing would be
 * gone. The player is global and outlives every view (`UI-5a`), so nothing about playing here
 * needs a route: the recording is handed to it and asked to start at `start_ms`.
 */

import { useNavigate } from 'react-router';

import { toRecording } from '@/app/routes';
import { usePlayback } from '@/player/store';
import { ResultGroup } from '@/components/ResultGroup';
import type { ResultMatch } from '@/components/ResultGroup';
import { transcriptionState } from '@/features/library/recordings';
import { timestamp } from '@/i18n/format';
import { recordedAt } from '@/i18n/time';

import { useReadableLibraries } from './data';
import type { SearchResult } from './data';
import { marked } from './fragment';

export interface ResultsProps {
  results: readonly SearchResult[];
}

export function Results({ results }: ResultsProps) {
  const navigate = useNavigate();
  // Results span libraries, which is the difference between this screen and a library's grid: a
  // recording has to say where it lives, because "Sopar de Nadal" means one thing in the family
  // archive and another in somebody's field recordings.
  const libraries = useReadableLibraries();
  const names = new Map(libraries.map((library) => [library.uuid, library.name]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {results.map((result) => {
        const { audio } = result;
        const matches: ResultMatch[] = result.matches.map((match, index) => ({
          // The API sends no id per match, so the position is the key. It is stable for as long
          // as the row is on screen, which is what a key is for -- these are not reordered.
          id: `${audio.uuid}-${String(index)}`,
          at: match.start_ms === null ? '' : timestamp(match.start_ms),
          text: marked(match.fragment),
          startMs: match.start_ms,
        }));

        return (
          <ResultGroup
            key={audio.uuid}
            title={audio.title}
            meta={[names.get(audio.library_uuid), recordedAt(audio).text]
              .filter((part) => part !== undefined && part !== '')
              .join(' · ')}
            state={transcriptionState(audio.transcription_state)}
            matches={matches}
            total={result.total_matches}
            onOpen={() => {
              void navigate(toRecording(audio.uuid));
            }}
            onPlay={(match) => {
              if (match.startMs === null || match.startMs === undefined) return;
              const playback = usePlayback.getState();
              // The same recording already loaded is seeked rather than restarted: reloading it
              // would drop the buffer and start the three hours again at the new position.
              if (playback.recording?.uuid !== audio.uuid) {
                playback.play({
                  uuid: audio.uuid,
                  title: audio.title,
                  library: names.get(audio.library_uuid) ?? '',
                  durationMs: audio.duration_ms,
                  hasWaveform: audio.has_waveform,
                });
              }
              playback.seek(match.startMs);
            }}
            onShowAll={() => {
              void navigate(toRecording(audio.uuid));
            }}
          />
        );
      })}
    </div>
  );
}
