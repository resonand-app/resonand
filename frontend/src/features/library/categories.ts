/**
 * A tree, out of the flat list the API sends (`UI-8a`, §V3).
 *
 * `GET /libraries/{uuid}/categories` answers `id`, `parent_id`, `name`, `position` -- which is the
 * right shape to send and the wrong shape to draw. Assembling it here rather than asking the API
 * for a nested one keeps the endpoint answering the question it is good at, and it means the two
 * places a tree is drawn -- this filter and V7's editor -- assemble it the same way.
 *
 * **Order is `position`, then name.** `position` is what somebody arranged in V7 (`ordered_ids`),
 * so it wins; the fallback matters because two categories can share a position after a re-parent,
 * and a list that reorders itself between renders is a list nobody can click accurately.
 *
 * **A cycle is dropped rather than followed.** A category whose parent chain does not reach the
 * root cannot be drawn, and following one hangs the render. It should be impossible -- the
 * database has a foreign key and V7 refuses to re-parent a category under its own descendant --
 * which is exactly why the interface must not be the thing that turns it into a frozen tab.
 */

import type { Category } from './recordings';

export interface CategoryNode {
  category: Category;
  /** How deep, for the indent. Zero at the root. */
  depth: number;
  children: CategoryNode[];
}

/** The tree, roots first. */
export function treeOf(categories: readonly Category[]): CategoryNode[] {
  const byParent = new Map<number | null, Category[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parent_id) ?? [];
    siblings.push(category);
    byParent.set(category.parent_id, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort(inOrder);

  const seen = new Set<number>();
  const build = (parent: number | null, depth: number): CategoryNode[] =>
    (byParent.get(parent) ?? [])
      .filter((category) => !seen.has(category.id))
      .map((category) => {
        seen.add(category.id);
        return { category, depth, children: build(category.id, depth + 1) };
      });

  return build(null, 0);
}

/**
 * The tree flattened back to a list, in the order it is drawn.
 *
 * A popover is a list of rows however deep the tree is: the depth is an indent, not a nesting of
 * containers, because a keyboard moving down a tree of `<ul>`s has to escape each one.
 */
export function inDrawnOrder(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...inDrawnOrder(node.children)]);
}

function inOrder(left: Category, right: Category): number {
  if (left.position !== right.position) return left.position - right.position;
  return left.name.localeCompare(right.name);
}
