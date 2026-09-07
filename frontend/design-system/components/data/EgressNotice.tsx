import type { ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

/**
 * Where audio goes to be transcribed, as `GET /transcription/destination` reports it (`API-12`).
 *
 * Readable by **any** authenticated caller, deliberately: a disclosure only administrators can
 * read is not a disclosure. That endpoint exists because of this component -- until it landed,
 * the provider's name was in an admin-only response and §3.4's rule was unimplementable for
 * exactly the people it protects.
 */
export interface TranscriptionDestination {
  /** "openai", "whisper", whatever the instance is configured with. */
  provider: string;
  /** Host and port, without any userinfo. `null` when nothing is configured. */
  host: string | null;
  /** Whether it is on the instance's own network. Pessimistic: unplaceable means not local. */
  is_local: boolean;
  configured: boolean;
}

export interface EgressNoticeProps {
  destination: TranscriptionDestination;
  /**
   * `panel` and `dialog` are the same words in the same box; `retry` puts the action on the same
   * row, because there the sentence is about the button beside it.
   */
  placement?: 'panel' | 'dialog' | 'retry';
  /** The retry control, for `placement="retry"`. */
  action?: ReactNode;
}

/**
 * Where the audio goes, before it goes (`UI-34n`, §3.4).
 *
 * The only implementation of the product's second principle, which is why it is a component and
 * not a sentence somebody remembers to write: **wherever a transcription is requested, the
 * interface names the provider and says whether the audio leaves the instance, before the request
 * is made.** The upload dialog, V5's call to action, the retry after a failure, and any bulk path.
 * There is no silent egress anywhere.
 *
 * **Two registers, because there are two genuinely different cases.** The reference deployment is
 * a `faster-whisper` server on the same machine, and telling somebody their audio is being sent
 * somewhere when it is going to their own network is both false and the kind of false that
 * teaches people to ignore the notice. A local setup is calm and takes `--text-3`; an external one
 * is factual and takes the accent. Neither is a warning banner: no red, no exclamation mark, no
 * icon that means danger.
 *
 * **The third case is nothing configured at all**, which is not an error either. It says what is
 * true -- nothing can be transcribed until an administrator sets a provider up -- rather than
 * offering a retry for something that cannot be attempted.
 *
 * The wording lives here rather than at the call sites, so that the sentence somebody reads
 * before their recording leaves the machine is one sentence with one author, and `UI-25b`'s test
 * has one thing to look for.
 */
export function EgressNotice({ destination, placement = 'panel', action }: EgressNoticeProps) {
  const { provider, host, is_local: local, configured } = destination;
  const where = host ?? provider;

  const tone: 'none' | 'local' | 'external' = !configured ? 'none' : local ? 'local' : 'external';
  const glyph: IconName =
    tone === 'none' ? 'circle-dashed' : tone === 'local' ? 'hard-drive' : 'cloud-upload';

  const sentence =
    tone === 'none' ? (
      <>
        No transcription provider is configured. Nothing can be transcribed until an administrator
        sets one up.
      </>
    ) : tone === 'local' ? (
      <>
        Transcription runs on <Host>{where}</Host>, on your own network. The audio does not leave
        it.
      </>
    ) : placement === 'retry' ? (
      <>
        Retrying sends the audio to <Host>{where}</Host> again.
      </>
    ) : (
      <>
        Transcription is sent to <Host>{where}</Host>. The audio leaves this instance.
      </>
    );

  return (
    <div
      data-ds="egress-notice"
      data-tone={tone}
      style={{
        display: 'flex',
        alignItems: placement === 'retry' ? 'center' : 'flex-start',
        gap: placement === 'retry' ? 12 : 11,
        flexWrap: placement === 'retry' ? 'wrap' : 'nowrap',
        padding: '12px 13px',
        borderRadius: 'var(--radius-control)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span data-ds="egress-glyph" aria-hidden style={{ display: 'flex', paddingTop: 1 }}>
        <Icon name={glyph} size={17} />
      </span>
      <p
        style={{
          margin: 0,
          flex: 1,
          minWidth: 190,
          fontSize: 'var(--type-ui-size-sm)',
          lineHeight: 1.55,
          color: 'var(--text-2)',
          textWrap: 'pretty',
        }}
      >
        {sentence}
      </p>
      {action}
    </div>
  );
}

/** A host name is a fact you might have to type somewhere else, so it is mono and full strength. */
function Host({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{children}</span>
  );
}
