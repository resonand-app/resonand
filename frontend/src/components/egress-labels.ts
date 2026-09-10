/**
 * The egress notice's four sentences, in the reader's language (`UI-24c`, `UI-25a`).
 *
 * `EgressNotice` is presentational and ships English defaults so the standalone kit renders
 * (`DEC-22`). The application must always pass the real ones, and it must do it at every call
 * site -- the upload dialog, V5's call to action, the retry after a failure and the provider
 * page -- so the wording lives here rather than being retyped four times.
 *
 * A hook rather than a wrapper component on purpose: `UI-25b` asserts that any file asking for a
 * transcription also draws `EgressNotice` by name, and a wrapper would hide every call site from
 * the one test that guarantees no silent egress.
 */

import { useTranslation } from 'react-i18next';

import { HOST } from '@/design-system';

export interface EgressLabels {
  none: string;
  local: string;
  retry: string;
  external: string;
}

export function useEgressLabels(): EgressLabels {
  const { t } = useTranslation('common');
  return {
    none: t('egress.none'),
    local: t('egress.local', { host: HOST }),
    retry: t('egress.retry', { host: HOST }),
    external: t('egress.external', { host: HOST }),
  };
}
