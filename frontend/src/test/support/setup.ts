/**
 * What every test gets (`INF-3c`).
 *
 * `jest-dom` for the matchers that say what a test means -- `toBeVisible()` rather than a
 * comparison against a computed style -- and a cleanup after each test, because Testing Library
 * mounts into a real document and a component left mounted is the next test's flake.
 */

import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { createI18n } from '@/i18n';

// The real English bundle, in English, for every test (`UI-22a`). A component calls `t()` and a
// test asserts on the sentence a person would read -- which is the assertion worth making, and
// is only possible because the base language is the one the strings are written in. A test that
// needs another language switches this instance; nothing needs a provider.
createI18n('en');

/**
 * Pointer capture, which jsdom does not implement.
 *
 * `Sheet` claims the pointer so a drag that leaves the element still reaches it -- that is what
 * makes swipe-to-dismiss work on a phone, and it is correct. jsdom has no pointer capture at all,
 * so the call throws, and a throw inside an event handler is an unhandled error: every test still
 * passes and the run still fails, which is exactly how it reached CI.
 *
 * Stubbed here rather than guarded in the component, for the reason `ResizeObserver` and
 * `offsetHeight` are stubbed in the tests that need them: this is a gap in the test environment,
 * not a thing the product should be defending against.
 */
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
}

/**
 * Scrolling an element, which jsdom does not implement either.
 *
 * `UI-12b`'s follow moves the transcript by calling `scrollTo` on its scroller, and jsdom leaves
 * `Element.prototype.scrollTo` undefined -- so the call throws inside an effect, which fails the
 * run while every assertion still passes. A no-op is the honest stand-in: there is no layout for
 * a scroll to change, and what the tests are about is what the interface asks for, which they
 * read by spying on this.
 */
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = () => undefined;
}

/**
 * `ResizeObserver`, which jsdom does not implement at all.
 *
 * Three surfaces watch their own size rather than being told it -- the waveform, which redraws at
 * the bar count its width allows, the upload tray, and the detail view's player panel, which
 * fades over its own height as the column scrolls it away. A missing constructor throws inside an
 * effect, which fails a run in which every assertion passed.
 *
 * A no-op, and deliberately not one that reports a size: there is no layout in jsdom to report,
 * and a stub that invented one would have components drawing against a number nothing on the
 * screen agrees with. A test that needs a measurement stubs the measurement.
 */
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  });
}

afterEach(() => {
  cleanup();
});
