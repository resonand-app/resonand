/**
 * The route that is not a route (`UI-4a`).
 *
 * It says the address has nothing at it, and it does **not** say the thing is not yours -- for
 * the same reason §1.9 forbids that everywhere else: 404 is all the interface knows, and
 * guessing at permission is how somebody is told a recording exists.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, StateCard } from '@/design-system';

import { routes } from '@/app/routes';

export function NotFound() {
  const { t } = useTranslation('shell');
  const navigate = useNavigate();
  return (
    <StateCard
      icon="alert-circle"
      title={t('notFound.title')}
      body={t('notFound.detail')}
      action={
        <Button
          onClick={() => {
            void navigate(routes.libraries);
          }}
        >
          {t('notFound.action')}
        </Button>
      }
    />
  );
}
