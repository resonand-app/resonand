/**
 * The results, grouped under the recording they were found in (`UI-16b`, `DEC-4`).
 *
 * A flat list of matches lets one long interview bury everything else: forty matches in a
 * three-hour recording are one result with forty matches, never forty results. So the unit here is
 * a recording, and what it carries -- the library it is in, when it was recorded, whether it has
 * been transcribed -- is what somebody uses to recognise it before they open anything.
 */

import { useNavigate } from 'react-router';

import { toRecording } from '@/app/routes';
import { ResultGroup } from '@/components/ResultGroup';
import { transcriptionState } from '@/features/library/recordings';
import { recordedAt } from '@/i18n/time';

import { useReadableLibraries } from './data';
import type { SearchResult } from './data';

export interface ResultsProps {
  results: readonly SearchResult[];
}

export function Results({ results }: ResultsProps) {
  const navigate = useNavigate();
  // Results span libraries, which is the difference between this screen and a library's grid: a
  // recording has to say where it lives, because "Sopar de Nadal" means one thing in the family
  // archive and another in somebody's field recordings.
  const names = new Map(useReadableLibraries().map((library) => [library.uuid, library.name]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {results.map(({ audio }) => (
        <ResultGroup
          key={audio.uuid}
          title={audio.title}
          meta={[names.get(audio.library_uuid), recordedAt(audio).text]
            .filter((part) => part !== undefined && part !== '')
            .join(' · ')}
          state={transcriptionState(audio.transcription_state)}
          matches={[]}
          onOpen={() => {
            void navigate(toRecording(audio.uuid));
          }}
        />
      ))}
    </div>
  );
}
