/**
 * The technical section, collapsed (`UI-13d`, §V5).
 *
 * Seven fields, mono throughout, behind a disclosure that starts closed -- because a sample rate
 * is a fact somebody looks up twice a year and the panel above it is what they came for. §V5
 * lists exactly these seven and this shows exactly these seven: a field a design promises that
 * the API cannot fill is a promise somebody has to break, and `AudioDetail` fills all of them or
 * says `null`.
 *
 * **The hash is the one that matters, and it is copyable.** Principle 1 is that the original is
 * kept byte for byte, and `sha256` is what makes that claim checkable: somebody with the file on
 * their own disk can run `sha256sum` and compare. A hash you have to select by eye across 64
 * characters is a hash nobody checks, so there is a control that copies it.
 *
 * A `null` is shown as such rather than left blank. A recording whose probe has not run yet has
 * no sample rate, and an empty row reads as a value that failed to load.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, KeyValueList } from '@/design-system';
import * as format from '@/i18n/format';

import type { RecordingDetail } from './data';

/** How long the control says it copied before going back to offering to. */
const CONFIRMED_MS = 2000;

export function TechnicalDetails({ recording }: { recording: RecordingDetail }) {
  const { t } = useTranslation('recording');
  const unknown = t('technical.unknown');

  return (
    <details data-app="technical">
      <summary
        style={{
          cursor: 'pointer',
          padding: 'var(--space-2) 0',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-2)',
        }}
      >
        {t('technical.heading')}
      </summary>
      <div style={{ paddingTop: 'var(--space-2)' }}>
        <KeyValueList
          rows={[
            { key: t('technical.filename'), value: recording.original_filename ?? unknown },
            { key: t('technical.mime'), value: recording.mime ?? unknown },
            {
              key: t('technical.size'),
              value: recording.size_bytes === null ? unknown : format.bytes(recording.size_bytes),
            },
            {
              key: t('technical.sampleRate'),
              value:
                recording.sample_rate === null
                  ? unknown
                  : t('technical.hertz', { value: format.count(recording.sample_rate) }),
            },
            {
              key: t('technical.channels'),
              value:
                recording.channels === null
                  ? unknown
                  : t('technical.channelCount', { count: recording.channels }),
            },
            { key: t('technical.codec'), value: recording.codec ?? unknown },
            {
              key: t('technical.hash'),
              value: recording.sha256 === null ? unknown : <Hash value={recording.sha256} />,
            },
          ]}
        />
      </div>
    </details>
  );
}

/**
 * The hash, with a way to take it somewhere it can be compared.
 *
 * The clipboard can refuse -- an insecure origin, a browser that asks first, a permission
 * somebody declined -- and there is nothing useful to say about that: the hash is on the screen
 * and selectable, which is the fallback. So a refusal leaves the control offering to copy rather
 * than claiming it did.
 */
function Hash({ value }: { value: string }) {
  const { t } = useTranslation('recording');
  const [copied, setCopied] = useState(false);

  return (
    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
      <Button
        variant="ghost"
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, CONFIRMED_MS);
            })
            .catch(() => {
              // Nothing to say. The value is on the screen and can be selected.
            });
        }}
      >
        {copied ? t('technical.copied') : t('technical.copy')}
      </Button>
    </span>
  );
}
