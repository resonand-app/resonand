/**
 * Invented content for the specimen route (`UI-1k`).
 *
 * Deliberately generic: a library is "Field recordings" and a recording is "Field recording, long
 * take", so nothing here reads as somebody's archive. It lives here rather than in the design
 * system because none of it is real: `UI-1e` through `UI-1h` stripped exactly this kind of content
 * out of the components' defaults so that a forgotten prop reads as empty rather than as somebody
 * else's recording. This is the one place it belongs, and it is a development-only module.
 */

import { generatePeaks } from '@/design-system';

export const PEAKS = generatePeaks(11, 240);

export const LIBRARIES = [
  { id: 'interviews', name: 'Interviews', colour: 'var(--library-clay)', count: 37 },
  { id: 'field', name: 'Field recordings', colour: 'var(--library-moss)', count: 12 },
  { id: 'music', name: 'Music', colour: 'var(--library-plum)', count: 8 },
];

export const SHARED = [
  { id: 'meetings', name: 'Meetings', colour: 'var(--library-slate)', count: 4 },
];

export const HITS = [
  {
    kind: 'recording' as const,
    title: 'Field recording, long take',
    excerpt: '…the third segment mentions rehearsal, which is the word search is asked for…',
    at: '18:04',
  },
  {
    kind: 'recording' as const,
    title: 'Digitised cassette',
    excerpt: '…the fourth segment is a short one…',
    at: '04:41',
  },
  {
    kind: 'library' as const,
    title: 'Field recordings',
    excerpt: '12 recordings · 6 h 20 min',
  },
];
