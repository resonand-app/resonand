window.SonariumKit = window.SonariumKit || {};
(function () {
  const { Shell, PageHeader } = window.SonariumKit;


  /* Audio detail: the recording's own waveform at full size, then the transcript synced to playback.
     Listening and reading are the same act here, so they share one column. */
  function AudioDetailScreen({ recording, library, transcript, activeIndex, played, onSeek, onBack, ds }) {
    const { Waveform, StateBadge, Chip, Button, IconButton, TranscriptLine } = ds;
    const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
    return (
      <React.Fragment>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px 0", flex: "0 0 auto" }}>
          <IconButton icon="chevron-left" variant="ghost" size={28} label="Back to library" onClick={onBack} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-3)" }}>{library.name}</span>
        </div>
        <PageHeader
          title={recording.name}
          meta={recording.duration + " · " + recording.date}
          actions={<React.Fragment>
            <Button variant="secondary" icon="share-2">Share</Button>
            <IconButton icon="more-vertical" variant="ghost" label="Recording options" />
          </React.Fragment>}
        />

        <div style={{
          marginTop: "var(--space-4)", flex: "0 0 auto", background: "var(--surface)",
          borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-panel)",
          padding: "var(--panel-padding)", display: "flex", flexDirection: "column", gap: 10,
          margin: "var(--space-4) 4px 0"
        }}>
          <Waveform seed={recording.seed} height={130} played={played} playhead onClick={onSeek} style={{ cursor: "pointer" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...mono, fontSize: "11.5px", fontWeight: 500, color: "var(--accent)" }}>
              {transcript[activeIndex] ? transcript[activeIndex].at : "00:00"}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <StateBadge state={recording.state} />
              {recording.tags.map(t => <Chip key={t}>{t}</Chip>)}
            </div>
            <span style={{ ...mono, fontSize: "11.5px", fontWeight: 500, color: "var(--text-3)" }}>{recording.duration}</span>
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, margin: "var(--space-3) 4px 0", background: "var(--surface)",
          borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-panel)",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          <div style={{
            flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10,
            padding: "12px var(--panel-padding)", borderBottom: "1px solid var(--hairline)"
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--type-overline-size)",
              fontWeight: "var(--type-overline-weight)", letterSpacing: "var(--type-overline-tracking)",
              textTransform: "uppercase", color: "var(--text-3)", flex: 1
            }}>Transcript</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-3)" }}>
              Click a line to jump there
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 10px" }}>
            {transcript.map((line, i) => (
              <TranscriptLine key={line.at} at={line.at} active={i === activeIndex} onClick={() => onSeek(i)}>
                {line.text}
              </TranscriptLine>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  }

  Object.assign(window.SonariumKit, { AudioDetailScreen });
})();
