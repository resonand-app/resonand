window.SonariumKit = window.SonariumKit || {};
(function () {
  const { Shell, PageHeader } = window.SonariumKit;


  /* The landing page: libraries as big cards, create first. Nothing else competes for the space. */
  function LandingScreen({ libraries, sort, onSort, onOpen, onCreate, ds }) {
    const { LibraryCard, CreateLibraryCard, Chip } = ds;
    const totalRecordings = libraries.reduce((n, l) => n + l.count, 0);
    return (
      <React.Fragment>
        <PageHeader
          title="Libraries"
          meta={libraries.length + " libraries · " + totalRecordings + " recordings · 149 h 44 min"}
          actions={["Recent", "Name", "Size"].map(s => (
            <span key={s} onClick={() => onSort(s)} style={{ cursor: "pointer" }}>
              <Chip active={sort === s}>{s}</Chip>
            </span>
          ))}
        />
        <div style={{
          marginTop: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", padding: "0 4px 4px",
          display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--grid-gap)", alignContent: "start"
        }}>
          <CreateLibraryCard onClick={onCreate} />
          {libraries.map(l => (
            <LibraryCard
              key={l.id}
              name={l.name}
              meta={l.count + " recordings · " + l.duration}
              colour={l.colour}
              seed={l.seed}
              played={l.played || 0}
              onOpen={() => onOpen(l)}
            />
          ))}
        </div>
      </React.Fragment>
    );
  }

  Object.assign(window.SonariumKit, { LandingScreen });
})();
