/**
 * V6 · Search (`UI-16b`, §V6).
 *
 * The reason the product exists: type a word, be at the moment three seconds later. The nav
 * dropdown answers the fast half of that (`UI-16a`); this is the other half, and the two are not
 * alternatives -- they answer different questions over one endpoint.
 *
 * **Two numbers, and both matter.** How many recordings matched, and how many matches were found
 * in them. A search that says "20 results" over a page of twenty when three hundred recordings
 * matched is the one thing §V6 says this screen must not do, so the count comes from the page
 * envelope's `total` and never from `items.length`.
 *
 * **The page is not in the URL, and the query is** (§2.1). A query and its filters are what
 * somebody links and reloads into; which twenty of three hundred they had scrolled to is not, and
 * a page number in the address would be a link that goes stale the moment anything is uploaded.
 * Which is also why changing a filter puts you back on the first page: page 8 of the old results
 * is not page 8 of the new ones.
 *
 * **The field is here only on a phone.** The nav's search field does not exist there (§2.3) and
 * the Search tab's resting state is this screen with an empty query, so without one the flagship
 * feature would be a tab you cannot type into. On the desktop the nav field is the input, and a
 * second one on the same screen would be two places to change one thing.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PAGE_SIZE } from '@/api/paged';
import { useIsPhone } from '@/app/use-is-phone';
import { useUrlState } from '@/app/url-state';
import { Button, PageHeader, SearchField } from '@/design-system';
import { count as formatCount } from '@/i18n/format';

import { Results } from './Results';
import { useSearch } from './data';

export function SearchView() {
  const { t } = useTranslation('search');
  const { filters, set } = useUrlState();
  const isPhone = useIsPhone();
  // Which page, and which search it is a page of. Kept together so that a new query is on its
  // first page without an effect running after the wrong page has already been asked for.
  const [paging, setPaging] = useState({ of: '', page: 0 });
  const asked = JSON.stringify(filters);
  const page = paging.of === asked ? paging.page : 0;
  const results = useSearch(filters, { limit: PAGE_SIZE, offset: page * PAGE_SIZE });

  const query = filters.q ?? '';
  const from = page * PAGE_SIZE;
  // What was found in the recordings on this page. The envelope counts recordings, not matches,
  // so this is the only matches number that can be stated without inventing one -- and when there
  // is more than one page it says which recordings it counted.
  const matches = results.items.reduce((sum, result) => sum + result.total_matches, 0);
  const paginated = results.total > PAGE_SIZE;

  return (
    <section>
      <PageHeader
        title={query === '' ? t('title') : query}
        {...(results.total === 0
          ? {}
          : {
              meta: [
                t('common:count.recordings', { count: results.total }),
                t(paginated ? 'found.onThisPage' : 'found.matches', { count: matches }),
              ].join(' · '),
            })}
      />
      {isPhone && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SearchField
            value={query}
            placeholder={t('field')}
            shortcut={null}
            onChange={(event) => {
              set({ q: event.target.value });
            }}
          />
        </div>
      )}
      <Results results={results.items} />
      {paginated && (
        <nav
          aria-label={t('pages.label')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-5)',
          }}
        >
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => {
              setPaging({ of: asked, page: page - 1 });
            }}
          >
            {t('pages.previous')}
          </Button>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {t('pages.showing', {
              from: formatCount(from + 1),
              to: formatCount(from + results.items.length),
              total: formatCount(results.total),
            })}
          </span>
          <Button
            variant="secondary"
            disabled={!results.hasMore}
            onClick={() => {
              setPaging({ of: asked, page: page + 1 });
            }}
          >
            {t('pages.next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
