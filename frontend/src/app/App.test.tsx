/**
 * The root mounts, with its providers and its routes (`UI-4a`).
 *
 * It was `INF-3c`'s trivial test -- proof that a `.tsx` compiles, renders into jsdom and is
 * reported by the command CI runs. It still is, and now it also holds the one thing about the
 * root that a per-route test cannot: that the providers are there and in an order that works,
 * because a query made outside the client or a redirect issued outside the router fails at the
 * moment somebody opens the page and nowhere earlier.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/app/App';

import { mockApi } from '@/test/api/server';

mockApi();

describe('App', () => {
  it('mounts the interface at whatever address it was opened at', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    // The landing view is Phase E; what is real here is the route, the session guard that let it
    // through, and the providers around both.
    expect(await screen.findByText('V2 - Libraries')).toBeInTheDocument();
  });
});
