import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Chip,
  ColorSwatchPicker,
  CreateLibraryCard,
  Dialog,
  Icon,
  IconButton,
  LibraryCard,
  Logo,
  PlayerBar,
  ProfileMenu,
  RecordingCard,
  RecordingRow,
  SearchField,
  SearchResults,
  Sidebar,
  StateBadge,
  TextField,
  THEME_CHOICES,
  TopNav,
  TranscriptLine,
  TRANSCRIPTION_STATE_NAMES,
  useTheme,
  Waveform,
} from '@/design-system';
import type { IconName, LibraryColorName } from '@/design-system';

import { HITS, LIBRARIES, PEAKS, SHARED, SHORT_PEAKS } from '@/dev/specimen-data';

/**
 * Every component in the system, on one page, in whichever theme you ask for (`UI-1k`).
 *
 * `UI-1`'s criterion is that every component renders in the app in both themes. That was an
 * assertion nobody could check: the design system's own specimens were HTML files that fetched
 * React and Babel from a CDN and transformed `.jsx` in the browser, which stopped working the
 * moment `UI-1d` renamed the first file. This replaces all six of them, and it replaces them with
 * something better -- the components as the application imports them, through the barrel, with
 * the real theme provider on top, so what you are looking at is what ships.
 *
 * **Development only.** It is reached at `#/specimens` and the whole module sits behind
 * `import.meta.env.DEV`, so the production bundle does not contain it.
 *
 * `UI-33c`'s contrast audit and `UI-32c`'s focus check are performed here.
 */

const GLYPHS: IconName[] = [
  'search',
  'upload',
  'panel-left',
  'library',
  'plus',
  'play',
  'pause',
  'skip-back',
  'skip-forward',
  'share-2',
  'more-vertical',
  'trash-2',
  'sliders-horizontal',
  'moon',
  'log-out',
  'align-left',
  'clock',
  'tag',
  'x',
  'chevron-left',
  'circle-dashed',
  'loader',
  'check',
  'alert-circle',
];

/** The seventeen specimen cards in `guidelines/`, which are standalone HTML and stay that way. */
const GUIDELINES = [
  'colors-surfaces-dark',
  'colors-surfaces-light',
  'colors-amber',
  'colors-state',
  'colors-library',
  'type-display',
  'type-interface',
  'type-numeric',
  'type-rule',
  'spacing-scale',
  'spacing-layout',
  'shape-radii',
  'shape-elevation',
  'motion-focus',
  'brand-mark',
  'brand-waveform',
  'brand-voice',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-overline-size)',
          fontWeight: 'var(--type-overline-weight)',
          letterSpacing: 'var(--type-overline-tracking)',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 'var(--space-4)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Panel({
  label,
  width,
  children,
}: {
  label: string;
  width?: number | string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: width ?? 'auto',
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ThemeControl() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {THEME_CHOICES.map((option) => (
        <Button
          key={option}
          variant={choice === option ? 'primary' : 'secondary'}
          onClick={() => {
            setChoice(option);
          }}
        >
          {option}
        </Button>
      ))}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          color: 'var(--text-3)',
        }}
      >
        showing {resolved}
      </span>
    </div>
  );
}

export default function Specimens() {
  const [colour, setColour] = useState<LibraryColorName>('clay');
  const [query, setQuery] = useState('carrer nou');

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        padding: 'var(--page-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--type-page-title-size)',
            fontWeight: 'var(--type-page-title-weight)',
            letterSpacing: 'var(--type-page-title-tracking)',
            lineHeight: 'var(--type-page-title-leading)',
          }}
        >
          Specimens
        </h1>
        <ThemeControl />
      </header>

      <Section title="Foundation">
        <Panel label="Logo">
          <Logo size={26} />
        </Panel>
        <Panel label="Logo, mark only">
          <Logo size={26} showWordmark={false} />
        </Panel>
        <Panel label={`Icon · ${String(GLYPHS.length)} registered glyphs`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: 560 }}>
            {GLYPHS.map((name) => (
              <Icon key={name} name={name} size={19} title={name} />
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Forms">
        <Panel label="Button">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="primary" icon="upload">
              Upload audio
            </Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger" icon="trash-2">
              Delete for good
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Panel>
        <Panel label="IconButton">
          <div style={{ display: 'flex', gap: 8 }}>
            <IconButton icon="play" label="Play" />
            <IconButton icon="more-vertical" variant="ghost" label="Options" />
            <IconButton icon="library" label="Libraries" active />
          </div>
        </Panel>
        <Panel label="TextField" width={260}>
          <TextField label="Library name" defaultValue="Àvia Teresa" />
        </Panel>
        <Panel label="TextField · error" width={260}>
          <TextField
            label="Library name"
            defaultValue="Àvia Teresa"
            error="You already have a library with this name."
          />
        </Panel>
        <Panel label="SearchField" width={320}>
          <SearchField
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </Panel>
        <Panel label="ColorSwatchPicker">
          <ColorSwatchPicker value={colour} onChange={setColour} />
        </Panel>
      </Section>

      <Section title="Media">
        {(
          [
            ['dense row · 20', 20],
            ['library card · 38', 38],
            ['recording card · 52', 52],
            ['player · 34', 34],
            ['audio detail · 130', 130],
          ] as const
        ).map(([label, height]) => (
          <Panel key={label} label={label} width={320}>
            <Waveform peaks={PEAKS} height={height} played={0.375} playhead />
          </Panel>
        ))}
        <Panel label="pending · no peaks job yet" width={320}>
          <Waveform peaks={PEAKS} height={38} pending />
        </Panel>
        <Panel label="PlayerBar" width={900}>
          <PlayerBar
            title="Entrevista amb l’àvia Teresa"
            library="Àvia Teresa"
            peaks={PEAKS}
            position="18:04"
            duration="48:12"
            played={0.375}
            playing
          />
        </Panel>
        <Panel label="TranscriptLine" width={520}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <TranscriptLine at="18:01" onClick={() => undefined}>
              I la casa de Carrer Nou tenia un balcó que donava a la plaça.
            </TranscriptLine>
            <TranscriptLine at="18:04" active onClick={() => undefined}>
              La iaia hi estenia la roba, i des d’allà se sentia el mercat.
            </TranscriptLine>
            <TranscriptLine at="18:11" onClick={() => undefined}>
              Això era abans de la guerra, molt abans que jo nasqués.
            </TranscriptLine>
          </div>
        </Panel>
      </Section>

      <Section title="Data">
        <Panel label="StateBadge · chip">
          <div style={{ display: 'flex', gap: 8 }}>
            {TRANSCRIPTION_STATE_NAMES.map((state) => (
              <StateBadge key={state} state={state} />
            ))}
          </div>
        </Panel>
        <Panel label="StateBadge · glyph">
          <div style={{ display: 'flex', gap: 12 }}>
            {TRANSCRIPTION_STATE_NAMES.map((state) => (
              <StateBadge key={state} state={state} variant="glyph" />
            ))}
          </div>
        </Panel>
        <Panel label="Chip">
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip>memòria</Chip>
            <Chip>català</Chip>
            <Chip active>1998</Chip>
          </div>
        </Panel>
        <Panel label="LibraryCard · CreateLibraryCard" width={672}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--grid-gap)' }}>
            <LibraryCard
              name="Àvia Teresa"
              meta="37 recordings · 24 h 12 min"
              colour="var(--library-clay)"
              peaks={PEAKS}
              onOpen={() => undefined}
            />
            <CreateLibraryCard />
          </div>
        </Panel>
        <Panel label="RecordingCard" width={320}>
          <RecordingCard
            name="Entrevista amb l’àvia Teresa"
            meta="48:12 · 12 Mar 2026"
            state="done"
            tags={['memòria', 'català']}
            peaks={PEAKS}
            played={0.375}
          />
        </Panel>
        <Panel label="RecordingRow" width={520}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TRANSCRIPTION_STATE_NAMES.map((state, i) => (
              <RecordingRow
                key={state}
                name={`Entrevista amb l’àvia Teresa · ${state}`}
                duration="48:12"
                state={state}
                peaks={SHORT_PEAKS}
                selected={i === 1}
                onOpen={() => undefined}
              />
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Navigation">
        <Panel label="Sidebar" width={224}>
          <Sidebar own={LIBRARIES} shared={SHARED} trashCount={3} activeId="avia" />
        </Panel>
        <Panel label="Sidebar · collapsed" width={52}>
          <Sidebar own={LIBRARIES} shared={SHARED} trashCount={3} collapsed />
        </Panel>
        <Panel label="ProfileMenu" width={236}>
          <ProfileMenu name="Martí Colom" email="marti@sonarium.app" initials="MC" theme="Dark" />
        </Panel>
        <Panel label="SearchResults" width={420}>
          <SearchResults hits={HITS} total={214} query="carrer nou" />
        </Panel>
        <Panel label="Dialog" width={420}>
          <Dialog
            title="Delete this library?"
            description="Deleting Àvia Teresa also deletes its 37 recordings. They go to the trash for 30 days."
            footer={
              <>
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Delete library</Button>
              </>
            }
          >
            <TextField label="Type the library name to confirm" placeholder="Àvia Teresa" />
          </Dialog>
        </Panel>
      </Section>

      <Section title="TopNav">
        <Panel label="TopNav" width="100%">
          <div style={{ width: '100%' }}>
            <TopNav
              initials="MC"
              query={query}
              onQueryChange={setQuery}
              onToggleSidebar={() => undefined}
            />
          </div>
        </Panel>
      </Section>

      <Section title="Guidelines">
        <p
          style={{
            margin: 0,
            fontSize: 'var(--type-ui-size)',
            color: 'var(--text-3)',
            lineHeight: 1.6,
            maxWidth: 620,
          }}
        >
          The seventeen specimen cards are standalone HTML that a designer opens directly, so they
          are framed rather than ported. Each one pins <code>data-theme=&quot;dark&quot;</code> in
          its own markup, which is why the control above does not reach them.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--grid-gap)',
            width: '100%',
          }}
        >
          {GUIDELINES.map((card) => (
            <iframe
              key={card}
              title={card}
              src={`/design-system/guidelines/${card}.html`}
              style={{
                width: '100%',
                height: 240,
                border: 'none',
                borderRadius: 'var(--radius-panel)',
                boxShadow: 'var(--elevation-panel)',
                background: 'var(--surface)',
              }}
            />
          ))}
        </div>
      </Section>
    </main>
  );
}
