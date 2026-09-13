/**
 * Running axe, and saying what it found in a way somebody can act on (`UI-23a`).
 *
 * axe is the only part of accessibility that a machine can hold: it catches the mechanical
 * failures -- a control with no name, a label pointing at nothing, an `aria-*` value that is not
 * one of the allowed ones, a heading that skips a level -- and it is silent about everything that
 * needs judgement. That is the right division. The judgement half is `UI-23b` and `UI-23c`, which
 * are separate tasks because they are separate kinds of check.
 *
 * **What jsdom cannot answer, and what covers it instead.** Colour contrast needs a painted page:
 * jsdom computes no colours, so axe's `color-contrast` rule returns "incomplete" rather than a
 * pass or a fail, and a rule that can never fail is a rule that reads as a green tick nobody
 * earned. It is switched off here and asserted properly in `contrast.node.test.ts`, which reads
 * the token pairs out of the stylesheet and computes the ratios directly -- in both themes, which
 * is more than a browser run would give. Nothing else is switched off.
 */

import axe, { type Result } from 'axe-core';

/**
 * The rules jsdom cannot answer, each with what does answer it.
 *
 * The list only ever shrinks, and an entry without a second home for the check does not belong
 * in it -- turning a rule off because it is noisy is how an audit becomes decoration.
 */
export const NOT_JUDGED_HERE: Record<string, string> = {
  'color-contrast':
    'Needs a painted page; jsdom computes no colours. Asserted from the tokens in contrast.node.test.ts, in both themes.',
};

/** Every violation axe finds, with the rules jsdom cannot judge left out. */
export async function violationsIn(root: Element = document.body): Promise<Result[]> {
  const results = await axe.run(root, {
    resultTypes: ['violations'],
    rules: Object.fromEntries(
      Object.keys(NOT_JUDGED_HERE).map((rule) => [rule, { enabled: false }]),
    ),
  });
  return results.violations;
}

/**
 * What a failure prints.
 *
 * The rule, what it means, and the element -- because "serious: buttons must have discernible
 * text" with no selector is a failure somebody has to reproduce before they can fix it, and the
 * selector is the whole difference between a five-minute fix and an afternoon.
 */
export function describeViolations(violations: readonly Result[]): string {
  return violations
    .map((violation) => {
      const where = violation.nodes
        .map((node) => `      ${node.target.join(' ')}\n        ${node.failureSummary ?? ''}`)
        .join('\n');
      return `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n${where}`;
    })
    .join('\n');
}
