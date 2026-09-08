/**
 * The digest the duplicate check is made of (`UI-18d`).
 *
 * Checked against the published vectors, and against the platform's own implementation for
 * anything longer. A hash function nobody verified is a duplicate check that quietly never
 * matches -- which looks exactly like an archive with no duplicates in it.
 */

import { describe, expect, it } from 'vitest';

import { Sha256, sha256Of } from './sha256';

/** The three vectors from FIPS 180-4's own appendix, plus the empty message. */
const VECTORS: [string, string][] = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
];

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('sha-256', () => {
  it.each(VECTORS)('digests %o to the published answer', (message, expected) => {
    expect(new Sha256().update(bytes(message)).digest()).toBe(expected);
  });

  it('gives the same answer however the bytes arrive', async () => {
    // The one bug that matters in a streaming digest: a chunk boundary inside a 64-byte block
    // producing a different message from the same file read in one piece.
    const message = 'a'.repeat(1000);
    const once = new Sha256().update(bytes(message)).digest();
    const chunked = new Sha256();
    for (let at = 0; at < message.length; at += 7) {
      chunked.update(bytes(message.slice(at, at + 7)));
    }
    expect(chunked.digest()).toBe(once);
    expect(await sha256Of(new Blob([message]))).toBe(once);
  });

  it('pads a message that fills its last block, which needs a whole extra one', () => {
    // 56 bytes is where the length no longer fits beside the padding, and where an
    // implementation that allocated one block instead of two writes the length over the message.
    for (const length of [55, 56, 57, 63, 64, 65]) {
      const message = 'x'.repeat(length);
      expect(new Sha256().update(bytes(message)).digest()).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Sha256().update(bytes('x'.repeat(56))).digest()).toBe(
      '04c26261370ee7541549d16dee320c723e3fd14671e66a099afe0a377c16888e',
    );
    expect(new Sha256().update(bytes('x'.repeat(64))).digest()).toBe(
      '7ce100971f64e7001e8fe5a51973ecdfe1ced42befe7ee8d5fd6219506b5393c',
    );
  });

  it('hashes a file a slice at a time, never holding it whole', async () => {
    // The point of the whole module: `crypto.subtle` takes one buffer and the size limit this
    // product ships with is 8 GiB.
    const file = new File([new Uint8Array(200_000)], 'long.wav');
    expect(await sha256Of(file)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stops when the queue it belongs to is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sha256Of(new Blob(['abc']), controller.signal)).rejects.toThrow(/abort/i);
  });
});
