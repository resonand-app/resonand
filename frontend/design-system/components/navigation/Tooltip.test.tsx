/**
 * A tooltip has to be reachable by a keyboard and impossible to get stuck in (`UI-34j`).
 *
 * The two failures are opposite and both easy. A tooltip that only answers a pointer is one that
 * does not exist for anybody using a keyboard -- which is most of the places this component is
 * used, because the icon-only controls it names are exactly the ones with no visible text. And a
 * tooltip that traps focus strands a keyboard on a description of a control it can no longer
 * reach.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { IconButton } from '../forms/IconButton';
import { Tooltip } from './Tooltip';

const subject = () => screen.getByRole('button', { name: 'Share this library' });

function Harness() {
  return (
    <>
      <Tooltip content="Share this library">
        <IconButton icon="share-2" variant="ghost" label="Share this library" />
      </Tooltip>
      <button type="button">Somewhere else</button>
    </>
  );
}

describe('Tooltip', () => {
  it('is not there until something asks for it', () => {
    render(<Harness />);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('appears on focus, at once', async () => {
    render(<Harness />);
    subject().focus();
    // No dwell for a keyboard: it arrived on this control because somebody chose it, where a
    // pointer crosses six on the way somewhere else.
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Share this library');
  });

  it('goes away when focus leaves', async () => {
    render(<Harness />);
    subject().focus();
    await screen.findByRole('tooltip');
    await userEvent.tab();
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  it('does not trap focus', async () => {
    render(<Harness />);
    subject().focus();
    await screen.findByRole('tooltip');
    await userEvent.tab();
    // Straight out to the next control. A trap here would strand a keyboard on a hint about a
    // button it can no longer reach.
    expect(screen.getByRole('button', { name: 'Somewhere else' })).toHaveFocus();
  });

  it('describes its control rather than replacing its name', async () => {
    render(<Harness />);
    subject().focus();
    const tip = await screen.findByRole('tooltip');
    expect(subject()).toHaveAttribute('aria-describedby', tip.id);
    // The control keeps its own accessible name: the tooltip is never the only place the words
    // exist, and `aria-label` is the other one.
    expect(subject()).toHaveAccessibleName('Share this library');
  });

  it('is not something a pointer can land on', async () => {
    render(<Harness />);
    subject().focus();
    const tip = await screen.findByRole('tooltip');
    // Moving towards it would otherwise dismiss it, and moving onto it would keep it up.
    expect(tip).toHaveStyle({ pointerEvents: 'none' });
  });

  it('can be held open for a specimen board', () => {
    render(
      <Tooltip content="Held open" open>
        <span>Anchor</span>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Held open');
  });
});
