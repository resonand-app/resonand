window.SonariumKit = window.SonariumKit || {};
(function () {
  const { Shell, PageHeader } = window.SonariumKit;


  /* A library's contents. Cards while a library is small, dense rows once it is not. */
  function LibraryScreen({ library, recordings, view, onView, onOpen, ds }) {
    const { RecordingCard, RecordingRow, Chip, Button } = ds;
    return (
      <React.Fragment>
        <PageHeader
          title={library.name}
          meta={library.count + " recordings · " + library.duration}
          actions={<React.Fragment>
            <span onClick={() => onView("cards")} style={{ cursor: "pointer" }}><Chip active={view === "cards"}>Cards</Chip></span>
            <span onClick={() => onView("list")} style={{ cursor: "pointer" }}><Chip active={view === "list"}>List</Chip></span>
            <Button variant="secondary" icon="share-2">Share</Button>
          </React.Fragment>}
        />
        <div style={{ marginTop: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", padding: "0 4px 4px" }}>
          {view === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--grid-gap)", alignContent: "start" }}>
              {recordings.map(r => (
                <RecordingCard key={r.id} name={r.name} meta={r.duration + " · " + r.date}
                  state={r.state} tags={r.tags} seed={r.seed} pending={r.pending} onPlay={() => onOpen(r)} />
              ))}
            </div>
          ) : (
            <div style={{ background: "var(--surface)", borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-raised)", overflow: "hidden" }}>
              {recordings.map(r => (
                <RecordingRow key={r.id} name={r.name} duration={r.duration} state={r.state}
                  seed={r.seed} pending={r.pending} onOpen={() => onOpen(r)} />
              ))}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  }

  Object.assign(window.SonariumKit, { LibraryScreen });
})();
