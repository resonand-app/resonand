/**
 * V8 · Move a recording to another library (`UI-19a`, `UI-19b`, §V8).
 *
 * It gets a screen of its own because **its consequences are not obvious**, and all three have to
 * be said before the move happens rather than discovered after it:
 *
 * **It changes who can see the recording, and the change is named.** Both lists are computable
 * from the source and destination `shares` -- who gains access and who loses it, by name -- and
 * naming them is the entire reason this dialog exists. "This will change permissions" is a
 * sentence nobody can act on.
 *
 * **The category is lost**, because a category belongs to the library it was made in. The one
 * being lost is named, so the choice is between a known cost and the move rather than between a
 * warning and the move.
 *
 * **Grants made on the recording itself are kept**, because they point at the recording and not
 * at the library. Correct, surprising, and therefore said.
 *
 * In `components/` rather than in a feature because two views open it: the detail view moves one
 * recording (`UI-13e`), and a library's bulk bar moves a selection (`UI-9b`). It states the
 * consequences **once for the set** and does not enumerate two hundred titles.
 *
 * **It picks the destination and says what will happen; the caller does the moving.** There is no
 * bulk endpoint, so a selection is one request per recording and partial failure is the ordinary
 * outcome (`UI-9c`) -- and the machinery for that already exists in the library's `useBulk`.
 * Duplicating it here would make the dialog own a second one.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';
import { LEVEL } from '@/features/library/data';
import { Button, Dialog, Modal, Select } from '@/design-system';

type LibrarySummary = components['schemas']['LibrarySummary'];
type ShareSummary = components['schemas']['ShareSummary'];

/** The little a recording has to say about itself for the consequences to be statable. */
export interface Movable {
  uuid: string;
  title: string;
  library_uuid: string;
  category_id: number | null;
}

export interface MoveDialogProps {
  /** What is being moved. One from the detail view, or a whole selection from a library. */
  recordings: readonly Movable[];
  /** The name of the category the source library has for each id, for naming what is lost. */
  categoryName: (id: number | null) => string | undefined;
  onClose: () => void;
  /** Do the move. The dialog does not, because a selection is one request per recording. */
  onConfirm: (libraryUuid: string) => void;
}

export function MoveDialog({ recordings, categoryName, onClose, onConfirm }: MoveDialogProps) {
  const { t } = useTranslation('move');
  const source = recordings[0]?.library_uuid ?? '';
  const libraries = useQuery({ queryKey: keys.libraries(), queryFn: () => get('/api/libraries') });
  const [destination, setDestination] = useState<string | undefined>(undefined);

  // Only libraries you can add to, and never the one they are already in (§V8).
  const available = (libraries.data ?? []).filter(
    (one) => one.level >= LEVEL.edit && one.uuid !== source && one.deleted_at === null,
  );
  const chosen = available.find((one) => one.uuid === destination);

  // `open` is constant because this is rendered only while open. `Modal` is the other half of a
  // dialog: the scrim, the focus trap, `Esc`, and the centring.
  return (
    <Modal open onClose={onClose}>
      <Dialog
        title={t('title', { count: recordings.length })}
        width={520}
        onClose={onClose}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('common:action.cancel')}
            </Button>
            {available.length > 0 && (
              <Button
                variant="primary"
                disabled={chosen === undefined}
                onClick={() => {
                  if (chosen !== undefined) onConfirm(chosen.uuid);
                }}
              >
                {t('confirm', { count: recordings.length })}
              </Button>
            )}
          </>
        }
      >
        {available.length === 0 ? (
          // Say it, rather than showing a picker with nothing in it: an empty select reads as
          // something that failed to load (§V8).
          <p style={PROSE}>{t('nowhere')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Select
              label={t('destination')}
              value={destination}
              initialFocus
              placeholder={t('choose')}
              options={available.map((one) => ({ value: one.uuid, label: one.name }))}
              onChange={setDestination}
            />
            {chosen !== undefined && (
              <Consequences
                recordings={recordings}
                source={source}
                destination={chosen}
                categoryName={categoryName}
              />
            )}
          </div>
        )}
      </Dialog>
    </Modal>
  );
}

const PROSE = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--type-ui-size-sm)',
  lineHeight: 1.55,
  color: 'var(--text-2)',
} as const;

/**
 * The three things that will happen, stated (`UI-19b`).
 *
 * The access lists are computed rather than fetched as a difference, because nothing computes them
 * for us: the two `shares` responses plus the two owners are the whole answer, and it is only an
 * answer if both are loaded -- so it says so while they are not, rather than showing an empty list
 * that reads as "nobody".
 */
function Consequences({
  recordings,
  source,
  destination,
  categoryName,
}: {
  recordings: readonly Movable[];
  source: string;
  destination: LibrarySummary;
  categoryName: (id: number | null) => string | undefined;
}) {
  const { t } = useTranslation('move');
  const from = useShares(source);
  const to = useShares(destination.uuid);
  const categories = useQuery({
    queryKey: keys.libraryCategories(destination.uuid),
    queryFn: () =>
      get('/api/libraries/{library_uuid}/categories', {
        path: { library_uuid: destination.uuid },
      }),
    staleTime: 5 * 60_000,
  });

  const losing = recordings
    .map((one) => categoryName(one.category_id))
    .filter((name): name is string => name !== undefined);
  const distinct = [...new Set(losing)];

  return (
    <ul
      style={{ margin: 0, paddingLeft: 'var(--space-6)', display: 'grid', gap: 'var(--space-3)' }}
    >
      <li style={PROSE}>
        {from.isPending || to.isPending ? (
          t('access.working')
        ) : (
          <Access
            gains={difference(to.people, from.people)}
            loses={difference(from.people, to.people)}
          />
        )}
      </li>
      <li style={PROSE}>
        {distinct.length === 0
          ? t('category.none', { count: recordings.length })
          : // Pluralised on the recordings and not on the categories: two recordings sharing one
            // category still lose their categories, and the names are what is in the brackets.
            t('category.lost', { count: recordings.length, names: distinct.join(', ') })}
        {categories.data?.length === 0 && ` ${t('category.destinationHasNone')}`}
      </li>
      <li style={PROSE}>{t('individual', { count: recordings.length })}</li>
    </ul>
  );
}

/** Who gains and who loses, by name, because a count answers nothing anybody can act on. */
function Access({ gains, loses }: { gains: string[]; loses: string[] }) {
  const { t } = useTranslation('move');
  if (gains.length === 0 && loses.length === 0) return <>{t('access.same')}</>;
  return (
    <>
      {gains.length > 0 && t('access.gains', { names: gains.join(', '), count: gains.length })}
      {gains.length > 0 && loses.length > 0 && ' '}
      {loses.length > 0 && t('access.loses', { names: loses.join(', '), count: loses.length })}
    </>
  );
}

/** Everybody who can see a library: whoever it is shared with, and whoever owns it. */
function useShares(uuid: string): { people: Map<number, string>; isPending: boolean } {
  const shares = useQuery({
    queryKey: keys.libraryShares(uuid),
    queryFn: () => get('/api/libraries/{library_uuid}/shares', { path: { library_uuid: uuid } }),
    enabled: uuid !== '',
  });
  const library = useQuery({
    queryKey: keys.library(uuid),
    queryFn: () => get('/api/libraries/{library_uuid}', { path: { library_uuid: uuid } }),
    enabled: uuid !== '',
  });

  const people = new Map<number, string>();
  const owner = library.data?.owner;
  if (owner !== undefined) people.set(owner.id, owner.display_name);
  for (const share of shares.data ?? ([] as ShareSummary[])) {
    people.set(share.grantee.id, share.grantee.display_name);
  }
  return { people, isPending: shares.isPending || library.isPending };
}

/** The names in the first that are not in the second, by account id rather than by name. */
function difference(left: Map<number, string>, right: Map<number, string>): string[] {
  return [...left].filter(([id]) => !right.has(id)).map(([, name]) => name);
}
