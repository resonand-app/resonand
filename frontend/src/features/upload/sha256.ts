/**
 * SHA-256 over a file that does not fit in memory (`UI-18d`, `DEC-16`).
 *
 * The duplicate warning has to happen **before** the bytes go: `GET /audio/duplicates/{sha256}`
 * takes the digest, and the offer for a byte-identical copy in the trash is to restore that one
 * instead. Uploading first and asking afterwards would produce exactly the real duplicate that
 * rule exists to prevent -- a restored recording plus the copy that was just stored.
 *
 * Which leaves the digest to compute here, and neither obvious way of getting it works. WebCrypto
 * has **no incremental digest**: `crypto.subtle.digest` takes one buffer, so it would mean holding
 * the whole file in memory, and the size limit this product ships with is 8 GiB. Adding a hashing
 * dependency for one call is the other way, and the repository has none.
 *
 * So it is written out, and it reads the file a slice at a time: memory is one 64-byte block plus
 * one chunk, whatever the file weighs. It is about eighty lines because SHA-256 is about eighty
 * lines, and it is checked against the published vectors -- a hash function nobody verified is a
 * duplicate check that quietly never matches.
 *
 * `Uint8Array` and `DataView` throughout rather than `Buffer` or a bignum: the digest is defined
 * on 32-bit words with wrapping arithmetic, which is what `>>> 0` and `| 0` are for here.
 */

/** The first thirty-two bits of the fractional parts of the cube roots of the first 64 primes. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** The fractional parts of the square roots of the first eight primes. */
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK = 64;

const rotr = (value: number, by: number): number => (value >>> by) | (value << (32 - by));

/**
 * A digest in progress.
 *
 * Deliberately a small class rather than a closure: the block buffer, how much of it is filled and
 * how many bytes have been seen are one thing that has to stay consistent, and the length is what
 * the padding at the end is computed from.
 */
export class Sha256 {
  private readonly state = new Uint32Array(H0);
  private readonly block = new Uint8Array(BLOCK);
  private readonly words = new Uint32Array(64);
  private filled = 0;
  private length = 0;

  update(bytes: Uint8Array): this {
    this.length += bytes.length;
    let at = 0;
    // Fill whatever is left of the pending block first, so a chunk boundary in the middle of a
    // block is not a different message from the same bytes arriving in one piece.
    if (this.filled > 0) {
      const wanted = Math.min(BLOCK - this.filled, bytes.length);
      this.block.set(bytes.subarray(0, wanted), this.filled);
      this.filled += wanted;
      at = wanted;
      if (this.filled === BLOCK) {
        this.compress(this.block);
        this.filled = 0;
      }
    }
    for (; at + BLOCK <= bytes.length; at += BLOCK) this.compress(bytes.subarray(at, at + BLOCK));
    if (at < bytes.length) {
      this.block.set(bytes.subarray(at), 0);
      this.filled = bytes.length - at;
    }
    return this;
  }

  /** The digest, lowercase hex, as the API's paths and `audio.sha256` spell it. */
  digest(): string {
    const bits = this.length * 8;
    const padding = new Uint8Array(this.filled + 1 <= BLOCK - 8 ? BLOCK : BLOCK * 2);
    padding.set(this.block.subarray(0, this.filled));
    padding[this.filled] = 0x80;
    // The length goes in as 64 bits big-endian. A file over 2^53 bytes is not a thing this
    // product handles, so the high half is derived rather than tracked separately.
    new DataView(padding.buffer).setUint32(padding.length - 8, Math.floor(bits / 2 ** 32));
    new DataView(padding.buffer).setUint32(padding.length - 4, bits >>> 0);
    for (let at = 0; at < padding.length; at += BLOCK) {
      this.compress(padding.subarray(at, at + BLOCK));
    }
    return [...this.state].map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  private compress(block: Uint8Array): void {
    const w = this.words;
    for (let i = 0; i < 16; i += 1) {
      const at = i * 4;
      w[i] =
        ((block[at] ?? 0) << 24) |
        ((block[at + 1] ?? 0) << 16) |
        ((block[at + 2] ?? 0) << 8) |
        (block[at + 3] ?? 0);
    }
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15] ?? 0;
      const b = w[i - 2] ?? 0;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }

    // The eight working variables, read out once. `?? 0` is the compiler's price for indexing a
    // typed array under `noUncheckedIndexedAccess`, and paying it here rather than sixteen times
    // inside the round is the difference between this being readable and not.
    let a = this.state[0] ?? 0;
    let b = this.state[1] ?? 0;
    let c = this.state[2] ?? 0;
    let d = this.state[3] ?? 0;
    let e = this.state[4] ?? 0;
    let f = this.state[5] ?? 0;
    let g = this.state[6] ?? 0;
    let h = this.state[7] ?? 0;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i += 1) this.state[i] = ((this.state[i] ?? 0) + (next[i] ?? 0)) >>> 0;
  }
}

/** How much of a file is held at once. Four mebibytes, whatever the file weighs. */
const CHUNK = 4 * 1024 * 1024;

/**
 * The digest of a whole file, a slice at a time.
 *
 * An hours-long recording is hashed in `CHUNK`-sized pieces and never held in memory. It reads
 * through `Blob.slice` rather than `Blob.stream` because slicing is available everywhere a file
 * can be picked, streams are not, and the memory story is identical -- one chunk at a time either
 * way.
 *
 * **It yields between chunks**, which is the whole reason it is `async` rather than a loop: an
 * 8 GiB file is minutes of arithmetic, and a tab that stops answering while somebody's upload is
 * being prepared is a tab they close.
 *
 * `signal` is honoured because a queue of thirty files somebody cancelled should stop hashing the
 * twenty-ninth.
 */
export async function sha256Of(file: Blob, signal?: AbortSignal): Promise<string> {
  const hash = new Sha256();
  for (let at = 0; at < file.size; at += CHUNK) {
    if (signal?.aborted === true) throw new DOMException('Aborted', 'AbortError');
    hash.update(new Uint8Array(await file.slice(at, at + CHUNK).arrayBuffer()));
  }
  return hash.digest();
}
