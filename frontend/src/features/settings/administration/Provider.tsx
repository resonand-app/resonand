/**
 * The transcription provider (`INT-3c`, §V10, §3.4).
 *
 * **Opening this page contacts nothing.** `reachable` is `null` until somebody presses Test, and
 * that is a design decision rather than a loading state: a page that quietly reached out to draw
 * a green dot would be a smaller version of the violation principle 2 exists to prevent. So the
 * test is a button, its result is shown as the answer to a question somebody asked, and the
 * unknown state says it is unknown rather than pretending to be a failure.
 *
 * **The credential is never shown, in any form.** What an administrator needs to know is whether
 * one is set, which is what `has_credential` says. There is no field to reveal, no masked value
 * and no copy control, because none of those can exist without the API sending the secret.
 *
 * **The egress disclosure is here in its calm register.** §3.4 says the instance states what
 * leaves it and to where at every point audio might go, and this page is where an operator
 * decides that in the first place -- so the same component says the same thing here as it says
 * beside an upload switch, rather than this page inventing its own wording for it.
 *
 * **No provider configured is not an error.** Nothing on the instance can be transcribed, which
 * is a fact to state plainly, not a failure to offer a retry for.
 *
 * **What a check found outlives the view it was run from, and says when it was run.** It is held
 * beside the configuration rather than inside it (`useProviderCheck`), because it is an
 * observation about a third party at a moment rather than something the instance knows -- and a
 * verdict that survives a navigation is a claim about the past, so the moment is on screen with
 * it.
 */

import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { useNow } from '@/app/hooks/use-now';
import { Button, EgressNotice, KeyValueList, StateCard } from '@/design-system';
import type { KeyValueRow } from '@/design-system';
import { relative } from '@/i18n/time';
import { useEgressLabels } from '@/i18n/egress-labels';

import { AdminSection } from './AdminSection';
import { useProvider, useProviderCheck, useTestProvider } from './data';
import type { ProviderCheck } from './data';

/** Below this, "just now" is the honest reading -- `Intl` has no phrase for "not yet a minute". */
const MINUTE_MS = 60_000;

export function Provider() {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation();
  const egressLabels = useEgressLabels();
  const provider = useProvider();
  const check = useProviderCheck();
  const test = useTestProvider();

  if (provider.isPending) {
    return (
      <AdminSection title={t('provider.title')}>
        <StateCard icon="loader" title={t('provider.loading')} />
      </AdminSection>
    );
  }

  if (provider.data === undefined) {
    return (
      <AdminSection title={t('provider.title')}>
        <StateCard
          icon="alert-circle"
          title={common('state.failed')}
          body={isApiProblem(provider.error) ? provider.error.detail : common('state.offline')}
        />
      </AdminSection>
    );
  }

  const status = provider.data;
  const rows: KeyValueRow[] = [
    { key: t('provider.name'), value: status.provider },
    { key: t('provider.model'), value: status.model },
    { key: t('provider.baseUrl'), value: status.base_url ?? t('provider.noBaseUrl') },
    {
      key: t('provider.language'),
      value: status.default_language ?? t('provider.detected'),
    },
    {
      // Whether a credential is set, never the credential. There is nothing here to reveal
      // because the API does not send it in any form.
      key: t('provider.credential'),
      value: status.has_credential ? t('provider.credentialSet') : t('provider.credentialUnset'),
    },
  ];

  return (
    <AdminSection title={t('provider.title')} description={t('provider.intro')}>
      {/* §3.4's disclosure, in the same words it uses beside an upload switch. This page is
          where an operator chooses where audio goes, so it is the one place the sentence must
          not be a local paraphrase. */}
      <EgressNotice
        destination={{
          provider: status.provider,
          host: status.base_url,
          is_local: isLocal(status.base_url),
          configured: status.configured,
        }}
        placement="panel"
        labels={egressLabels}
      />
      {status.configured ? (
        <>
          <KeyValueList rows={rows} layout="inline" />
          <Reachability
            check={check}
            isPending={test.isPending}
            onTest={() => {
              test.mutate();
            }}
          />
        </>
      ) : (
        /* Not an error, and no retry: there is nothing to retry until somebody configures one.
           `EgressNotice` above already says nothing can be transcribed; this says what to do. */
        <p
          style={{
            margin: 0,
            maxWidth: 520,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-2)',
          }}
        >
          {t('provider.unconfigured')}
        </p>
      )}
    </AdminSection>
  );
}

/**
 * Whether it can transcribe, and the button that is the only way to find out.
 *
 * **Answering and being usable are two questions** (`TRX-10`). An endpoint can accept every
 * request made of it and still run a model that returns prose with no timings, which this archive
 * cannot store -- and that is the likeliest misconfiguration on this page, not an address nobody
 * is listening at. A control reporting only the first would go green on it, so the middle state
 * is named: it answered, and it still cannot do this.
 *
 * Unknown is the state the page opens in, and it says so -- an unknown that rendered as a failure
 * would train an operator to ignore a real one. It is also the state a check leaves behind when it
 * could not be run at all, which is why its sentence is shown beside it.
 */
function Reachability({
  check,
  isPending,
  onTest,
}: {
  check: ProviderCheck | undefined;
  isPending: boolean;
  onTest: () => void;
}) {
  const { t, i18n } = useTranslation('settings');
  // The verdict has an age the moment it is written, and nothing else on this panel re-renders
  // it: the configuration behind it is settled, so the label would sit at "just now" all evening.
  const now = useNow();
  // No check, and a check that contacted nobody, are the same state: the one the page opens in.
  const reachable = check?.reachable ?? null;
  const verdict =
    reachable === null
      ? { label: t('provider.untested'), colour: 'var(--text-3)' }
      : check?.usable === true
        ? { label: t('provider.usable'), colour: 'var(--state-done)' }
        : reachable
          ? { label: t('provider.unusable'), colour: 'var(--state-failed)' }
          : { label: t('provider.unreachable'), colour: 'var(--state-failed)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <Button variant="secondary" busy={isPending} disabled={isPending} onClick={onTest}>
          {isPending ? t('provider.testing') : t('provider.test')}
        </Button>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: verdict.colour,
          }}
        >
          {verdict.label}
        </span>
        {check !== undefined && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {now - Date.parse(check.checkedAt) < MINUTE_MS
              ? t('provider.checkedJustNow')
              : t('provider.checkedAt', {
                  when: relative(check.checkedAt, i18n.language, new Date(now)),
                })}
          </span>
        )}
      </div>
      {/* Shown whenever a check has run, rather than only when something answered: the case in
          which nothing was contacted at all is the one whose sentence explains why. */}
      {check !== undefined && check.detail !== '' && (
        <span
          style={{
            maxWidth: 520,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
            overflowWrap: 'anywhere',
          }}
        >
          {check.detail}
        </span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
        }}
      >
        {t('provider.neverAutomatic')}
      </span>
    </div>
  );
}

/**
 * Whether a base URL points at this machine or its own network.
 *
 * The same judgement `GET /transcription/destination` makes for everybody else (`API-12`), made
 * here because the administrator-only `ProviderStatus` reports the URL rather than the verdict.
 * It errs towards calling something external: a host it cannot parse is not treated as local,
 * because the cost of being wrong in that direction is a notice that is too careful, and the
 * cost in the other direction is silent egress.
 */
function isLocal(baseUrl: string | null): boolean {
  if (baseUrl === null || baseUrl === '') return false;
  try {
    const { hostname } = new URL(baseUrl);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      !hostname.includes('.')
    );
  } catch {
    return false;
  }
}
