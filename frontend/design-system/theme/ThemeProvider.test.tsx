/**
 * Three states, and a store that throws (`UI-1j`).
 *
 * The criterion is that the choice survives a reload and that clearing it returns to the system's.
 * A reload is a fresh provider reading `localStorage` again, so that is what "reload" means below.
 *
 * The third state is the one worth the care. **Following the system writes no attribute at all**
 * -- `tokens/semantic.css` selects the light palette from `prefers-color-scheme` on a document
 * with no `data-theme`, so writing `dark` there because the device says dark today would freeze
 * that answer into a device that changes its mind at sunset.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY, useTheme } from './theme';
import type { ThemeChoice } from './theme';
import { ThemeProvider } from './ThemeProvider';

/** A device that says light, or does not. jsdom implements `matchMedia` as always-false. */
function deviceSaysLight(light: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: light && query.includes('light'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function Probe() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <div>
      <span data-testid="choice">{choice}</span>
      <span data-testid="resolved">{resolved}</span>
      {(['light', 'dark', 'system'] as ThemeChoice[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            setChoice(option);
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const attribute = () => document.documentElement.getAttribute('data-theme');
const scheme = () => document.documentElement.style.getPropertyValue('color-scheme');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('color-scheme');
  deviceSaysLight(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('follows the system by default, and writes nothing', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
    expect(attribute()).toBeNull();
    expect(scheme()).toBe('');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it.each(['light', 'dark'] as const)('writes %s on the document when it is chosen', async (pick) => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: pick }));
    expect(attribute()).toBe(pick);
    expect(scheme()).toBe(pick);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(pick);
  });

  it('survives a reload', async () => {
    const first = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'light' }));
    first.unmount();
    document.documentElement.removeAttribute('data-theme');

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('light');
    expect(attribute()).toBe('light');
  });

  it('returns to the system when the choice is cleared', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(attribute()).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'system' }));
    expect(attribute()).toBeNull();
    expect(scheme()).toBe('');
    // Nothing stored: the absence *is* the choice, and a stored "dark" would be today's answer
    // frozen into a device that changes its mind.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('resolves the system choice against what the device says', () => {
    deviceSaysLight(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    // Still nothing written. `resolved` is a reading, not a decision.
    expect(attribute()).toBeNull();
  });

  it('reports the explicit choice as resolved, whatever the device says', async () => {
    deviceSaysLight(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('still renders when localStorage throws', async () => {
    // A Safari private window, or site data blocked. The preference lasts until reload; the
    // interface renders, which is the part that matters.
    const boom = () => {
      throw new Error('The operation is insecure.');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('system');

    await userEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByTestId('choice')).toHaveTextContent('light');
    expect(attribute()).toBe('light');
  });

  it('refuses to be used outside a provider', () => {
    // A component that silently gets `dark` because nobody wrapped it is a bug that arrives as a
    // screenshot review comment months later.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/outside a ThemeProvider/);
    quiet.mockRestore();
  });
});
