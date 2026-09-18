/**
 * A controllable `EventSource`, because jsdom has none (`REV-12`).
 *
 * The real thing opens a connection and reconnects on its own schedule, neither of which a test
 * can wait for. This is the smallest stand-in that still puts the code under test through the
 * interface a browser gives it: the same events, the same `close()`, and the same two states that
 * decide whether the interface polls.
 *
 * `msw` is not the seam here. It answers `fetch`, and an `EventSource` is not one -- which is why
 * the handler for `/api/events` in `test/api/handlers.ts` exists only to keep the unhandled
 * request guard quiet.
 */

export class FakeEventSource {
  static opened: FakeEventSource[] = [];

  readonly url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.opened.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  /** The instance accepting the subscription. */
  open(): void {
    this.onopen?.();
  }

  /** The instance naming something that changed. */
  send(type: string, uuid?: string): void {
    const data = uuid === undefined ? '{}' : JSON.stringify({ uuid });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data }));
    }
  }

  /** The connection dropping, which a browser reports without saying whether it will retry. */
  fail(): void {
    this.onerror?.();
  }

  /** What a test reaches for: the stream this render opened. */
  static latest(): FakeEventSource {
    const source = FakeEventSource.opened.at(-1);
    if (source === undefined) throw new Error('nothing opened a stream');
    return source;
  }
}

/** Install it for one test, and take it away again. */
export function withEventSource(): void {
  FakeEventSource.opened = [];
  Object.defineProperty(globalThis, 'EventSource', {
    value: FakeEventSource,
    configurable: true,
    writable: true,
  });
}

export function withoutEventSource(): void {
  FakeEventSource.opened = [];
  Reflect.deleteProperty(globalThis, 'EventSource');
}
