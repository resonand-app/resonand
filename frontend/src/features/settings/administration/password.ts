/**
 * The password an administrator hands to somebody locked out (`UI-37`, `API-25`).
 *
 * Generated rather than typed. An administrator inventing a password for somebody else invents a
 * weak one, and this value is going to be read off a screen or pasted into a message either way --
 * so it may as well be strong, and it may as well be the same strength every time rather than
 * whatever occurred to whoever was on shift.
 *
 * Its own module so that it can be exercised without rendering a dialog, and because a file
 * exporting a component and a function is a file fast refresh cannot reload.
 */

/**
 * Unambiguous by construction: no `0`/`O`, no `1`/`l`/`I`.
 *
 * This gets read off one screen and typed on another at least once, and a character somebody has
 * to guess at is a password that comes back reported as broken.
 */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Twenty characters of this alphabet is about 116 bits, so the friendliness costs nothing. */
export const LENGTH = 20;

/**
 * A fresh password.
 *
 * `crypto.getRandomValues` and not `Math.random`: the whole value of this is that nobody can guess
 * it, and `Math.random` is not built to make that true.
 *
 * The modulo is very slightly biased -- 2^32 is not a multiple of 56 -- and the bias is about one
 * part in 77 million per character, which is nothing next to 116 bits. Rejection sampling would
 * remove it and would be the kind of correctness nobody can spend.
 */
export function generatedPassword(random: Crypto = globalThis.crypto): string {
  const values = new Uint32Array(LENGTH);
  random.getRandomValues(values);
  return [...values].map((value) => ALPHABET[value % ALPHABET.length]).join('');
}
