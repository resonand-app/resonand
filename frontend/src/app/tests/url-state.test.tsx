/**
 * Every filter survives a reload and a back button (`UI-4b`, §2.1).
 *
 * The criterion is written as a round trip because that is what it means in use: what the URL
 * says is what the list shows, and what the list shows is what the URL says. A test that only
 * checked the reader would pass while the writer dropped a parameter.
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  DEFAULTS,
  filtersFrom,
  isFiltered,
  queryFrom,
  searchFrom,
  useUrlState,
} from '../url-state';
import type { Filters } from '../url-state';

/** The filters as read from a query string, and back again. */
function roundTrip(query: string): string {
  return searchFrom(filtersFrom(new URLSearchParams(query))).toString();
}

describe('what the URL carries', () => {
  it('keeps every filter a list can be narrowed by', () => {
    const query =
      'q=rehearsal&category_id=2&tag=field&tag=outdoor&transcription_state=done' +
      '&transcription_state=failed&recorded_from=2026-01-01&recorded_to=2026-03-31' +
      '&min_duration_ms=60000&max_duration_ms=3600000&sort=title&direction=asc&view=list';
    const parameters = new URLSearchParams(roundTrip(query));
    expect(parameters.get('q')).toBe('rehearsal');
    expect(parameters.getAll('tag')).toEqual(['field', 'outdoor']);
    expect(parameters.getAll('transcription_state')).toEqual(['done', 'failed']);
    expect(parameters.get('sort')).toBe('title');
    expect(parameters.get('direction')).toBe('asc');
    expect(parameters.get('view')).toBe('list');
  });

  it('leaves out what is at its default, so a copied link says what was changed', () => {
    expect(roundTrip('')).toBe('');
    expect(roundTrip('sort=recorded_at&direction=desc&view=grid')).toBe('');
  });

  it('drops a filter rather than sending an empty one', () => {
    // `?transcription_state=` asks for recordings whose state is the empty string, and the API
    // would be right to answer nothing.
    expect(roundTrip('transcription_state=&tag=&q=')).toBe('');
  });

  it('discards a state that is not one of the four', () => {
    // A hand-edited URL should narrow a list, never widen it into an error.
    expect(
      filtersFrom(new URLSearchParams('transcription_state=done&transcription_state=x')).states,
    ).toEqual(['done']);
  });

  it('reads the four states as a union rather than as the last one', () => {
    // JOB-11b, and the way this goes wrong looks right: one state, a plausible list.
    const filters = filtersFrom(
      new URLSearchParams('transcription_state=none&transcription_state=done'),
    );
    expect(filters.states).toEqual(['none', 'done']);
  });

  it('falls back to the API defaults rather than inventing its own', () => {
    const filters = filtersFrom(new URLSearchParams('sort=nonsense&direction=sideways'));
    expect(filters.sort).toBe(DEFAULTS.sort);
    expect(filters.direction).toBe(DEFAULTS.direction);
  });
});

describe('what the API is asked', () => {
  it('sends nothing at all for an unfiltered list, except how to order it', () => {
    expect(queryFrom(filtersFrom(new URLSearchParams()))).toEqual({
      sort: 'recorded_at',
      direction: 'desc',
    });
  });

  it('does not send the view mode, which is nothing to do with the API', () => {
    const asked = queryFrom(filtersFrom(new URLSearchParams('view=list')));
    expect(asked).not.toHaveProperty('view');
  });

  it('knows whether anything is narrowing the list, which the empty state depends on', () => {
    // "No recordings yet" and "nothing matches this filter" are different states with different
    // ways out (§3.5).
    expect(isFiltered(filtersFrom(new URLSearchParams('view=list')))).toBe(false);
    expect(isFiltered(filtersFrom(new URLSearchParams('tag=field')))).toBe(true);
    expect(isFiltered(filtersFrom(new URLSearchParams('q=rehearsal')))).toBe(true);
  });
});

/**
 * The hook as a view uses it, with the location it produced.
 *
 * `renderHook` rather than a probe component: what is under test is a round trip between a hook
 * and the address bar, and a component that wrote the hook's value into a module variable during
 * render would be doing the one thing React asks components not to do.
 */
function drive(search: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/library/x${search}`]}>{children}</MemoryRouter>
  );
  const { result } = renderHook(
    () => ({ url: useUrlState(), location: useLocation(), navigate: useNavigate() }),
    { wrapper },
  );
  return {
    get where() {
      return result.current.location.pathname + result.current.location.search;
    },
    set(changes: Partial<Filters>) {
      act(() => {
        result.current.url.set(changes);
      });
    },
    clear() {
      act(() => {
        result.current.url.clear();
      });
    },
    go(to: string | number) {
      act(() => {
        void (typeof to === 'number' ? result.current.navigate(to) : result.current.navigate(to));
      });
    },
  };
}

describe('changing a filter', () => {
  it('puts it in the URL, where a reload will find it', () => {
    const list = drive('');
    list.set({ states: ['done'] });
    expect(list.where).toContain('transcription_state=done');
  });

  it('keeps the filters it was not asked to change', () => {
    // Sorting a filtered list must not clear the filter, which is the bug this shape prevents.
    const list = drive('?tag=field');
    list.set({ sort: 'title' });
    expect(list.where).toContain('tag=field');
    expect(list.where).toContain('sort=title');
  });

  it('clears the filters and keeps what is not one', () => {
    const list = drive('?q=rehearsal&view=list&tag=field&transcription_state=done');
    list.clear();
    expect(list.where).not.toContain('tag=');
    expect(list.where).not.toContain('transcription_state=');
    expect(list.where).toContain('q=rehearsal');
    expect(list.where).toContain('view=list');
  });

  it('turns one off by saying so', () => {
    const list = drive('?category_id=2');
    list.set({ categoryId: undefined });
    expect(list.where).not.toContain('category_id');
  });
});

describe('leaving and coming back', () => {
  it('returns to the filtered list rather than to an unfiltered one', () => {
    // The other half of the criterion, and the reason a filter change replaces rather than
    // pushes: opening a recording is the navigation, so back is the way back to the filter --
    // not an undo of the last keystroke in the filter bar.
    const list = drive('');
    list.set({ states: ['done'], tags: ['field'] });
    list.go('/recording/abc');
    expect(list.where).toContain('/recording/abc');
    list.go(-1);
    expect(list.where).toContain('transcription_state=done');
    expect(list.where).toContain('tag=field');
  });
});
