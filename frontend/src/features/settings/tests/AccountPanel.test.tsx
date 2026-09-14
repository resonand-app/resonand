/**
 * V10 · Account (`UI-20b`, §V10).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { AccountPanel } from '../AccountPanel';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <AccountPanel />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('who you are', () => {
  it('saves the display name on blur, with no Save button to forget', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Alex Morgan/ }));
    const field = screen.getByRole('textbox', { name: 'Display name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Alex Morgan C.');
    await userEvent.tab();
    await waitFor(() => {
      expect(archive.me.display_name).toBe('Alex Morgan C.');
    });
  });

  it('says plainly that it keeps no picture of you, rather than drawing an empty circle', async () => {
    show();
    expect(await screen.findByText(/stores no pictures of you/i)).toBeVisible();
  });

  it('shows what the instance said when an address is already somebody else’s', async () => {
    server.use(
      http.patch('/api/auth/me', () =>
        HttpResponse.json(
          {
            type: '/errors/conflict',
            title: 'Conflict',
            detail: 'That address already belongs to another account.',
            status: 409,
            request_id: 'test-request',
          },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: /alex@example.test/ }));
    const field = screen.getByRole('textbox', { name: 'Email address' });
    await userEvent.clear(field);
    await userEvent.type(field, 'sam@example.test');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(/already belongs to another/i);
  });
});

describe('the password', () => {
  it('states the ten-character minimum before anything is typed', async () => {
    show();
    expect(await screen.findByText('At least 10 characters.')).toBeVisible();
  });

  it('will not submit until there is a current password and a long enough new one', async () => {
    show();
    const action = await screen.findByRole('button', { name: 'Change password' });
    expect(action).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Current password'), 'remembering-well');
    // Held rather than re-queried: once it is too short the field grows the rule as an error
    // message inside its own label, so its accessible name is no longer just the label.
    const password = screen.getByLabelText('New password');
    await userEvent.type(password, 'short');
    expect(action).toBeDisabled();
    await userEvent.type(password, '-enough-now');
    expect(action).toBeEnabled();
  });

  it('says the consequence -- every other sign-in ends -- before the button, not after', async () => {
    show();
    expect(await screen.findByText(/signs you out everywhere else/i)).toBeVisible();
  });

  it('confirms in words when it worked, and empties the fields', async () => {
    show();
    await userEvent.type(await screen.findByLabelText('Current password'), 'remembering-well');
    await userEvent.type(screen.getByLabelText('New password'), 'a-longer-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/every other sign-in has ended/i);
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('shows the refusal when the current password is wrong', async () => {
    server.use(
      http.post('/api/auth/password', () =>
        HttpResponse.json(
          {
            type: '/errors/invalid_request',
            title: 'Invalid request',
            detail: 'That is not your current password.',
            status: 400,
            request_id: 'test-request',
          },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    await userEvent.type(await screen.findByLabelText('Current password'), 'wrong-password-here');
    await userEvent.type(screen.getByLabelText('New password'), 'a-longer-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not your current password/i);
  });
});
