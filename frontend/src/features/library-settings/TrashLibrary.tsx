/**
 * The settings screen's way of sending a whole library to the trash (`UI-17f`, §V7).
 *
 * The danger button and the place it sits; the confirmation itself is `TrashLibraryDialog`,
 * because the landing page's cards reach the same consequence through a menu row and the two must
 * state it identically -- the count that goes with it, and how long it can come back.
 *
 * Afterwards there is nothing to be on: the library it was about is gone from every list, so it
 * leaves for the landing page rather than staying on a settings screen for something that no
 * longer resolves.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { routes } from '@/app/routes';
import { TrashLibraryDialog } from '@/components/TrashLibraryDialog';
import { Button } from '@/design-system';

export interface TrashLibraryProps {
  library: { uuid: string; name: string; audio_count: number };
}

export function TrashLibrary({ library }: TrashLibraryProps) {
  const { t } = useTranslation('librarySettings');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div>
        <Button
          variant="danger"
          icon="trash-2"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('trash.action')}
        </Button>
      </div>
      <TrashLibraryDialog
        library={library}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        onTrashed={() => {
          setOpen(false);
          void navigate(routes.libraries);
        }}
      />
    </section>
  );
}
