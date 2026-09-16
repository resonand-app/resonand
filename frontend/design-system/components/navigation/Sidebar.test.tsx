/**
 * What lets the panel's growing edge uncover the labels instead of re-typesetting them (`UI-4c`),
 * and what keeps a long list of libraries a list rather than a squeeze.
 *
 * The rows are laid out at the settled width while the panel is still narrower than that, so only
 * the clip moves and each label is drawn once. When every row was instead as wide as the panel at
 * that instant, the library names ellipsised and un-ellipsised and the group headings wrapped to
 * two lines and back for the whole 200ms the width was in flight.
 *
 * jsdom lays nothing out and runs no transition, so neither the reveal nor the reflow it replaced
 * is visible here, and neither is the overflow: a panel with no height cannot run out of it. The
 * arrangement all three rest on is visible, and that is the part a later edit would quietly undo
 * by moving the padding back onto the panel or dropping a `flex` shorthand that looks redundant.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Sidebar } from './Sidebar';

const ROW = 32;
/** A short panel, so twenty rows do not fit and the effect has something to do. */
const VIEWPORT = 200;

const OWN = [{ id: 'interviews', name: 'Interviews', colour: 'var(--library-clay)', count: 2 }];

/** More libraries than any laptop has room for, which is where the squeeze used to start. */
const MANY = Array.from({ length: 20 }, (_, index) => ({
  id: `library-${String(index)}`,
  name: `Library ${String(index)}`,
  colour: 'var(--library-clay)',
  count: index,
}));

/** The panel's content, which is the element whose width decides the two arrangements. */
function content(panel: HTMLElement): HTMLElement {
  const first = panel.firstElementChild;
  if (!(first instanceof HTMLElement)) throw new Error('The sidebar has no content element.');
  return first;
}

/** The one box that scrolls. */
function libraries(panel: HTMLElement): HTMLElement {
  const region = panel.querySelector('[data-ds="sidebar-libraries"]');
  if (!(region instanceof HTMLElement)) throw new Error('The sidebar has no library region.');
  return region;
}

/**
 * A layout for jsdom, which has none.
 *
 * Three numbers is all the effect reads: how tall the box is, how tall a row is, and how far down
 * a row starts. The last is its position among its siblings, which is the one thing jsdom does
 * know, so the stub stays honest about the order even though it invents the pixels.
 *
 * Each goes back on the prototype that owns it. `clientHeight` is `Element`'s and the two offsets
 * are `HTMLElement`'s, and putting all three on `HTMLElement` shadows rather than replaces --
 * which works, and then cannot be undone without deleting a property that was never there.
 */
const STUBS: [object, string, PropertyDescriptor][] = [
  [Element.prototype, 'clientHeight', { configurable: true, get: () => VIEWPORT }],
  [HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => ROW }],
  [
    HTMLElement.prototype,
    'offsetTop',
    {
      configurable: true,
      get(this: HTMLElement) {
        const siblings = this.parentElement?.children ?? [];
        return Array.prototype.indexOf.call(siblings, this) * ROW;
      },
    },
  ],
];

function stubLayout(): () => void {
  const undo = STUBS.map(([target, name, stub]) => {
    const original = Object.getOwnPropertyDescriptor(target, name);
    if (original === undefined) throw new Error(`jsdom defines no ${name} to put back.`);
    Object.defineProperty(target, name, stub);
    return () => {
      Object.defineProperty(target, name, original);
    };
  });
  return () => {
    for (const restore of undo) restore();
  };
}

describe('Sidebar', () => {
  let restoreLayout: (() => void) | undefined;

  beforeEach(() => {
    restoreLayout = stubLayout();
  });

  afterEach(() => {
    restoreLayout?.();
  });

  it('holds its rows at the settled width, behind a clip the panel carries', () => {
    render(<Sidebar own={OWN} />);
    const panel = screen.getByRole('navigation');
    expect(panel).toHaveStyle({ overflowX: 'clip' });
    expect(content(panel).style.width).toBe('var(--sidebar-width)');
  });

  it('lets its rows follow the panel once collapsed, so the icons stay centred', () => {
    render(<Sidebar own={OWN} collapsed />);
    expect(content(screen.getByRole('navigation')).style.width).toBe('100%');
  });

  it('scrolls the libraries rather than sharing the panel out between them', () => {
    render(<Sidebar own={MANY} />);
    const region = libraries(screen.getByRole('navigation'));
    expect(region).toHaveStyle({ overflowY: 'auto', minHeight: '0px' });
    // Every row a fixed 32, so twenty of them overflow the box instead of thinning inside it.
    for (const row of screen.getAllByRole('button')) expect(row.style.flex).toBe('0 0 auto');
  });

  it('keeps Trash and Settings out of the scroll, so twenty libraries cannot push them off', () => {
    render(<Sidebar own={MANY} trashCount={3} />);
    const panel = screen.getByRole('navigation');
    const region = libraries(panel);
    expect(region).toContainElement(screen.getByRole('button', { name: /Library 19/ }));
    for (const name of ['Trash', 'Settings', 'Libraries']) {
      expect(region).not.toContainElement(screen.getByRole('button', { name: new RegExp(name) }));
    }
  });

  it('brings the library you are in back into view when the list has scrolled past it', () => {
    render(<Sidebar own={MANY} activeId="library-18" />);
    const region = libraries(screen.getByRole('navigation'));
    // Nineteen rows above it at 32, so its far edge is at 640 and a 200px box has to sit at 440.
    expect(region.scrollTop).toBe(440);
  });

  it('leaves the list alone when the library you are in is already on screen', () => {
    render(<Sidebar own={MANY} activeId="library-1" />);
    expect(libraries(screen.getByRole('navigation')).scrollTop).toBe(0);
  });
});
