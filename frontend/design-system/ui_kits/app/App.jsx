window.SonariumKit = window.SonariumKit || {};
(function () {
  const ds = (() => {
  for (const k of Object.keys(window)) {
    let v;
    try { v = window[k]; } catch (e) { continue; }
    if (!v || typeof v !== "object" || v === window) continue;
    try { if (v.TopNav && v.Waveform && v.LibraryCard) return v; } catch (e) {}
  }
  return null;
})();
  const { LIBRARIES, RECORDINGS, TRANSCRIPT, HITS, Shell, PageHeader,
          LandingScreen, LibraryScreen, AudioDetailScreen, LoginScreen } = window.SonariumKit;

  function Missing() {
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 40 }}>
        <div style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: "var(--text)" }}>
            Component bundle not built yet
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-3)" }}>
            This kit mounts the design system&rsquo;s compiled components. Once the system finishes indexing,
            reload this page and the app appears.
          </span>
        </div>
      </div>
    );
  }

  function App() {
    const [signedIn, setSignedIn] = React.useState(false);
    const [authMode, setAuthMode] = React.useState("signin");
    const [route, setRoute] = React.useState({ view: "landing" });
    const [collapsed, setCollapsed] = React.useState(false);
    const [sort, setSort] = React.useState("Recent");
    const [libView, setLibView] = React.useState("cards");
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [dialog, setDialog] = React.useState(null);
    const [newColour, setNewColour] = React.useState("clay");
    const [theme, setTheme] = React.useState("dark");
    const [playing, setPlaying] = React.useState(true);
    const [activeLine, setActiveLine] = React.useState(2);
    const [libraries, setLibraries] = React.useState(LIBRARIES);

    React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
    React.useEffect(() => { if (window.lucide) window.lucide.createIcons({ nameAttr: "data-lucide" }); });

    if (!ds) return <Missing />;
    const { TopNav, Sidebar, ProfileMenu, SearchResults, Dialog, PlayerBar, Button, TextField, ColorSwatchPicker } = ds;

    const own = libraries.filter(l => !l.shared).map(l => ({ id: l.id, name: l.name, colour: l.colour, count: l.count }));
    const shared = libraries.filter(l => l.shared).map(l => ({ id: l.id, name: l.name, colour: l.colour, count: l.count }));
    const current = route.library || libraries[1];
    const recording = route.recording || RECORDINGS[0];

    if (!signedIn) {
      return <LoginScreen mode={authMode} onMode={setAuthMode} onSubmit={() => setSignedIn(true)} ds={ds} />;
    }

    const activeId =
      route.view === "landing" ? "libraries" :
      route.view === "trash" ? "trash" :
      route.view === "settings" ? "settings" :
      (current && current.id);

    const onSelect = id => {
      setMenuOpen(false);
      if (id === "libraries") return setRoute({ view: "landing" });
      if (id === "trash" || id === "settings") return setRoute({ view: id });
      const lib = libraries.find(l => l.id === id);
      if (lib) setRoute({ view: "library", library: lib });
    };

    const nav = (
      <TopNav
        initials="MC"
        query={query}
        searchFocused={query.length > 0}
        onToggleSidebar={() => setCollapsed(c => !c)}
        onUpload={() => setDialog("upload")}
        onProfile={() => setMenuOpen(o => !o)}
      >
        <div style={{ position: "absolute", inset: "0 0 auto 0", height: "var(--field-height)" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search"
            style={{ position: "absolute", inset: 0, width: "100%", background: "transparent", border: "none",
                     outline: "none", padding: "0 44px 0 42px", fontFamily: "var(--font-sans)",
                     fontSize: "13.5px", color: "var(--text)" }}
          />
        </div>
        {query.length > 0 && (
          <div style={{ position: "absolute", top: "calc(var(--field-height) + 8px)", left: 0, right: 0, zIndex: 20 }}>
            <SearchResults
              query={query}
              total={34}
              hits={HITS}
              onOpen={() => { setQuery(""); setRoute({ view: "detail", recording: RECORDINGS[0], library: libraries[1] }); }}
              onSeeAll={() => setQuery("")}
            />
          </div>
        )}
      </TopNav>
    );

    const sidebar = (
      <Sidebar own={own} shared={shared} trashCount={4} collapsed={collapsed} activeId={activeId} onSelect={onSelect} />
    );

    const player = (
      <PlayerBar
        title={recording.name}
        library={current ? current.name : ""}
        seed={recording.seed}
        played={0.375}
        playing={playing}
        position={TRANSCRIPT[activeLine] ? TRANSCRIPT[activeLine].at : "18:04"}
        duration={recording.duration}
        onToggle={() => setPlaying(p => !p)}
      />
    );

    let content;
    if (route.view === "landing") {
      content = (
        <LandingScreen libraries={libraries} sort={sort} onSort={setSort}
          onOpen={lib => setRoute({ view: "library", library: lib })}
          onCreate={() => setDialog("create")} ds={ds} />
      );
    } else if (route.view === "library") {
      content = (
        <LibraryScreen library={current} recordings={RECORDINGS} view={libView} onView={setLibView}
          onOpen={rec => setRoute({ view: "detail", recording: rec, library: current })} ds={ds} />
      );
    } else if (route.view === "detail") {
      content = (
        <AudioDetailScreen recording={recording} library={route.library || current} transcript={TRANSCRIPT}
          activeIndex={activeLine} played={0.375}
          onSeek={i => typeof i === "number" && setActiveLine(i)}
          onBack={() => setRoute({ view: "library", library: route.library || current })} ds={ds} />
      );
    } else {
      content = (
        <React.Fragment>
          <PageHeader title={route.view === "trash" ? "Trash" : "Settings"}
            meta={route.view === "trash" ? "4 items · deleted within the last 30 days" : "Account, transcription language, theme"} />
          <div style={{ flex: 1, background: "var(--surface)", borderRadius: "var(--radius-panel)",
                        boxShadow: "var(--elevation-panel)", margin: "var(--space-6) 4px 0",
                        display: "grid", placeItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>Not designed yet — next round.</span>
          </div>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <Shell nav={nav} sidebar={sidebar} player={player}>{content}</Shell>

        {menuOpen && (
          <React.Fragment>
            <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 30 }} />
            <div style={{ position: "absolute", top: 68, right: 14, zIndex: 31 }}>
              <ProfileMenu
                theme={theme === "dark" ? "Dark" : "Light"}
                onTheme={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
                onSettings={() => { setMenuOpen(false); setRoute({ view: "settings" }); }}
                onSignOut={() => { setMenuOpen(false); setSignedIn(false); }}
              />
            </div>
          </React.Fragment>
        )}

        {dialog && (
          <div onClick={e => e.target === e.currentTarget && setDialog(null)}
            style={{ position: "absolute", inset: 0, background: "var(--scrim)", display: "grid",
                     placeItems: "center", zIndex: 40 }}>
            {dialog === "create" ? (
              <Dialog title="Create a library" onClose={() => setDialog(null)}
                footer={
                  <React.Fragment>
                    <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
                    <Button variant="primary" onClick={() => {
                      setLibraries(ls => [{ id: "new" + ls.length, name: "New library",
                        colour: "var(--library-" + newColour + ")", count: 0, duration: "0 min", seed: 200 + ls.length }, ...ls]);
                      setDialog(null);
                    }}>Create</Button>
                  </React.Fragment>
                }>
                <TextField label="Name" placeholder="Àvia Teresa" />
                <ColorSwatchPicker value={newColour} onChange={setNewColour} />
              </Dialog>
            ) : (
              <Dialog title="Upload audio"
                description="Drop files here, or choose them. Transcription starts once the upload finishes."
                onClose={() => setDialog(null)}
                footer={<Button variant="ghost" onClick={() => setDialog(null)}>Close</Button>}>
                <div style={{ height: 130, borderRadius: "var(--radius-control)", background: "var(--empty-fill)",
                              display: "grid", placeItems: "center", fontSize: 13, color: "var(--text-3)" }}>
                  WAV, MP3, M4A, FLAC · up to 2 GB
                </div>
              </Dialog>
            )}
          </div>
        )}
      </React.Fragment>
    );
  }

  Object.assign(window.SonariumKit, { App });
})();
