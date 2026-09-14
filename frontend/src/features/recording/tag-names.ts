/**
 * Whether two tag names are the same tag (`UI-13c`).
 *
 * Its own module for the reason `name-match.ts` and `peaks.ts` are: it is a rule somebody will
 * want to look up, and a rule about which tag a typed word refers to should not be reachable only
 * through the component that happens to ask.
 */

/**
 * Whether a typed name is a tag that already exists.
 *
 * Case and accents are folded away, because that is what the backend does when it turns a name
 * into the slug it looks a tag up by: `Interview` typed against an archive that has `interview` is the
 * same tag, and `resolve_tag` will return the one that is there whatever spelling the request
 * carried. **The backend stays the authority** -- this is a display preference, so the chip shows
 * the name the recording is about to have rather than the one somebody typed, and a disagreement
 * corrects itself when the response arrives carrying the tags as stored.
 *
 * Deliberately not `matchesName`, which is accent-*sensitive* on purpose: that one guards a typed
 * confirmation before something is destroyed, where "Album" must not pass for "Álbum". Here being
 * strict would offer to create a second spelling of a tag that already exists, which is the
 * mistake in the other direction.
 */
export function sameTag(typed: string, name: string): boolean {
  const fold = (value: string) =>
    value.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase();
  return name !== '' && fold(typed) === fold(name);
}
