/**
 * The trivial component test `INF-3c` is done by (`INF-3c`).
 *
 * It asserts almost nothing, on purpose. What it proves is that the arrangement works: a `.tsx`
 * file compiles under the strict config, renders into jsdom, and is found and reported by the
 * same command CI runs. That is the thing that would otherwise only be discovered by the first
 * real test, at which point it is two problems instead of one.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/app/App';

describe('App', () => {
  it('renders', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveTextContent('Sonarium');
  });
});
