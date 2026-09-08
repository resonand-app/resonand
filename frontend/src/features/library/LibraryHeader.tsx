/**
 * The head of V3 and V4 (`UI-6a`, §V3).
 *
 * The library's name is the one piece of display type on the screen, and under it a mono line
 * that is the same arithmetic the landing page does: the count and the total, counted and not
 * rounded. When somebody else owns it, their name leads that line -- a library called "Reunions
 * Ateneu" is a different object depending on whose it is, and the answer belongs beside the title
 * rather than three lines down.
 *
 * **Settings is here only when it can be reached.** Level 30 and above; absent rather than
 * disabled below it (§3.5). A disabled row of buttons reads as a bug and a missing one reads as a
 * decision, and this is the first of the several places in V3 where that rule is applied.
 *
 * **Read-only says so once, quietly.** One line under the title, not a banner, not a lock icon on
 * every field: the screen has to look intentional rather than broken, and the way it does that is
 * by saying the thing once and then simply not offering what it cannot.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { toLibrarySettings } from '@/app/routes';
import { colourOf } from '@/app/library-data';
import { AvatarStack, Button, PageHeader } from '@/design-system';
import * as format from '@/i18n/format';

import type { LibraryContext } from './data';

export function LibraryHeader({ context }: { context: LibraryContext }) {
  const { t } = useTranslation('library');
  const navigate = useNavigate();
  const { library, shares, isOwn, canManage, isReadOnly } = context;

  if (library === undefined) return null;

  const people = shares.map((share) => ({
    id: share.grantee.id,
    name: share.grantee.display_name,
  }));

  return (
    <>
      <PageHeader
        title={library.name}
        before={
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              flex: '0 0 auto',
              borderRadius: 'var(--radius-chip)',
              background: colourOf(library.colour),
            }}
          />
        }
        meta={[
          isOwn ? undefined : library.owner.display_name,
          t('common:count.recordings', { count: library.audio_count }),
          format.total(library.total_duration_ms),
        ]
          .filter((part) => part !== undefined)
          .join(' · ')}
        actions={
          <>
            {people.length > 0 && <AvatarStack people={people} size={26} />}
            {canManage && (
              <Button
                variant="secondary"
                icon="sliders-horizontal"
                onClick={() => {
                  void navigate(toLibrarySettings(library.uuid));
                }}
              >
                {t('header.settings')}
              </Button>
            )}
          </>
        }
      />
      {isReadOnly && (
        <p
          style={{
            margin: '0 0 var(--space-6)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {t('header.readOnly')}
        </p>
      )}
    </>
  );
}
