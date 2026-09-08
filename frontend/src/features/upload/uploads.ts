/**
 * The upload queue, which outlives every view (`UI-18`, `UI-18e`, §3.3).
 *
 * **This is the reason upload is a tray and not a modal.** `UI-18`'s hard requirement is that an
 * upload is not lost when somebody navigates or switches tab, and an hours-long file makes that
 * concrete. A dialog that owned the transfers would abort them the moment it closed, so the
 * transfers live here -- a store outside the routes, like the player -- and every surface that
 * shows them is drawing this rather than holding it.
 *
 * **One at a time.** Thirty files uploading at once share the same uplink thirty ways, so the
 * first one finishes thirtieth; sequential means the first recording is in the archive and being
 * probed while the rest are still queued. It also makes "3 of 30 uploaded" a sentence with an
 * obvious meaning.
 *
 * **`XMLHttpRequest`, not `fetch`.** Not a preference: `fetch` cannot report how much of a request
 * body has been sent, and per-file progress on an 8 GiB file is the difference between an
 * interface that is working and one that has frozen. The typed client stays on `fetch` for
 * everything else rather than growing a second path for one endpoint.
 *
 * **Uploads are not resumable and nothing here pretends otherwise.** `POST /libraries/{uuid}/audio`
 * is a single request; an interruption restarts it. There is no pause, and the absence is the
 * design (`UI-18f`).
 */

import { create } from 'zustand';

import { get, patch } from '@/api/client';
import { ApiProblem, problemFrom, unreachable } from '@/api/problem';
import type { components } from '@/api/schema';

import { sha256Of } from './sha256';

export type Recording = components['schemas']['AudioDetail'];
export type DuplicateWarning = components['schemas']['DuplicateWarning'];

/** Where a batch is going. Chosen once in the dialog and carried by every file in it. */
export interface Destination {
  library: string;
  /** Optional, and applied after the upload -- see `file` below for why it is a second request. */
  categoryId?: number | undefined;
  /**
   * Whether to ask for a transcription as the recording arrives.
   *
   * The flag the upload endpoint takes. **Nothing sets it without having said where the audio
   * goes first** (`UI-25`, §3.4): the disclosure is beside the switch in the dialog, which is the
   * moment the decision is made rather than the moment the request is sent.
   */
  transcribe?: boolean;
}

export type UploadStatus =
  /** Queued behind the ones before it. */
  | 'waiting'
  /** Being hashed, and asked about, before a byte goes (`UI-18d`). */
  | 'checking'
  /** This exact file is already here. Waiting for somebody to say what to do about it. */
  | 'duplicate'
  | 'uploading'
  | 'done'
  /** Deliberately not uploaded: the copy already here was restored, or the warning was heeded. */
  | 'skipped'
  | 'failed';

export interface Upload {
  /** Stable for the life of the tray. The name is not: two files can be called the same thing. */
  id: string;
  name: string;
  /** In bytes, for the progress detail and for the size limit. */
  size: number;
  library: string;
  categoryId?: number | undefined;
  transcribe: boolean;
  status: UploadStatus;
  /** How much has left this machine, in bytes. */
  sent: number;
  /** What the instance said, when it refused. §1.9's `detail`, shown rather than replaced. */
  error?: string;
  /** The recording it became, once it is one. */
  uuid?: string;
  /** The recording that is already here, byte for byte, when there is one. */
  duplicate?: DuplicateWarning;
}

export interface UploadsState {
  files: Upload[];
  /** Whether the tray is showing one line or the whole list. Not in the URL (§2.1). */
  collapsed: boolean;
  /** Add files to the queue and start it if it is not already going. */
  add: (files: readonly File[], destination: Destination) => void;
  /**
   * Answer a duplicate warning: send it anyway, or leave it alone.
   *
   * Never a silent block (`DEC-16`): the warning names what is already here and this is how
   * somebody overrules it. `skip` is also what the tray calls after restoring the copy that was
   * in the trash, because at that point the file has been dealt with without being sent.
   */
  decide: (id: string, decision: 'upload' | 'skip') => void;
  /** Forget the finished ones. Refused while anything is still going. */
  clear: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

let running = false;
let sequence = 0;

export const useUploads = create<UploadsState>((set, get) => ({
  files: [],
  collapsed: false,

  add: (files, destination) => {
    if (files.length === 0) return;
    const queued: Upload[] = files.map((file) => {
      sequence += 1;
      return {
        id: `${String(sequence)}-${file.name}`,
        name: file.name,
        size: file.size,
        library: destination.library,
        categoryId: destination.categoryId,
        transcribe: destination.transcribe ?? false,
        status: 'waiting',
        sent: 0,
      };
    });
    pending.push(...files.map((file, index) => ({ file, id: queued[index]?.id ?? '' })));
    set({ files: [...get().files, ...queued], collapsed: false });
    void drain();
  },

  decide: (id, decision) => {
    if (get().files.find((one) => one.id === id)?.status !== 'duplicate') return;
    if (decision === 'skip') {
      held.delete(id);
      update(id, { status: 'skipped' });
      return;
    }
    const file = held.get(id);
    held.delete(id);
    if (file === undefined) return;
    update(id, { status: 'waiting' });
    // Marked as decided, so the duplicate check does not stop it a second time on the way past.
    pending.push({ file, id, anyway: true });
    void drain();
  },

  clear: () => {
    if (get().files.some((one) => one.status === 'waiting' || one.status === 'uploading')) return;
    set({ files: [] });
  },

  setCollapsed: (collapsed) => {
    set({ collapsed });
  },
}));

/** The files themselves, beside the store rather than in it: a `File` is not state to render. */
const pending: { file: File; id: string; anyway?: boolean }[] = [];

/**
 * Files waiting on a decision about a duplicate.
 *
 * Held here rather than left at the front of the queue: a warning nobody has answered must not
 * stop the other twenty-nine files, and the `File` has to survive until somebody does answer.
 */
const held = new Map<string, File>();

/** Change one file's row, by id, leaving the rest of the queue alone. */
function update(id: string, change: Partial<Upload>): void {
  useUploads.setState((state) => ({
    files: state.files.map((one) => (one.id === id ? { ...one, ...change } : one)),
  }));
}

/** Work through the queue, one file at a time, until there is nothing left. */
async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = pending.shift();
      if (next === undefined) return;
      const row = useUploads.getState().files.find((one) => one.id === next.id);
      if (row === undefined) continue;
      try {
        if (next.anyway !== true && (await warn(next.id, next.file))) continue;
        update(next.id, { status: 'uploading', sent: 0 });
        const recording = await send(row.library, next.file, row.transcribe, (sent) => {
          update(next.id, { sent });
        });
        await categorise(recording.uuid, row.categoryId);
        update(next.id, { status: 'done', sent: row.size, uuid: recording.uuid });
      } catch (cause) {
        // Partial failure is the normal case at thirty files, not an exception: the one that
        // failed stops, the queue does not (`UI-18f`).
        update(next.id, {
          status: 'failed',
          error: cause instanceof ApiProblem ? cause.detail : String(cause),
        });
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Ask whether this exact file is already here, before a byte of it goes (`UI-18d`, `DEC-16`).
 *
 * **Before, and not after.** `GET /audio/{uuid}/duplicates` would answer the same question about a
 * recording that has already been stored, and the offer this warning makes -- restore the copy
 * that is in the trash instead -- would then produce the real duplicate the rule exists to
 * prevent: a restored recording plus the one just uploaded.
 *
 * The hash is the price of asking first, and it is paid per file as its turn comes rather than for
 * the whole batch up front, so the first file starts uploading while the thirtieth is still
 * untouched.
 *
 * **A failure to check is not a failure to upload.** If the hash or the request goes wrong the
 * file is sent: the duplicate warning is a courtesy the archive offers, and refusing somebody's
 * recording because the courtesy failed would be the interface serving itself.
 */
async function warn(id: string, file: File): Promise<boolean> {
  update(id, { status: 'checking' });
  let found: DuplicateWarning[];
  try {
    const sha256 = await sha256Of(file);
    found = await get('/api/audio/duplicates/{sha256}', { path: { sha256 } });
  } catch {
    return false;
  }
  const first = found[0];
  if (first === undefined) return false;
  held.set(id, file);
  update(id, { status: 'duplicate', duplicate: first });
  return true;
}

/**
 * Put the recording in the category the batch chose.
 *
 * A second request, because `POST /libraries/{uuid}/audio` takes a file, a transcribe flag and a
 * language and nothing else -- the category is a field on the recording, so it is set on the
 * recording. **It is deliberately not allowed to fail the upload**: the bytes are stored and the
 * recording exists, and reporting that as a failed upload would invite somebody to send an
 * hours-long file again to fix a missing category they can set in one click.
 */
async function categorise(uuid: string, categoryId: number | undefined): Promise<void> {
  if (categoryId === undefined) return;
  try {
    await patch('/api/audio/{audio_uuid}', {
      path: { audio_uuid: uuid },
      body: { category_id: categoryId },
    });
  } catch {
    // Deliberately silent here. The recording is in the archive with no category, which is a
    // state the interface already draws and somebody can correct in the detail view.
  }
}

/**
 * One file, with progress.
 *
 * The problem document is parsed the same way the typed client parses it, so a refusal reads the
 * same here as anywhere else -- §1.9's `detail` is written to be shown to a person, and an upload
 * that reported "Error 413" instead would be the one place in the product that does not.
 */
function send(
  library: string,
  file: File,
  transcribe: boolean,
  onProgress: (sent: number) => void,
): Promise<Recording> {
  return new Promise<Recording>((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);
    // Only when it was asked for. Sending `false` would be the same request, and leaving it out
    // is what makes the flag readable in a network log as a decision somebody took.
    if (transcribe) body.append('transcribe', 'true');

    const request = new XMLHttpRequest();
    request.open('POST', `/api/libraries/${encodeURIComponent(library)}/audio`);
    request.responseType = 'text';
    // Nothing else to attach: the session cookie is the authorisation and the interface is served
    // from the same origin as the API, so it goes with the request like every other call.
    request.setRequestHeader('accept', 'application/json');

    request.upload.addEventListener('progress', (event) => {
      onProgress(event.loaded);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText || '{}') as Recording);
        return;
      }
      void problemFrom(
        new Response(request.responseText, {
          status: request.status,
          headers: { 'content-type': request.getResponseHeader('content-type') ?? 'text/plain' },
        }),
      ).then(reject, reject);
    });
    request.addEventListener('error', () => {
      reject(unreachable(new Error('The upload did not reach the instance.')));
    });
    request.send(body);
  });
}
