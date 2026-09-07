import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Checkbox,
  Chip,
  ColorSwatchPicker,
  CreateLibraryCard,
  Dialog,
  Icon,
  IconButton,
  LevelSelector,
  LibraryCard,
  Logo,
  Menu,
  PlayerBar,
  ProfileMenu,
  Progress,
  RecordingCard,
  RecordingRow,
  SearchField,
  SearchResults,
  Select,
  Sheet,
  Sidebar,
  StateBadge,
  Switch,
  Tabs,
  TextField,
  THEME_CHOICES,
  Toast,
  Tooltip,
  TopNav,
  TranscriptLine,
  TRANSCRIPTION_STATE_NAMES,
  useTheme,
  WAVE_SIZES,
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
  'chevron-down',
  'minus',
  'circle-dashed',
  'loader',
  'check',
  'alert-circle',
];

/** Sort orders, which are what `V3`'s filter bar actually offers (§4). */
const SORTS = [
  { value: 'recorded', label: 'Recording date' },
  { value: 'uploaded', label: 'Upload date' },
  { value: 'duration', label: 'Duration' },
  { value: 'title', label: 'Title' },
];

/** What a recording's overflow menu offers (§2.4). Nothing here is ever disabled: an action the
 *  user cannot take is absent from the list. */
const RECORDING_ACTIONS = [
  { id: 'download', label: 'Download the original', icon: 'upload' as const },
  { id: 'move', label: 'Move to another library', icon: 'library' as const },
  { id: 'retranscribe', label: 'Re-transcribe', icon: 'align-left' as const },
  {
    id: 'trash',
    label: 'Send to trash',
    icon: 'trash-2' as const,
    destructive: true,
    separated: true,
  },
];

/** `level_description` exactly as `GET /libraries/{uuid}/shares` returns it -- the wording lives
 *  in `sonarium/core/levels.py` and the interface has no copy of it. Owner is here to prove it is
 *  dropped rather than drawn. */
const LEVELS = [
  { level: 10, description: 'Can read: listen and read the transcript, and change nothing.' },
  { level: 20, description: 'Can edit: change titles, categories and tags, but not share.' },
  { level: 30, description: 'Can manage: everything above, plus sharing with other people.' },
  { level: 40, description: 'Owner: the library belongs to them.' },
];

/** Settings' four sections (§4, V10). */
const SETTINGS_TABS = [
  { value: 'account', label: 'Account' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'administration', label: 'Administration' },
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
  const [sort, setSort] = useState('recorded');
  const [section, setSection] = useState('appearance');
  const [transcribe, setTranscribe] = useState(true);
  const [picked, setPicked] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [level, setLevel] = useState(20);

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
        <Panel label="Select">
          <Select label="Sort" value={sort} onChange={setSort} options={SORTS} />
        </Panel>
        <Panel label="Select · disabled">
          <Select label="Category" options={SORTS} placeholder="Any category" disabled />
        </Panel>
        <Panel label="Progress · determinate only" width={340}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Progress value={0.64} label="Entrevista àvia 03.m4a" detail="64% · 284 MB" />
            <Progress value={0.1} label="Overall" detail="3 of 30 uploaded, 1 failed" />
          </div>
        </Panel>
        <Panel label="Checkbox">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Checkbox checked={picked} onChange={setPicked} label="Select this recording" />
            <Checkbox checked="mixed" onChange={() => undefined} label="Select all" />
            <Checkbox checked={false} onChange={() => undefined} label="In a row" size="row" />
            <Checkbox checked onChange={() => undefined} label="Unavailable" disabled />
          </div>
        </Panel>
        <Panel label="Switch" width={320}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Switch
              checked={transcribe}
              onChange={setTranscribe}
              label="Transcribe when the upload finishes"
              description="Transcription is sent to api.openai.com. The audio leaves this instance."
            />
            <Switch
              checked={false}
              onChange={() => undefined}
              label="Watch a folder for new files"
              disabled
            />
          </div>
        </Panel>
        <Panel label="Select · open" width={240}>
          {/* Held open, the way the components canvas draws it: a menu nobody can see is a menu
              nobody can review, and the open state is where most of its geometry lives. */}
          <Select
            label="Speed"
            value={sort}
            onChange={setSort}
            options={SORTS}
            open
            onOpenChange={() => undefined}
          />
        </Panel>
      </Section>

      <Section title="Media">
        {WAVE_SIZES.map((size) => (
          <Panel key={size} label={`Waveform · ${size}`} width={320}>
            <Waveform peaks={PEAKS} size={size} played={0.375} playhead />
          </Panel>
        ))}
        <Panel label="pending · the peaks job has not run" width={320}>
          {/* `peaks` is passed and ignored, which is the whole point of the state. */}
          <Waveform peaks={PEAKS} size="card" pending duration="48:12" />
        </Panel>
        <Panel label="silence · every peak zero" width={320}>
          <Waveform peaks={new Array<number>(400).fill(0)} size="record" />
        </Panel>
        <Panel label="seekable · the detail size" width={520}>
          <Waveform
            peaks={PEAKS}
            size="detail"
            played={0.375}
            playhead
            onSeek={() => undefined}
            label="Seek within Entrevista amb l’àvia Teresa"
          />
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
        <Panel label="LevelSelector · the API's wording, visible" width={360}>
          <LevelSelector
            label="What Marta can do"
            levels={LEVELS}
            value={level}
            onChange={setLevel}
          />
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
        <Panel label="Tabs" width={420}>
          <Tabs
            label="Settings sections"
            tabs={SETTINGS_TABS}
            value={section}
            onChange={setSection}
          />
        </Panel>
        <Panel label="Menu · open" width={236}>
          {/* Held open for the same reason the Select above is: most of a menu's geometry only
              exists while it is on screen. */}
          <Menu
            label="Recording options"
            items={RECORDING_ACTIONS}
            open
            onOpenChange={() => undefined}
          />
        </Panel>
        <Panel label="Menu · closed">
          <Menu label="Library actions" items={RECORDING_ACTIONS} />
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

      <Section title="Overlays">
        <Panel label="Toast · done" width={420}>
          <Toast onDismiss={() => undefined}>12 recordings moved to Àvia Teresa</Toast>
        </Panel>
        <Panel label="Toast · failed, and still selected" width={420}>
          <Toast
            tone="failed"
            actions={
              <>
                <Button variant="secondary">Retry 3</Button>
                <Button variant="ghost">Dismiss</Button>
              </>
            }
          >
            9 moved, 3 failed. The three that failed are still selected.
          </Toast>
        </Panel>
        <Panel label="Tooltip · a truncated title, in full" width={260}>
          <Tooltip content="Interview with grandma Teresa — the house on Carrer Nou">
            <span
              style={{
                fontSize: 'var(--type-ui-size)',
                color: 'var(--text-2)',
                maxWidth: 200,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Interview with grandma Teresa — the house…
            </span>
          </Tooltip>
        </Panel>
        <Panel label="Tooltip · an icon-only control's name">
          <Tooltip content="Share this library">
            <IconButton icon="share-2" variant="ghost" label="Share this library" />
          </Tooltip>
        </Panel>
        <Panel label="Sheet · the phone's metadata panel">
          <Button
            variant="secondary"
            onClick={() => {
              setSheet(true);
            }}
          >
            Open the sheet
          </Button>
          <Sheet
            open={sheet}
            onClose={() => {
              setSheet(false);
            }}
            title="Metadata"
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip>memòria</Chip>
              <Chip>1998</Chip>
            </div>
          </Sheet>
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
