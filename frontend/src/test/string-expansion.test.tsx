/**
 * 🧪 The +30% string pass (`UI-24c`, `UI-22d`, §1.6).
 *
 * German and Catalan run about a third longer than English. `pseudo.ts` builds a locale that is
 * exactly that -- every string a third longer, wrapped in `«»`, with its vowels accented -- and
 * this points it at every view.
 *
 * **What jsdom can and cannot answer, said plainly.** It lays nothing out, so nothing here can
 * see a label collide with the control beside it; and even a browser could not assert it, because
 * `text-overflow: ellipsis` clips a string without changing its `textContent`. Truncation stays a
 * visual check -- `?lang=pseudo` in a dev build is the tool, and the `»` ending every string is
 * what makes a cut one visible at a glance. §1.6 names the filter bar and the dense list as where
 * to look first.
 *
 * What a test *can* answer is the half that had actually broken, and it had broken badly. The
 * pseudo-locale exists so that **a string which never reached the bundle stays short and Latin**,
 * and that is a property of the DOM rather than of the layout. Pointing it at a mounted view found
 * three places rendering English whatever language was asked for:
 *
 * - the **sidebar's six labels**, hardcoded in the design system while `shell.json` had four of
 *   them sitting unused;
 * - the waveform's **"No waveform yet"**, on every card in a library whose peaks job has not run;
 * - and **the egress notice** -- the sentence telling somebody their recording is about to leave
 *   the machine. Principle 2's only implementation, in English, for everybody.
 *
 * No amount of looking at English screens shows any of those, which is what this file is for.
 *
 * **It does not run axe again** (`INF-24`). The locale changes the words and none of the structure
 * axe reads: no component branches on the length of a string -- every `.length` test in the
 * interface counts a list -- so a longer name cannot remove a control, and the English audits in
 * `accessibility.test.tsx` already read every name there is.
 *
 * **The assertion is narrow on purpose: no English *bundle value* may appear.** The obvious check
 * -- flag any text without brackets -- flags the whole archive, because a recording's title, its
 * transcript and its owner's name are content and not copy. Asking instead whether a string the
 * product wrote in `src/i18n/en/` is on screen untranslated catches exactly the failure above and
 * needs no list of the fixture to do it.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { resources } from '@/i18n';
import { pseudo } from '@/i18n/pseudo';
import { mockApi } from '@/test/api/server';
import { VIEWS, mountView } from '@/test/support/views';

import { WHOLE_SYSTEM } from './support/timeouts';

mockApi();

/** The locale that is English plus thirty per cent. Development only, which is why it is here. */
const PSEUDO = 'pseudo';

/**
 * Sentences the **server** authors and the interface renders as data (`UI-24c`).
 *
 * Two of them, and both are a real limitation rather than a bug in the client: the wording is
 * chosen in Python and arrives over the wire already written, so the interface has no more say
 * over its language than it has over a recording's title.
 *
 * They are listed because each happens to collide with a string the bundle also holds, which is
 * what makes them look like the failure this file hunts. **When a second language ships, these
 * are backend work** -- `resonand.core.levels.DESCRIPTIONS` and `about_search`'s recall sentence
 * -- and this list is where that is written down.
 */
const AUTHORED_BY_THE_SERVER: { text: string; why: string }[] = [
  {
    text: 'Can read',
    why: 'The head of a sentence in `resonand.core.levels.DESCRIPTIONS`, which `GET /instance` now sends for all three grantable levels (`API-18`) and `LevelSelector` splits on its colon. It used to be only the levels a library had granted; the selector explains the ones it has not, which is the whole point of the endpoint carrying the vocabulary.',
  },
  {
    text: 'Can edit',
    why: 'The head of another sentence in `resonand.core.levels.DESCRIPTIONS`, sent by `GET /instance`. The client holds the same short name in common.json for the library byline, and deliberately does not choose it here: the selector renders the API`s wording so the two cannot drift.',
  },
  {
    text: 'Can manage',
    why: 'The third sentence in `resonand.core.levels.DESCRIPTIONS`, sent by `GET /instance`. It appears now where it did not before, because the selector explains every grantable level rather than only the ones a library has already granted (`API-18`).',
  },
];

/** Every leaf string the product wrote in `src/i18n/en/`. */
function englishStrings(): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Anything with a placeholder never renders verbatim, so it cannot be looked for.
      if (trimmed !== '' && !trimmed.includes('{{')) found.add(trimmed);
      return;
    }
    if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
  };
  walk(resources.en);
  return found;
}

const ENGLISH = englishStrings();
const EXCUSED = new Set(AUTHORED_BY_THE_SERVER.map((entry) => entry.text));

/** Every run of visible text in the document, trimmed and de-duplicated. */
function visibleText(): string[] {
  const found = new Set<string>();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
    const text = (node.textContent ?? '').trim();
    if (text !== '') found.add(text);
  }
  return [...found];
}

/**
 * The view's own settle marker, in whichever language it ends up in.
 *
 * It cannot simply be the English one, and it cannot simply be `«` either. Some markers are the
 * product's copy, which the pseudo-locale rewrites; others are the archive's content, which it
 * leaves alone. And settling on the first bracket to appear settles on the page header, which
 * arrives long before the view's data -- an audit run then is an audit of a skeleton, and it was
 * a skeleton's heading order that failed here before this existed.
 */
function eitherLanguage(settled: string | RegExp): RegExp {
  if (settled instanceof RegExp) return settled;
  const escaped = [settled, pseudo(settled)].map((one) =>
    one.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(escaped.join('|'));
}

/** A view mounted in the +30% locale, settled on the same content the English pass waits for. */
async function inPseudo(view: (typeof VIEWS)[number]): Promise<void> {
  await mountView({ ...view, settled: eitherLanguage(view.settled) }, { language: PSEUDO });
  await waitFor(() => {
    expect(document.body.textContent).toContain('«');
  });
}

describe.each(VIEWS)('$name in the +30% locale', WHOLE_SYSTEM, (view) => {
  it('renders no English the bundle could have translated', async () => {
    await inPseudo(view);
    const untranslated = visibleText().filter((text) => ENGLISH.has(text) && !EXCUSED.has(text));
    expect(untranslated).toEqual([]);
  });
});

describe('the pass itself', WHOLE_SYSTEM, () => {
  it('is looking at a page that really is in the pseudo-locale', async () => {
    // The one way every assertion above passes having checked nothing: a view still in English
    // renders every bundle string verbatim, so this would be the noisiest failure in the file.
    const [first] = VIEWS;
    if (first === undefined) throw new Error('VIEWS is empty.');
    await inPseudo(first);
    expect(visibleText().filter((text) => text.includes('«')).length).toBeGreaterThan(3);
  });

  it('read the bundle, so an empty answer is not an empty haystack', () => {
    expect(ENGLISH.size).toBeGreaterThan(100);
  });

  it('says why for each sentence it excuses', () => {
    for (const entry of AUTHORED_BY_THE_SERVER) expect(entry.why.length).toBeGreaterThan(60);
  });
});
