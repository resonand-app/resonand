/**
 * Plausible content for the specimen route (`UI-1k`).
 *
 * Written to be plausible for a Catalan family archive, which is what the product is for -- the
 * same register the prototype's sample data used. It lives here rather than in the design system
 * because none of it is real: `UI-1e` through `UI-1h` stripped exactly this kind of content out of
 * the components' defaults so that a forgotten prop reads as empty rather than as somebody else's
 * recording. This is the one place it belongs, and it is a development-only module.
 */

import { generatePeaks } from '@/design-system';

export const PEAKS = generatePeaks(11, 240);

export const LIBRARIES = [
  { id: 'avia', name: 'Àvia Teresa', colour: 'var(--library-clay)', count: 37 },
  { id: 'carrer', name: 'La casa de Carrer Nou', colour: 'var(--library-moss)', count: 12 },
  { id: 'cancons', name: 'Cançons i nadales', colour: 'var(--library-plum)', count: 8 },
];

export const SHARED = [
  { id: 'oncle', name: "L'oncle Jordi", colour: 'var(--library-slate)', count: 4 },
];

export const HITS = [
  {
    kind: 'recording' as const,
    title: 'Entrevista amb l’àvia Teresa',
    excerpt: '…i la casa de Carrer Nou tenia un balcó que donava a la plaça…',
    at: '18:04',
  },
  {
    kind: 'recording' as const,
    title: 'Dinar de Nadal, 1998',
    excerpt: '…el balcó era on la iaia estenia la roba…',
    at: '04:41',
  },
  {
    kind: 'library' as const,
    title: 'La casa de Carrer Nou',
    excerpt: '12 recordings · 6 h 20 min',
  },
];
