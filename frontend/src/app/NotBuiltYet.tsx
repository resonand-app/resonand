/**
 * A route with no view behind it yet (`UI-4a`).
 *
 * Scaffolding, and deliberately obvious about it. `UI-4a` builds the routing, the guard and the
 * shell; the views are Phase E, and each one replaces its line in `App.tsx` as it lands. Saying
 * so on the screen is better than an empty page that looks like a bug in the router.
 */

import { useTranslation } from 'react-i18next';

import { StateCard } from '@/design-system';

export function NotBuiltYet({ view }: { view: string }) {
  const { t } = useTranslation('shell');
  return <StateCard title={t('notBuilt.title')} body={t('notBuilt.detail')} footnote={view} />;
}
