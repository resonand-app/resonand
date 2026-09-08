/**
 * The four transcription states, as toggles (`UI-8c`, §V3, §1.2).
 *
 * **They share `StateBadge`'s vocabulary, so a toggle and a badge cannot say different words.**
 * The four live in `transcription-states.ts` for exactly this reason -- the badge is not the only
 * thing that has to name them, and two lists in two files is how they come to disagree. The
 * translation is the interface's; the order and the glyphs are the system's.
 *
 * **Repeatable, and any of them means either.** The API takes `transcription_state` more than
 * once and unions what it is given (`JOB-11b`), so three toggles on is one request rather than
 * three -- and none on means every state, which is why there is no "all" toggle: it is the
 * absence of the others.
 */

import { useTranslation } from 'react-i18next';

import { Chip, Icon, TRANSCRIPTION_STATES, TRANSCRIPTION_STATE_NAMES } from '@/design-system';
import type { TranscriptionState } from '@/design-system';

export interface StateTogglesProps {
  value: TranscriptionState[];
  onChange: (states: TranscriptionState[]) => void;
}

export function StateToggles({ value, onChange }: StateTogglesProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('transcription.group')}
      style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
    >
      {TRANSCRIPTION_STATE_NAMES.map((state) => {
        const on = value.includes(state);
        return (
          <Chip
            key={state}
            as="button"
            active={on}
            aria-pressed={on}
            onClick={() => {
              onChange(on ? value.filter((one) => one !== state) : [...value, state]);
            }}
          >
            <Icon name={TRANSCRIPTION_STATES[state].icon} size={13} />
            {t(`transcription.${state}`)}
          </Chip>
        );
      })}
    </div>
  );
}
