/**
 * V10 · What this instance is, and where its source is (`UI-38`).
 *
 * **This is a licence obligation, not a credit line.** `AGPL-3.0` section 13 is the clause this
 * project chose the licence over `GPL` for: somebody who only ever meets Resonand through a
 * browser, on somebody else's server, is owed its Corresponding Source. Before this there was no
 * link, no About surface and no licence line anywhere in the signed-in interface -- the only
 * licence string the instance emitted was the OpenAPI document's, which points at gnu.org, and
 * that is the licence text rather than the source.
 *
 * It sits under the section tabs rather than inside one of them, so it is on screen whichever
 * section somebody opened. Section 13 asks for a *prominent* offer, and a line reachable only by
 * guessing which tab hides it is not one.
 *
 * The link does not depend on the API. The version does -- it comes from `GET /instance` -- so the
 * sentence has a second form for the moment before that answers, or for an instance whose API is
 * unreachable. Offering the source is the part that must not be contingent on anything.
 */

import { useTranslation } from 'react-i18next';

import { useInstance } from '@/app/session';

export function About() {
  const { t } = useTranslation('settings');
  const instance = useInstance();
  const version = instance.data?.version;

  return (
    <p
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-2)',
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        color: 'var(--text-3)',
      }}
    >
      <span>
        {version === undefined ? t('about.unknownVersion') : t('about.offer', { version })}
      </span>
      <a
        data-hit-target
        href={__SOURCE_URL__}
        // It leaves the application, and an archive somebody is part-way through reading is not a
        // thing to navigate away from to look at a repository.
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--accent)' }}
      >
        {t('about.source')}
      </a>
    </p>
  );
}
