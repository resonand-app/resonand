/**
 * The administrator's way back into an account (`UI-37`, `API-25`).
 *
 * Nothing else in the instance can do this. `POST /auth/password` wants the current password,
 * which is precisely what somebody locked out does not have, and `INT-3b` refuses to delete an
 * account that holds anything -- so without this a forgotten password is permanent, and the
 * instance cannot even be tidied up around it. Exit criterion 2 is a second real person using the
 * archive; this is what happens to them on the day they forget it.
 *
 * **The value is generated here and shown exactly once**, the way an access token will have to be.
 * Generated rather than typed because an administrator inventing a password for somebody else
 * invents a weak one, and it is going to be read aloud or pasted into a message either way. Shown
 * once because there is nowhere honest to show it twice: the API stores a hash, and a copy kept
 * anywhere so it could be shown again would be the thing worth stealing.
 *
 * **Resonand sends it nowhere.** There is no mail in this product and adding one to deliver a
 * password would be adding an outbound channel for the least appropriate payload there is. The
 * administrator hands it over themselves, by whatever means they and the other person already
 * trust.
 *
 * The sessions clause is stated before the button and not after: ending every device somebody is
 * signed in on is the part they have to weigh, and a consequence explained afterwards is an
 * apology.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { Button, Dialog, Modal } from '@/design-system';

import { useUserActions } from './data';
import { generatedPassword } from './password';
import type { AdminUser } from './data';

export function SetPasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const { setPassword } = useUserActions();
  // Once, at mount. Regenerating on a re-render would change the value under somebody who has
  // just copied it.
  const [password] = useState(generatedPassword);
  const [copied, setCopied] = useState(false);

  const done = setPassword.isSuccess;

  return (
    <Modal open onClose={onClose}>
      <Dialog
        title={t('users.resetTitle', { name: user.display_name })}
        {...(done ? {} : { description: t('users.resetBody') })}
        onClose={onClose}
        labels={{ close: t('common:action.close') }}
        width={480}
        footer={
          done ? (
            <Button variant="primary" onClick={onClose}>
              {t('common:action.close')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t('users.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={setPassword.isPending}
                onClick={() => {
                  setPassword.mutate({ id: user.id, password });
                }}
              >
                {t('users.resetConfirm')}
              </Button>
            </>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <output
            aria-label={t('users.resetValue', { name: user.display_name })}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-ui-size)',
              color: 'var(--text)',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-control)',
              padding: 'var(--space-3)',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {password}
          </output>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(password).then(
                  () => {
                    setCopied(true);
                  },
                  () => {
                    // A denied clipboard is not a failure worth a message: the value is on screen
                    // and selectable, which is the fallback everybody already knows.
                    setCopied(false);
                  },
                );
              }}
            >
              {copied ? t('users.resetCopied') : t('users.resetCopy')}
            </Button>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                color: 'var(--text-3)',
              }}
            >
              {t('users.resetOnce')}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {done
              ? t('users.resetDone', { name: user.display_name })
              : t('users.resetSessions', { name: user.display_name })}
          </p>
          {setPassword.isError && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                color: 'var(--state-failed)',
              }}
            >
              {isApiProblem(setPassword.error) ? setPassword.error.detail : t('users.resetFailed')}
            </p>
          )}
        </div>
      </Dialog>
    </Modal>
  );
}
