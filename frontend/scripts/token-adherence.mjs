/**
 * The one rule the system does not bend, written once (`UI-1i`).
 *
 * **No colour is ever written inside a component.** Every value comes from a token, because that
 * is what makes `[data-theme="light"]` a redefinition rather than a second stylesheet, and what
 * lets `UI-33c` audit AA contrast by checking token pairs instead of grepping the tree.
 *
 * It is enforced twice, from this one description: ESLint reads the patterns below so the failure
 * arrives while the hex is being typed, and `token-adherence.node.test.ts` reads them so it also
 * arrives in CI on a machine where nobody ran the editor. Two mechanisms, one definition -- a
 * second copy of these regexes is a second rule that would quietly diverge from the first.
 *
 * `ui-plan.md` says to port the three rules `_adherence.oxlintrc.json` already encodes. **That
 * file does not exist in this repository** -- neither in the tree nor anywhere in its history --
 * so these are authored rather than ported, and the count of three is theirs rather than a
 * constraint. What is here is a colour rule, a font rule, and the exemption list that makes the
 * first of them land against code that already breaks it.
 */

/**
 * A CSS colour written as a value: `#C4574A`, `#fff`, `rgba(...)`, `hsl(...)`.
 *
 * The hex half is anchored so it cannot match a fragment reference -- `url(#wave-3f2a)` is how the
 * waveform clips its played half, and a rule that called that a colour would be a rule everybody
 * turns off.
 */
export const COLOUR_PATTERN =
  '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])|(?:rgba?|hsla?)\\s*\\([^)]*\\)';

/**
 * A font stack written out instead of taken from a token.
 *
 * Three families, three jobs, no fourth case -- and the fallback stacks belong in
 * `tokens/typography.css` where all three are declared together.
 */
export const FONT_PATTERN =
  '\\b(?:Geist|Chillax|ui-sans-serif|ui-monospace|system-ui|SFMono-Regular)\\b';

export const COLOUR_MESSAGE =
  "No colour inside a component. Use a token: token('--accent') or var(--accent).";
export const FONT_MESSAGE =
  'No font stack inside a component. Use var(--font-sans), var(--font-mono) or var(--font-display).';

/**
 * The bypasses that already exist, and the task that removes each one.
 *
 * **This list only ever shrinks.** `UI-33a` is the task that empties it, and the test asserts both
 * directions: an entry that stops matching is a stale exemption and fails, so removing the last
 * `#C4574A` from the tree forces the line below to go with it. That is what stops an exemption
 * list from becoming a place to put things.
 */
export const KNOWN_BYPASSES = [
  {
    file: 'components/forms/TextField.tsx',
    value: '#C4574A',
    why: "UI-33a: the error ring matches no token. It is nearest to `--state-failed`, and that is a decision rather than a rename, so it is that task's to take.",
  },
  {
    file: 'components/forms/Button.tsx',
    value: 'rgba(232,180,92,.2)',
    why: "UI-33a: the primary button's amber glow, hard-coded and therefore identical in light mode, where it should not be.",
  },
];

/**
 * Every line of a source file that writes a colour or a font stack.
 *
 * Comments are stripped first: this file's own prose names `#C4574A` and `Geist`, and so do the
 * explanations beside the two exemptions.
 *
 * @param {string} source
 * @returns {{ line: number, value: string, kind: 'colour' | 'font' }[]}
 */
export function findBypasses(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ' '));

  /** @type {{ line: number, value: string, kind: 'colour' | 'font' }[]} */
  const found = [];
  for (const [kind, pattern] of /** @type {const} */ ([
    ['colour', COLOUR_PATTERN],
    ['font', FONT_PATTERN],
  ])) {
    for (const match of stripped.matchAll(new RegExp(pattern, 'g'))) {
      const line = stripped.slice(0, match.index).split('\n').length;
      found.push({ line, value: match[0], kind });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}
