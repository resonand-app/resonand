/**
 * The two registers, and the third case (`UI-34n`, §3.4).
 *
 * This is the only implementation of the product's second principle, so the thing worth asserting
 * is not that it renders -- it is that it says the right one of three different things, and that
 * none of them is a warning. The reference deployment is a `faster-whisper` on the same machine:
 * telling somebody their audio is being sent somewhere when it is going to their own network is
 * both false and the kind of false that teaches people to ignore the notice that matters.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EgressNotice } from './EgressNotice';
import type { TranscriptionDestination } from './EgressNotice';

const LOCAL: TranscriptionDestination = {
  provider: 'whisper',
  host: 'whisper.local:9000',
  is_local: true,
  configured: true,
};

const OPENAI: TranscriptionDestination = {
  provider: 'openai',
  host: 'api.openai.com',
  is_local: false,
  configured: true,
};

const NONE: TranscriptionDestination = {
  provider: 'none',
  host: null,
  is_local: false,
  configured: false,
};

describe('EgressNotice', () => {
  it('is calm about a machine on your own network', () => {
    const { container } = render(<EgressNotice destination={LOCAL} />);
    expect(screen.getByText(/on your own network/)).toBeDefined();
    expect(screen.getByText('whisper.local:9000')).toBeDefined();
    expect(screen.getByText(/The audio does not leave it/)).toBeDefined();
    expect(container.querySelector('[data-tone="local"]')).not.toBeNull();
  });

  it('says plainly that the audio leaves, when it does', () => {
    const { container } = render(<EgressNotice destination={OPENAI} />);
    expect(screen.getByText('api.openai.com')).toBeDefined();
    expect(screen.getByText(/The audio leaves this instance/)).toBeDefined();
    expect(container.querySelector('[data-tone="external"]')).not.toBeNull();
  });

  it('says it again beside a retry, because a retry sends it again', () => {
    render(
      <EgressNotice
        destination={OPENAI}
        placement="retry"
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByText(/Retrying sends the audio to/)).toBeDefined();
    expect(screen.getByText(/again/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('does not offer a retry sentence for a local provider', () => {
    // Nothing is being sent anywhere, so there is nothing for a second sentence to disclose.
    render(<EgressNotice destination={LOCAL} placement="retry" />);
    expect(screen.queryByText(/Retrying sends the audio/)).toBeNull();
    expect(screen.getByText(/on your own network/)).toBeDefined();
  });

  it('states the third case rather than treating it as an error', () => {
    const { container } = render(<EgressNotice destination={NONE} />);
    expect(
      screen.getByText(/Nothing can be transcribed until an administrator sets one up/),
    ).toBeDefined();
    expect(container.querySelector('[data-tone="none"]')).not.toBeNull();
  });

  it('falls back to the provider when there is no host to name', () => {
    // `host` is null wherever the base URL could not be parsed. Naming the provider is still more
    // than saying nothing.
    render(<EgressNotice destination={{ ...OPENAI, host: null }} />);
    expect(screen.getByText('openai')).toBeDefined();
  });

  it('is never a warning', () => {
    // Information, not alarm: no exclamation mark anywhere, in any of the three cases.
    for (const destination of [LOCAL, OPENAI, NONE]) {
      const { container, unmount } = render(<EgressNotice destination={destination} />);
      expect(container.textContent).not.toContain('!');
      unmount();
    }
  });
});
