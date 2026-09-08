/**
 * The tree, out of the flat list (`UI-8a`, §V3).
 *
 * Pure arithmetic over the shape the API sends, so it is tested directly rather than through a
 * popover. The two cases that matter are the order -- which is what somebody arranged in V7 -- and
 * the cycle, which cannot happen and must not hang the render if it does.
 */

import { describe, expect, it } from 'vitest';

import { inDrawnOrder, treeOf } from './categories';
import type { Category } from './recordings';

const category = (
  id: number,
  name: string,
  parent_id: number | null = null,
  position = 0,
): Category => ({ id, name, parent_id, position });

describe('the tree', () => {
  it('nests children under their parent', () => {
    const tree = treeOf([category(1, 'Entrevistes'), category(2, 'Àvia', 1)]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.category.name).toBe('Àvia');
    expect(tree[0]?.children[0]?.depth).toBe(1);
  });

  it('orders siblings by position, which is what V7 arranged', () => {
    const tree = treeOf([category(1, 'Zulu', null, 2), category(2, 'Alfa', null, 1)]);
    expect(tree.map((node) => node.category.name)).toEqual(['Alfa', 'Zulu']);
  });

  it('falls back to the name when two share a position', () => {
    // Two categories can share a position after a re-parent, and a list that reorders itself
    // between renders is a list nobody can click accurately.
    const tree = treeOf([category(1, 'Zulu'), category(2, 'Àvia')]);
    expect(tree.map((node) => node.category.name)).toEqual(['Àvia', 'Zulu']);
  });

  it('drops a category whose parent chain never reaches the root', () => {
    // Impossible through the API -- there is a foreign key, and V7 refuses to re-parent a
    // category under its own descendant. The interface still must not be the thing that turns it
    // into a frozen tab.
    const tree = treeOf([category(1, 'Loop', 2), category(2, 'Other', 1)]);
    expect(tree).toEqual([]);
  });

  it('flattens to the order the rows are drawn in, parents before their children', () => {
    const rows = inDrawnOrder(
      treeOf([
        category(1, 'Entrevistes'),
        category(2, 'Àvia', 1),
        category(3, 'Reunions', null, 1),
      ]),
    );
    expect(rows.map((row) => row.category.name)).toEqual(['Entrevistes', 'Àvia', 'Reunions']);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 0]);
  });
});
