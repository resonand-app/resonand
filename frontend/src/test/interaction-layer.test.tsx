/**
 * The components let the stylesheet do its job (`UI-32a`).
 *
 * `components.css` can only paint what the components have stopped painting. A property declared
 * in a style object beats every rule a stylesheet can write, at any specificity, so an inline
 * `background: transparent` does not fight the hover rule -- it wins, silently, for ever. Nothing
 * throws, the component looks exactly right at rest, and the pointer simply does nothing. That is
 * the whole failure mode of this workstream, and it is the thing here worth a test.
 *
 * So the check is derived from the stylesheet rather than written out beside it: read which
 * properties the CSS owns for each `data-ds` name, mount every component in the system, and fail
 * if any of them still states one of those properties inline. A rule added to `components.css`
 * tomorrow is enforced tomorrow, with nothing to remember.
 *
 * The specimen page is the fixture, for the reason it exists at all (`UI-1k`): it is the one place
 * that imports and renders every component at once, and it is already maintained. A component that
 * arrives without a row there is a component this test does not cover, which is a second reason to
 * add the row.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WHOLE_SYSTEM } from './timeouts';

import { ThemeProvider } from '@/design-system';
/* The stylesheets as text. `?raw` rather than `readFileSync`: a test that renders belongs to the
   browser half of the codebase, and that half deliberately cannot see `node:fs`. */
import CSS from '@/design-system/components.css?raw';
import STYLES from '@/design-system/styles.css?raw';
import Specimens from '@/dev/Specimens';

import {
  componentsIn,
  KNOWN_INLINE,
  ownedProperties,
  pointerResponse,
  rulesIn,
} from './interaction-layer';

/** Every component source in the system, as text, keyed by path. */
const SOURCES = import.meta.glob<string>('../../design-system/components/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every element in the mounted system that names itself to the stylesheet. */
function painted(): HTMLElement[] {
  const { container } = render(
    <ThemeProvider>
      <Specimens />
    </ThemeProvider>,
  );
  return [...container.querySelectorAll<HTMLElement>('[data-ds]')];
}

/** What the mounted system still declares inline, of the properties the stylesheet owns. */
function inlineClashes(): Set<string> {
  const owned = ownedProperties(CSS);
  const clashes = new Set<string>();
  for (const element of painted()) {
    const name = element.dataset.ds ?? '';
    for (const property of owned.get(name) ?? []) {
      if (element.style.getPropertyValue(property) !== '') clashes.add(`${name} ${property}`);
    }
  }
  return clashes;
}

describe('the interaction layer', WHOLE_SYSTEM, () => {
  it('ships, rather than sitting beside the stylesheet that ships', () => {
    // A stylesheet nothing imports is a stylesheet that is right and absent.
    expect(STYLES).toContain('components.css');
  });

  it('parses into rules rather than into nothing', () => {
    // Every assertion below passes against an empty rule list, which is the one way this file
    // could be reassuring and useless at the same time.
    expect(rulesIn(CSS).length).toBeGreaterThan(30);
    expect(componentsIn(CSS).size).toBeGreaterThan(12);
  });

  it('states no property inline that the stylesheet owns', () => {
    const excused = new Set(KNOWN_INLINE.map((entry) => `${entry.component} ${entry.property}`));
    expect([...inlineClashes()].filter((clash) => !excused.has(clash))).toEqual([]);
  });

  it('holds no excuse for something that is no longer inline', () => {
    // The half that keeps the list from becoming a place to put things: an exemption whose code
    // has since been fixed fails here, so the fix and the excuse cannot land separately.
    const live = inlineClashes();
    const stale = KNOWN_INLINE.filter((entry) => !live.has(`${entry.component} ${entry.property}`));
    expect(stale).toEqual([]);
  });

  it('says why for every excuse it does hold', () => {
    for (const entry of KNOWN_INLINE) expect(entry.why.length).toBeGreaterThan(60);
  });

  it('paints nothing that no component renders', () => {
    // A rule for a name nothing renders is a rule nobody will notice is wrong -- a typo in a
    // selector is silent, and so is a component that was deleted.
    //
    // Checked against the sources rather than against the mounted page, and the difference
    // matters: `Sheet`, `Tooltip` and `Toast` exist only while something is open, and requiring
    // the specimen page to hold every overlay open would mean a page you have to dismiss three
    // things to read. The reverse direction is deliberately not asserted -- `data-ds` doubles as
    // the name a test finds a component by, so a component the stylesheet has no opinion about
    // may still carry one.
    const declared = new Set(
      Object.values(SOURCES).flatMap((source) =>
        [...source.matchAll(/data-ds="([a-z-]+)"/g)].map((match) => match[1] ?? ''),
      ),
    );
    expect([...componentsIn(CSS)].filter((name) => !declared.has(name))).toEqual([]);
  });

  it('owns the properties the shipped components stopped owning', () => {
    // The specific ones this task moved, named so that moving one back is a failure rather than
    // a diff. Each was inline until `UI-32a`, and each is one hover away from mattering.
    const owned = ownedProperties(CSS);
    for (const name of [
      'button',
      'icon-button',
      'recording-row',
      'transcript-line',
      'sidebar-item',
      'menu-row',
      'create-library-card',
      'chip',
    ]) {
      expect(owned.get(name), name).toContain('background');
    }
    expect(owned.get('library-card')).toContain('box-shadow');
    expect(owned.get('swatch')).toContain('box-shadow');
  });

  it('answers a pointer on every painted control that invites one', () => {
    // `UI-32a`'s criterion is a row that raises one surface step on hover with no React state
    // variable behind it. As a rule that holds for more than one row: a control the system paints
    // and gives a pointer cursor has to acknowledge the pointer.
    const { clickable, painted: hasPaint, responds } = pointerResponse(CSS);
    expect([...clickable].filter((name) => hasPaint.has(name) && !responds.has(name))).toEqual([]);
    // And that set is not empty, because "no control is silent" is also true of no controls.
    expect(responds.size).toBeGreaterThan(8);
  });

  it('keeps interaction out of the components themselves', () => {
    // The other half of "stop trying to own state": a component that tracks the pointer in React
    // re-renders because a pointer moved, which is the cost this file exists to avoid.
    //
    // `Tooltip` is the one component allowed to know where a pointer is, and it is allowed
    // because it is not painting: a tooltip's existence is the thing hovering decides, and no
    // stylesheet can render an element that is not there. It uses the pointer events rather than
    // the mouse ones, which is what this matcher permits and the rule below still forbids.
    const sources = Object.entries(SOURCES).filter(([path]) => !path.includes('.test.'));
    expect(sources.length).toBeGreaterThan(15);
    for (const [path, source] of sources) {
      expect(source, path).not.toMatch(/onMouseEnter|onMouseLeave|onMouseOver/);
      if (path.endsWith('Tooltip.tsx')) continue;
      expect(source, path).not.toMatch(/onPointerEnter|onPointerLeave/);
    }
  });
});
