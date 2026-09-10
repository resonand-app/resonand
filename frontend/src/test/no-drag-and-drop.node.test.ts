/**
 * 🧪 Nothing in the interface is dragged (`UI-24b`, §2.3).
 *
 * The distinction this rests on is worth stating, because the words look like a contradiction.
 * The upload dialog **does** accept a file dropped onto it, and `UI-18a` asks for exactly that: a
 * drop zone and a picker. That is the browser handing over something the operating system was
 * already dragging, and it costs a touchscreen nothing, because a touchscreen simply never
 * produces it.
 *
 * What `UI-24b` forbids is drag-and-drop **as an interaction the interface invents**: a draggable
 * row, a drag to reorder categories, a drag to move a recording into another library. Every one
 * of those is unavailable on a phone -- a finger dragging a card is a finger scrolling -- so a
 * feature built that way is a feature half the people using this product cannot reach. Moving a
 * recording is a dialog (`UI-19`), and getting audio in is the system picker.
 *
 * So the rule is one-directional and checkable: a file may be dropped **on** the interface, and
 * nothing in the interface may be made draggable. `draggable` and `onDragStart` are the two ways
 * to make something draggable, and neither may appear anywhere.
 *
 * This is a check on the shape of the repository rather than on a screen, for the reason
 * `egress-disclosure.node.test.ts` is: what has to stay true is a property of the whole tree, and
 * the failure it exists to catch is the surface somebody adds next year.
 */

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The two ways to make something draggable.
 *
 * `draggable` as an attribute, and `onDragStart` as the handler that is meaningless without it.
 * Deliberately not `onDrop` or `onDragOver`: those are how a target receives what the *system*
 * is dragging, which is the upload drop zone and is allowed.
 */
const MAKES_SOMETHING_DRAGGABLE = [/\bdraggable\b/, /\bonDragStart\b/];

/** Every source file the interface ships, tests and the specimen page aside. */
function sources(): { path: string; source: string }[] {
  return ['src', 'design-system']
    .flatMap((tree) =>
      globSync('**/*.{ts,tsx}', { cwd: resolve(FRONTEND, tree) }).map(
        (path) => `${tree}/${path.split('\\').join('/')}`,
      ),
    )
    .filter((path) => !path.includes('.test.') && !path.startsWith('src/test/'))
    .sort()
    .map((path) => ({ path, source: readFileSync(resolve(FRONTEND, path), 'utf8') }));
}

describe('drag-and-drop as an interaction', () => {
  it('is nowhere in the interface', () => {
    const dragging = sources()
      .filter(({ source }) => MAKES_SOMETHING_DRAGGABLE.some((pattern) => pattern.test(source)))
      .map(({ path }) => path);
    expect(dragging).toEqual([]);
  });

  it('read the tree at all, so an empty answer means something', () => {
    // The one way the assertion above could pass having looked at nothing.
    expect(sources().length).toBeGreaterThan(50);
  });
});

describe('a file dropped from the desktop', () => {
  it('is still accepted, because that is what `UI-18a` asks for', () => {
    // The other direction, and the reason the rule above is written the narrow way it is. If the
    // drop zone ever disappears, this fails rather than leaving the distinction above looking
    // like an accident nobody meant.
    const zone = sources().find(({ path }) => path.endsWith('features/upload/UploadDialog.tsx'));
    expect(zone).toBeDefined();
    expect(zone?.source).toMatch(/\bonDrop\b/);
  });
});
