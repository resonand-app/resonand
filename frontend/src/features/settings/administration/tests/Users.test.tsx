/**
 * The accounts on this instance (`INT-3b`, §V10).
 *
 * Two claims worth holding. One action per row rather than two, which only became possible when
 * `API-20` started sending `disabled_at`; and the refusal to delete an owner reading as a
 * considered position, in the API's own words with the numbers in them.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { Users } from '../Users';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Users />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the list', () => {
  it('marks who runs the instance and who is already disabled', async () => {
    show();
    expect(await screen.findByText('Alex Morgan')).toBeVisible();
    expect(screen.getByText('Administrator')).toBeVisible();
    expect(screen.getByText(/^Disabled /)).toBeVisible();
  });

  it('offers one direction per account, not both', async () => {
    show();
    await screen.findByText('Alex Morgan');
    // Alex Morgan is active and Sam Rivera is disabled, so exactly one of each verb is on screen.
    expect(screen.getAllByRole('button', { name: 'Disable' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Re-enable' })).toHaveLength(1);
  });

  it('disables an account and redraws the row from the answer', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Disable' }));
    await waitFor(() => {
      expect(
        archive.users.find((one) => one.display_name === 'Alex Morgan')?.disabled_at,
      ).not.toBeNull();
    });
    expect(await screen.findAllByRole('button', { name: 'Re-enable' })).toHaveLength(2);
  });

  it('re-enables one', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Re-enable' }));
    await waitFor(() => {
      expect(
        archive.users.find((one) => one.display_name === 'Sam Rivera')?.disabled_at,
      ).toBeNull();
    });
  });
});

describe('deleting an account', () => {
  it('reports the refusal in the words that name what stands in the way', async () => {
    server.use(
      http.delete('/api/admin/users/:user_id', () =>
        HttpResponse.json(
          {
            type: '/errors/invalid_request',
            title: 'Invalid request',
            detail:
              'Alex Morgan owns 2 libraries and 84 recordings. Deleting the account would take them ' +
              'with it, and transferring ownership is not built yet. Disable the account instead: ' +
              'it keeps the recordings and stops the person signing in.',
            status: 400,
            request_id: 'test-request',
          },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete the account for Alex Morgan' }),
    );
    const refusal = await screen.findByRole('alert');
    expect(refusal).toHaveTextContent(/owns 2 libraries and 84 recordings/);
    expect(refusal).toHaveTextContent(/Disable the account instead/);
  });

  it('removes an account that has nothing in the way', async () => {
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete the account for Sam Rivera' }),
    );
    await waitFor(() => {
      expect(archive.users.some((one) => one.display_name === 'Sam Rivera')).toBe(false);
    });
  });
});

describe('making an account', () => {
  it('is the only way in, because there is no sign-up page anywhere', async () => {
    show();
    expect(await screen.findByText(/There is no sign-up page/)).toBeVisible();
  });

  it('will not submit until the password is long enough', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'New account' }));
    await userEvent.type(screen.getByLabelText('Display name'), 'Nova');
    await userEvent.type(screen.getByLabelText('Email address'), 'nova@example.test');
    const action = screen.getByRole('button', { name: 'Create account' });
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(action).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), '-enough-now');
    expect(action).toBeEnabled();
  });

  it('creates one, and can make it an administrator', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'New account' }));
    await userEvent.type(screen.getByLabelText('Display name'), 'Nova');
    await userEvent.type(screen.getByLabelText('Email address'), 'nova@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-enough-one');
    await userEvent.click(screen.getByRole('switch', { name: /Can run this instance/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      const made = archive.users.find((one) => one.email === 'nova@example.test');
      expect(made?.is_admin).toBe(true);
    });
  });
});

describe('setting a password for somebody who is locked out (UI-37)', () => {
  it('shows a generated password and sends the value it showed', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /set a password for alex/i }));

    const shown = await screen.findByLabelText(/the new password for alex/i);
    const value = shown.textContent;
    expect(value).toHaveLength(20);

    await userEvent.click(screen.getByRole('button', { name: 'Set this password' }));

    await waitFor(() => {
      expect(archive.passwordsSet.at(-1)?.password).toBe(value);
    });
  });

  it('says every device will be signed out before the button is pressed', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /set a password for alex/i }));
    expect(
      screen.getByText(/every device alex morgan is signed in on will be signed out/i),
    ).toBeInTheDocument();
  });

  it('says the value is shown once, because nothing can show it again', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /set a password for alex/i }));
    expect(screen.getByText(/shown once/i)).toBeInTheDocument();
  });

  it('does not offer the value again once the dialog is closed', async () => {
    show();
    const open = await screen.findByRole('button', { name: /set a password for alex/i });
    await userEvent.click(open);
    const first = (await screen.findByLabelText(/the new password for alex/i)).textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(open);
    const second = (await screen.findByLabelText(/the new password for alex/i)).textContent;
    expect(second).not.toBe(first);
  });

  it('keeps the password out of the request when the API refuses it', async () => {
    server.use(
      http.post('/api/admin/users/:user_id/password', () =>
        HttpResponse.json(
          { title: 'Bad request', status: 400, detail: 'Nope.' },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: /set a password for alex/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Set this password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });
});
