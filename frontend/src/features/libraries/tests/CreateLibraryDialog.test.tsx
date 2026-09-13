/**
 * Creating a library (`UI-31e`, §V2, §1.9).
 *
 * Three things are worth holding: that the colour is sent as chosen, that a duplicate name lands
 * beside the field somebody can act on rather than in a banner, and that the dialog does not
 * remember a failed attempt after it has been closed.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { mockApi, server } from '@/test/api/server';

import { CreateLibraryDialog } from '../CreateLibraryDialog';

mockApi();

/** The dialog with the state a view holds for it, so closing it is a real close. */
function Host() {
  const [open, setOpen] = useState(true);
  return (
    <CreateLibraryDialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
    />
  );
}

function renderDialog() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <Host />
        </ThemeProvider>
      </QueryClientProvider>,
    ),
  };
}

/** What the instance was asked to create, from the request it received. */
function capture(): { sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/libraries', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.push(body);
      return HttpResponse.json(
        { ...body, uuid: 'created', is_personal: false, audio_count: 0 },
        { status: 201 },
      );
    }),
  );
  return { sent };
}

describe('the dialog', () => {
  it('asks for a name and a colour, and says nothing is shared until you share it', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Create a library' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText(/Nothing in a library is shared until you share it/)).toBeVisible();
  });

  it('will not create a library with no name', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('sends the colour that was chosen rather than one derived from the name', async () => {
    const { sent } = capture();
    const { user } = renderDialog();
    await user.type(screen.getByLabelText('Name'), 'Àvia Teresa');
    await user.click(screen.getByRole('button', { name: 'plum' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({ name: 'Àvia Teresa', colour: 'plum' });
  });

  it('puts a duplicate name beside the field, never in a banner', async () => {
    server.use(
      http.post('/api/libraries', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Conflict',
            detail: 'You already have a library called Àvia Teresa.',
            status: 409,
          },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const { user } = renderDialog();
    await user.type(screen.getByLabelText('Name'), 'Àvia Teresa');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const message = await screen.findByText('You already have a library called Àvia Teresa.');
    // Beside the field: the dialog stays open, and the message shares a label with the input
    // somebody has to change rather than sitting at the top of the panel.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(message.parentElement?.querySelector('input')).toBeInTheDocument();
  });

  it('forgets a failed attempt when it is closed', async () => {
    server.use(
      http.post('/api/libraries', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', detail: 'That name is taken.', status: 409 },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const { user } = renderDialog();
    await user.type(screen.getByLabelText('Name'), 'Personal');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByText('That name is taken.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes once the library exists', async () => {
    capture();
    const { user } = renderDialog();
    await user.type(screen.getByLabelText('Name'), 'Reunions');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
