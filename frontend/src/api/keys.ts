/**
 * What a cached thing is called (`UI-3c`).
 *
 * One factory, so a query and the mutation that has to invalidate it are never two people's
 * guesses at the same array. Every key starts with the noun it is about and gets narrower to the
 * right, which is what makes a prefix match mean "everything about this library" without anybody
 * maintaining a second list of what that includes.
 *
 * The keys are `as const` tuples rather than strings: `['library', uuid, 'audio', filters]` is
 * one key with a shape the compiler checks, and a typo in it is a cache miss that looks exactly
 * like a slow network.
 */

/** The filters a library's list or a search can carry. Whatever is in the URL (§2.1). */
export type ListFilters = Record<string, unknown> | undefined;

export const keys = {
  /** What this instance is. The one call made without a session. */
  instance: () => ['instance'] as const,

  /** The signed-in account, its sessions, and what it may do. */
  me: () => ['me'] as const,
  sessions: () => ['me', 'sessions'] as const,

  /** Everything about libraries, and one library. */
  libraries: () => ['libraries'] as const,
  library: (uuid: string) => ['libraries', uuid] as const,
  libraryAudio: (uuid: string, filters?: ListFilters) =>
    ['libraries', uuid, 'audio', filters ?? {}] as const,
  libraryShares: (uuid: string) => ['libraries', uuid, 'shares'] as const,
  libraryCategories: (uuid: string) => ['libraries', uuid, 'categories'] as const,

  /** One recording, and the things hanging off it. */
  recording: (uuid: string) => ['recordings', uuid] as const,
  /** How its transcription is going: the state, the attempt, the failure (`API-17`). */
  transcription: (uuid: string) => ['recordings', uuid, 'transcription'] as const,
  transcript: (uuid: string) => ['recordings', uuid, 'transcript'] as const,
  transcripts: (uuid: string) => ['recordings', uuid, 'transcripts'] as const,
  waveform: (uuid: string, peaks: number) => ['recordings', uuid, 'waveform', peaks] as const,

  /** The whole archive, filtered. */
  search: (filters?: ListFilters) => ['search', filters ?? {}] as const,
  searchAbout: () => ['search', 'about'] as const,
  /**
   * Every autocomplete's answer, and one of them.
   *
   * A prefix match compares strings for equality, so `tags('')` reaches the query that asked for
   * nothing and none of the ones somebody typed into. A change to a recording's tags has to
   * reach all of them.
   */
  allTags: () => ['tags'] as const,
  tags: (prefix: string) => ['tags', prefix] as const,

  /** What is deleted, and how long it has left. */
  trash: () => ['trash'] as const,
  trashedAudio: (filters?: ListFilters) => ['trash', 'audio', filters ?? {}] as const,
  trashedLibraries: (filters?: ListFilters) => ['trash', 'libraries', filters ?? {}] as const,

  /** Where audio goes when it is transcribed. Readable by anybody (`API-12`). */
  transcriptionDestination: () => ['transcription', 'destination'] as const,

  /** Administration. Not a sidebar entry, and not fetched unless somebody opens it. */
  jobs: (filters?: ListFilters) => ['admin', 'jobs', filters ?? {}] as const,
  /** The tally alone, which moves while the queue does. Cheap where `systemStatus` is not. */
  jobCounts: () => ['admin', 'jobs', 'counts'] as const,
  systemStatus: () => ['admin', 'status'] as const,
  provider: () => ['admin', 'transcription'] as const,
  /**
   * What the last check found, which the instance does not hold and cannot be asked for.
   *
   * Under `provider`'s prefix because it is about the same thing, and separate from it because
   * the two have different lifetimes: one is refetched, the other is an observation somebody made
   * at a moment. Nothing fetches it -- `useTestProvider` is its only writer.
   */
  providerCheck: () => ['admin', 'transcription', 'check'] as const,
  users: () => ['admin', 'users'] as const,
} as const;

export type QueryKey = ReturnType<(typeof keys)[keyof typeof keys]>;
