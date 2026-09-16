/**
 * Creating a library (`UI-31e`, §V2).
 *
 * A name and a colour, and nothing else. `description` exists on the model and is not asked for
 * here: the dialog stands between somebody and the thing they came to do, and a library's
 * description is a sentence they can add later in V7 or never.
 *
 * **The colour is chosen, never derived.** A hash of the name would be a different product
 * decision taken by accident -- §V2 says so in as many words -- and it would quietly make the
 * seven colours a property of spelling rather than a thing somebody picked.
 *
 * **The one line of copy is about sharing.** A new library sounds like a place other people can
 * see, and the answer is that nothing is shared until it is shared. It is stated at the moment
 * the library comes into existence rather than in a settings panel nobody opens.
 *
 * **A duplicate name is a 409 and belongs beside the field.** §1.9's rule: 409 is a conflict the
 * person can resolve, and the field they resolve it in is the one they typed into. A banner would
 * make somebody read the whole dialog again to find out which word to change.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { isApiProblem } from '@/api/problem';
import { HANDLED } from '@/api/query-client';
import { Button, ColorSwatchPicker, Dialog, Modal, TextField } from '@/design-system';
import type { LibraryColorName } from '@/design-system';

export interface CreateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

/** What a library starts as when nobody has chosen. The API's own default. */
const DEFAULT_COLOUR = 'stone' satisfies LibraryColorName;

export function CreateLibraryDialog({ open, onClose }: CreateLibraryDialogProps) {
  const { t } = useTranslation('libraries');
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [colour, setColour] = useState<LibraryColorName>(DEFAULT_COLOUR);

  const create = useMutation({
    mutationFn: (library: { name: string; colour: LibraryColorName }) =>
      post('/api/libraries', { body: library }),
    // A taken name belongs under the field, not in a toast over a dialog somebody is still in.
    meta: HANDLED,
    onSuccess: async (library) => {
      await invalidate(client, { kind: 'library', library: library.uuid });
      close();
    },
  });

  function close() {
    setName('');
    setColour(DEFAULT_COLOUR);
    create.reset();
    onClose();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') return;
    create.mutate({ name: trimmed, colour });
  }

  // A conflict is the name, and everything else is not: a 409 goes under the field somebody can
  // act on, and any other failure keeps the detail the API wrote for it.
  const problem = isApiProblem(create.error) ? create.error : undefined;
  const nameError = problem?.isConflict === true ? problem.detail : problem?.fieldDetail('name');
  const otherError = problem !== undefined && nameError === undefined ? problem.detail : undefined;

  return (
    <Modal open={open} onClose={close}>
      <Dialog
        title={t('create.title')}
        onClose={close}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            <Button variant="ghost" onClick={close} type="button">
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-library"
              disabled={name.trim() === '' || create.isPending}
            >
              {t('create.submit')}
            </Button>
          </>
        }
      >
        <form
          id="create-library"
          onSubmit={submit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <TextField
            label={t('create.name')}
            value={name}
            maxLength={200}
            data-initial-focus=""
            onChange={(event) => {
              setName(event.target.value);
            }}
            {...(nameError === undefined ? {} : { error: nameError })}
          />
          <ColorSwatchPicker label={t('create.colour')} value={colour} onChange={setColour} />
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              lineHeight: 'var(--type-body-leading)',
              color: 'var(--text-3)',
              textWrap: 'pretty',
            }}
          >
            {t('create.privacy')}
          </p>
          {otherError !== undefined && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                color: 'var(--state-failed)',
              }}
              role="alert"
            >
              {otherError}
            </p>
          )}
        </form>
      </Dialog>
    </Modal>
  );
}
