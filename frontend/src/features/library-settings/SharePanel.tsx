/**
 * Who has access (`UI-17c`, §V7).
 *
 * **This is where the product's first promise is kept or broken** -- nothing is shared until you
 * share it -- so it is a panel with names in it rather than a row of controls, and it answers the
 * three questions somebody actually has: who, at what level, and since when.
 *
 * **The level wording is the API's, and is visible rather than behind a tooltip.** `LevelSelector`
 * renders `level_description` verbatim (`UI-34k`): the sentences live beside the levels in
 * `sonarium.core.levels` and are sent down with every share, so the interface has no copy of them
 * to go stale. Somebody choosing what another person may do has to be able to read what it means
 * at the moment they choose it.
 *
 * **A level nobody has been granted yet has no sentence to show.** `level_description` arrives
 * attached to a grant, so the API describes the levels in use rather than the vocabulary -- and
 * for the rest this falls back to the interface's own short name, which is a label rather than a
 * second copy of the API's sentence. Every description the panel has seen is collected across the
 * shares on screen, so in practice a library that uses a level explains it. Closing this properly
 * means the API answering the vocabulary once; until it does, the panel is honest about showing a
 * name where it has no sentence.
 *
 * **Revoking says what the person loses, in numbers.** "Are you sure?" is not a consequence;
 * "Sam Rivera loses access to all 41 recordings" is.
 *
 * **Adding somebody takes a whole address and nothing shorter** (`UI-17d`, `API-15`). The lookup
 * matches the full normalised email and answers with at most one account, because a prefix or a
 * name search would let any library manager enumerate the instance -- the same class of leak the
 * ACL-filtered tag autocomplete exists to prevent. Sharing needs to confirm one address somebody
 * was given out of band, and **the interface must not look like a directory**: no suggestions
 * while typing, no list, and a field that says plainly it is not searching for people.
 *
 * **The three variants are one panel, not three** (`UI-17e`).
 *
 * *The personal library* cannot be shared away: there is no add form and one quiet line says why,
 * because a library that exists so that a recording always has somewhere to go is not one you can
 * hand to somebody else.
 *
 * *Shared with you at Can edit* keeps the panel and loses the controls. It is **read-only rather
 * than absent**: seeing who else has access is part of knowing what you are working in, and
 * hiding it would make a shared library feel like a private one.
 *
 * *Access granted on a single recording* is not something v0 creates, and the distinction is drawn
 * anyway. §V7 asks for the panel to be shaped so that adding it later does not redesign the
 * screen, and there is a more immediate reason: a recording **moved** into this library can arrive
 * carrying an individual grant, so somebody reading "who has access" here is already reading only
 * half the answer. The list says which half it is, and where the other half is shown.
 *
 * **`granted_by` is an id, and only some ids can be named.** The API sends the granter's user id
 * and no name, and the only people this screen can put a name to are the owner, the signed-in
 * account and the grantees themselves. When it cannot, the line says when rather than inventing a
 * who -- a wrong name on a permission is worse than no name.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/app/session';
import { Button, Dialog, LevelSelector, Modal, TextField } from '@/design-system';
import type { LevelOption } from '@/design-system';
import { LEVEL } from '@/features/library/data';
import { instant } from '@/i18n/time';

import { useLookup } from './data';
import type { Level, ShareEdits, ShareSummary, UserSummary } from './data';

export interface SharePanelProps {
  library: {
    uuid: string;
    name: string;
    owner: UserSummary;
    audio_count: number;
    is_personal: boolean;
  };
  shares: readonly ShareSummary[];
  edits: ShareEdits;
  /** Level 30. Below it the panel is read-only rather than absent (`UI-17e`). */
  canManage: boolean;
}

/** The three a share may carry. Owner is held, never granted. */
const GRANTABLE: readonly Level[] = [LEVEL.read, LEVEL.edit, LEVEL.manage];

export function SharePanel({ library, shares, edits, canManage }: SharePanelProps) {
  const { t, i18n } = useTranslation('librarySettings');
  const { account } = useSession();
  const [revoking, setRevoking] = useState<ShareSummary | null>(null);

  // Everybody this screen can put a name to, which is not everybody the API might name.
  const known = new Map<number, string>([
    [library.owner.id, library.owner.display_name],
    ...(account === undefined ? [] : ([[account.id, account.display_name]] as [number, string][])),
    ...shares.map((share): [number, string] => [share.grantee.id, share.grantee.display_name]),
  ]);

  // Every sentence the API has sent on this screen, by the level it describes.
  const described = new Map(shares.map((share) => [share.level, share.level_description]));
  const levels: LevelOption[] = GRANTABLE.map((level) => ({
    level,
    description: described.get(level) ?? t(`common:level.${nameOf(level)}`),
  }));

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2 style={heading}>{t('shares.title')}</h2>
      {/* Which half of the answer this is. Individual grants are not made in v0, but a recording
          moved into this library can arrive carrying one, and it is shown on the recording. */}
      <p style={quiet}>{t('shares.throughThisLibrary')}</p>
      {shares.length === 0 && <p style={quiet}>{t('shares.none')}</p>}
      <ul aria-label={t('shares.title')} style={list}>
        {shares.map((share) => (
          <li
            key={share.grantee.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 'var(--type-ui-size)', color: 'var(--text)' }}>
                {share.grantee.display_name}
              </span>
              <span style={{ ...quiet, fontFamily: 'var(--font-mono)' }}>
                {share.grantee.email}
              </span>
              <span style={{ flex: 1 }} />
              <span style={quiet}>
                {t(known.has(share.granted_by) ? 'shares.grantedBy' : 'shares.grantedOn', {
                  who: known.get(share.granted_by),
                  when: instant(share.created_at, i18n.language),
                })}
              </span>
            </div>
            <LevelSelector
              levels={levels}
              value={share.level}
              disabled={!canManage}
              label={t('shares.whatTheyCanDo', { name: share.grantee.display_name })}
              onChange={(level) => {
                edits.grant.mutate({ granteeId: share.grantee.id, level: level as Level });
              }}
            />
            {canManage && (
              <div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRevoking(share);
                  }}
                >
                  {t('shares.revoke', { name: share.grantee.display_name })}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* The personal library cannot be shared away: it exists so that a recording always has
          somewhere to go, and handing it to somebody else would take that away. Absent rather
          than disabled, with the reason said once. */}
      {library.is_personal ? (
        <p style={quiet}>{t('shares.personal')}</p>
      ) : (
        canManage && <AddPerson levels={levels} shares={shares} edits={edits} />
      )}
      {!canManage && !library.is_personal && <p style={quiet}>{t('shares.readOnly')}</p>}

      {revoking !== null && (
        <Modal
          open
          onClose={() => {
            setRevoking(null);
          }}
        >
          <Dialog
            title={t('shares.revokeTitle', { name: revoking.grantee.display_name })}
            description={t('shares.revokeBody', {
              name: revoking.grantee.display_name,
              count: library.audio_count,
              library: library.name,
            })}
            onClose={() => {
              setRevoking(null);
            }}
            labels={{ close: t('common:action.close') }}
            footer={
              <>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setRevoking(null);
                  }}
                >
                  {t('common:action.cancel')}
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => {
                    edits.revoke.mutate(revoking.grantee.id);
                    setRevoking(null);
                  }}
                >
                  {t('shares.revokeConfirm')}
                </Button>
              </>
            }
          />
        </Modal>
      )}
    </section>
  );
}

/**
 * The narrow lookup, and the grant it leads to.
 *
 * One address, one answer, and no list. The request is not made until what has been typed is a
 * whole address, so somebody typing a colleague's name into it produces no requests at all rather
 * than a request per keystroke about the people they work with.
 */
function AddPerson({
  levels,
  shares,
  edits,
}: {
  levels: LevelOption[];
  shares: readonly ShareSummary[];
  edits: ShareEdits;
}) {
  const { t } = useTranslation('librarySettings');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<Level>(LEVEL.read);
  const { person, isPending } = useLookup(email);
  const already = person !== undefined && shares.some((one) => one.grantee.id === person.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h3 style={{ ...heading, fontWeight: 'var(--weight-medium)' }}>{t('add.title')}</h3>
      <TextField
        type="email"
        label={t('add.email')}
        value={email}
        autoComplete="off"
        maxLength={320}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <span style={quiet}>{t('add.notADirectory')}</span>

      {email.trim() !== '' && person === undefined && !isPending && (
        <span style={quiet} role="status">
          {t('add.nobody')}
        </span>
      )}

      {person !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--type-ui-size)', color: 'var(--text)' }}>
            {person.display_name}
          </span>
          {already ? (
            <span style={quiet}>{t('add.already', { name: person.display_name })}</span>
          ) : (
            <>
              <LevelSelector
                levels={levels}
                value={level}
                label={t('add.whatTheyCanDo')}
                onChange={(chosen) => {
                  setLevel(chosen as Level);
                }}
              />
              <div>
                <Button
                  variant="primary"
                  onClick={() => {
                    edits.grant.mutate({ granteeId: person.id, level });
                    setEmail('');
                    setLevel(LEVEL.read);
                  }}
                >
                  {t('add.share', { name: person.display_name })}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The interface's own short name for a level, for one it has no sentence for. */
function nameOf(level: Level): string {
  if (level === LEVEL.read) return 'read';
  if (level === LEVEL.edit) return 'edit';
  return 'manage';
}

const heading = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--type-ui-size)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text)',
} as const;

const quiet = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--type-ui-size-sm)',
  color: 'var(--text-3)',
} as const;

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
} as const;
