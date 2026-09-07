/**
 * What `components.css` claims, as data (`UI-32a`).
 *
 * The interaction layer works only if the components let it: a property declared inline wins
 * against every rule a stylesheet can write, so a hover that changes a background is silently
 * dead the moment the resting background is a style object. That failure is invisible -- nothing
 * throws, the component looks right, and the pointer simply does nothing -- which is why it is
 * checked rather than remembered.
 *
 * This module reads the stylesheet and answers one question: which properties does the CSS own,
 * for which component? `interaction-layer.test.tsx` renders the system and holds every component
 * to the answer. It is a separate file for the reason `scripts/token-adherence.mjs` is one: the
 * description of a rule and the check that enforces it are different things, and the description
 * is the half worth reading.
 *
 * It is `.ts` under `src/test/` rather than `.mjs` under `scripts/` because its consumer renders
 * components -- so it belongs to the browser half of the codebase, which cannot see `node:fs`
 * and does not need to: the stylesheet arrives as a `?raw` import rather than as a path.
 *
 * The parser is deliberately small. `components.css` is hand-written, flat, and has one comment
 * style; a real CSS parser would be a dependency taken on to keep a rule honest that fits in
 * forty lines.
 */

export interface Rule {
  /** The selector as written, with runs of whitespace collapsed. */
  selector: string;
  /** The property names it sets, in source order. */
  properties: string[];
}

/** Every rule in the stylesheet. */
export function rulesIn(css: string): Rule[] {
  const rules: Rule[] = [];
  // Comments first: the prose in that file names selectors and properties it is not declaring.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // `@media` wrappers are unwrapped rather than parsed -- what matters is the rule inside one.
  const flat = source.replace(/@media[^{]+\{/g, '');
  for (const match of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    if (selector === '' || selector.startsWith('@')) continue;
    const properties = [...(match[2] ?? '').matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)]
      .map((found) => found[1] ?? '')
      .filter((name) => name !== '');
    if (properties.length > 0) rules.push({ selector, properties });
  }
  return rules;
}

/**
 * One selector's comma-separated parts, split at the top level only.
 *
 * `:where(button, [role='button'])` contains a comma that does not separate selectors, and a bare
 * `split(',')` on it produces two fragments that are each nonsense -- which is how a hover rule
 * stops being visible to a check that reads it.
 */
export function selectorParts(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of selector) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts.filter((part) => part !== '');
}

/** The component a selector is about: the last `data-ds` name before any combinator. */
function subjectOf(part: string): string | undefined {
  const subject = part.split(/[ >+~]/).pop() ?? '';
  return /\[data-ds='([a-z-]+)'\]/.exec(subject)?.[1];
}

/** Every `data-ds` name the stylesheet mentions. */
export function componentsIn(css: string): Set<string> {
  return new Set(
    [...css.matchAll(/\[data-ds='([a-z-]+)'\]/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== ''),
  );
}

/**
 * Which properties the stylesheet owns, per `data-ds` name.
 *
 * A property counts as owned when a rule sets it on a selector whose subject is that component --
 * resting rules and hover rules alike, because the two have to be on the same side of the line.
 * A rule reaching a descendant (`[data-ds='field-box'] input`) is not ownership of the
 * descendant; it is a rule about the field's input, and the input is not a component.
 */
export function ownedProperties(css: string): Map<string, Set<string>> {
  const owned = new Map<string, Set<string>>();
  for (const { selector, properties } of rulesIn(css)) {
    for (const part of selectorParts(selector)) {
      const name = subjectOf(part);
      if (name === undefined) continue;
      const set = owned.get(name) ?? new Set<string>();
      for (const property of properties) set.add(property);
      owned.set(name, set);
    }
  }
  return owned;
}

export interface PointerResponse {
  /** Given a `cursor: pointer` at rest. */
  clickable: Set<string>;
  /** Given a background or an elevation at rest. */
  painted: Set<string>;
  /** Has a `:hover` or `:active` rule. */
  responds: Set<string>;
}

/**
 * Which components the stylesheet paints and marks clickable, and which of those answer a pointer.
 *
 * `UI-32a`'s criterion, read as a rule that holds for more than one row: a control the system
 * both paints and gives a `cursor: pointer` has to acknowledge the pointer, because saying "this
 * can be pressed" and then not responding is the state the prototyping harness was faking.
 *
 * Painted is the qualifier that makes it fair. The seekable waveform takes a pointer cursor and
 * deliberately nothing else -- the bars are the data and nothing is drawn over them -- so it is
 * not in that set and needs no excuse for not being.
 */
export function pointerResponse(css: string): PointerResponse {
  const clickable = new Set<string>();
  const painted = new Set<string>();
  const responds = new Set<string>();
  for (const { selector, properties } of rulesIn(css)) {
    for (const part of selectorParts(selector)) {
      const name = subjectOf(part);
      if (name === undefined) continue;
      if (/:hover|:active/.test(part)) {
        responds.add(name);
        continue;
      }
      if (properties.includes('cursor')) clickable.add(name);
      if (properties.includes('background') || properties.includes('box-shadow')) painted.add(name);
    }
  }
  return { clickable, painted, responds };
}

export interface InlineExemption {
  component: string;
  property: string;
  why: string;
}

/**
 * A property a component still states inline, and why that is allowed to stand.
 *
 * The same shape as `token-adherence.mjs`'s list and held to the same standard: an entry says
 * why, and the test fails if an entry stops being true. An exemption that outlives the thing it
 * excuses is how a list like this becomes a place to put things.
 */
export const KNOWN_INLINE: InlineExemption[] = [
  {
    component: 'icon-button',
    property: 'color',
    why: 'PlayerBar lifts its two skip glyphs from --text-3 to --text-2, which is a resting colour nothing needs to vary: the background is the property hover changes, and that is never inline. Revisit if UI-5 gives the player a tone of its own.',
  },
];
