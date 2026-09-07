/**
 * The design system's entry point (`UI-1c`).
 *
 * One import specifier, `@/design-system`, and nothing outside this folder reaches past it into
 * `components/**` -- a lint rule says so, because a barrel nobody is held to is a longer path to
 * the same file. What it buys is the freedom `DEC-21` assumes: the system is the application's
 * component source and is versioned with it, so a component that moves between family folders,
 * or gains a wrapper, or is split in two, is a change to this file and to nothing that consumes
 * it.
 *
 * The stylesheet is deliberately not re-exported from here. `styles.css` is linked once from the
 * application entry and read directly by the seventeen cards in `guidelines/`; a CSS import
 * buried in a barrel is one that fires whenever anything imports anything, in an order nobody
 * controls.
 *
 * **It grows one family folder at a time.** `UI-1d` through `UI-1h` convert the twenty-one
 * shipped components from `.jsx`, and each of those tasks adds its own block below. That is the
 * whole reason the conversion is five tasks instead of one: this file is where you can see how
 * far it has got.
 */

export { TOKENS, token } from './tokens';
export type { Token } from './tokens';
export { LIBRARY_COLORS } from './library-colors';
export type { LibraryColorName } from './library-colors';
export { TRANSCRIPTION_STATES, TRANSCRIPTION_STATE_NAMES } from './transcription-states';
export type { TranscriptionState } from './transcription-states';
export { prefersReducedMotion, scrollBehaviour, usePrefersReducedMotion } from './theme/reduced-motion';
export { THEME_CHOICES, useTheme } from './theme/theme';
export type { ResolvedTheme, ThemeChoice, ThemeState } from './theme/theme';
export { ThemeProvider } from './theme/ThemeProvider';
export type { ThemeProviderProps } from './theme/ThemeProvider';

// --- components/foundation (`UI-1d`) ----------------------------------------
export { Icon } from './components/foundation/Icon';
export type { IconName, IconProps } from './components/foundation/Icon';
export { Logo } from './components/foundation/Logo';
export type { LogoProps } from './components/foundation/Logo';

// --- components/forms (`UI-1e`) ---------------------------------------------
export { Button } from './components/forms/Button';
export type { ButtonProps } from './components/forms/Button';
export { ColorSwatchPicker } from './components/forms/ColorSwatchPicker';
export type { ColorSwatchPickerProps } from './components/forms/ColorSwatchPicker';
export { IconButton } from './components/forms/IconButton';
export type { IconButtonProps } from './components/forms/IconButton';
export { SearchField } from './components/forms/SearchField';
export type { SearchFieldProps } from './components/forms/SearchField';
export { TextField } from './components/forms/TextField';
export type { TextFieldProps } from './components/forms/TextField';

// --- components/media (`UI-1f`) ---------------------------------------------
export { generatePeaks } from './components/media/generate-peaks';
export { amplitudeAt, bucketCount, resamplePeaks } from './components/media/peaks';
export type { Peaks } from './components/media/peaks';
export { PlayerBar } from './components/media/PlayerBar';
export type { PlayerBarProps } from './components/media/PlayerBar';
export { TranscriptLine } from './components/media/TranscriptLine';
export type { TranscriptLineProps } from './components/media/TranscriptLine';
export { WAVE_SIZES } from './components/media/wave-sizes';
export type { WaveSize } from './components/media/wave-sizes';
export { Waveform } from './components/media/Waveform';
export type { WaveformProps } from './components/media/Waveform';

// --- components/data (`UI-1g`) ----------------------------------------------
export { Chip } from './components/data/Chip';
export type { ChipProps } from './components/data/Chip';
export { CreateLibraryCard } from './components/data/CreateLibraryCard';
export type { CreateLibraryCardProps } from './components/data/CreateLibraryCard';
export { LibraryCard } from './components/data/LibraryCard';
export type { LibraryCardProps } from './components/data/LibraryCard';
export { RecordingCard } from './components/data/RecordingCard';
export type { RecordingCardProps } from './components/data/RecordingCard';
export { RecordingRow } from './components/data/RecordingRow';
export type { RecordingRowProps } from './components/data/RecordingRow';
export { StateBadge } from './components/data/StateBadge';
export type { StateBadgeProps } from './components/data/StateBadge';

// --- components/navigation (`UI-1h`) ----------------------------------------
export { Dialog } from './components/navigation/Dialog';
export type { DialogProps } from './components/navigation/Dialog';
export { ProfileMenu } from './components/navigation/ProfileMenu';
export type { ProfileMenuProps } from './components/navigation/ProfileMenu';
export { SearchResults } from './components/navigation/SearchResults';
export type { SearchHit, SearchResultsProps } from './components/navigation/SearchResults';
export { Sidebar } from './components/navigation/Sidebar';
export type { SidebarLibrary, SidebarProps } from './components/navigation/Sidebar';
export { TopNav } from './components/navigation/TopNav';
export type { TopNavProps } from './components/navigation/TopNav';
