window.SonariumKit = window.SonariumKit || {};
(function () {

  /* The base of every signed-in view: floating nav, toggleable sidebar, content, persistent player.
     Nothing here draws a border — panels are separated by the 12px gap and told apart by elevation. */
  function Shell({ nav, sidebar, player, children }) {
    return (
      <div style={{
        position: "absolute", inset: 0, background: "var(--bg)",
        display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        <div style={{ flex: "0 0 auto", padding: "var(--panel-gap) var(--panel-gap) 0" }}>{nav}</div>
        <div style={{ flex: 1, display: "flex", gap: "var(--panel-gap)", padding: "var(--panel-gap)", minHeight: 0 }}>
          {sidebar}
          <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</main>
        </div>
        {player && <div style={{ flex: "0 0 auto", padding: "0 var(--panel-gap) var(--panel-gap)" }}>{player}</div>}
      </div>
    );
  }

  function PageHeader({ title, meta, actions }) {
    return (
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, padding: "10px 4px 0", flex: "0 0 auto"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            margin: 0, fontFamily: "var(--font-display)", fontWeight: "var(--type-page-title-weight)",
            fontSize: "var(--type-page-title-size)", letterSpacing: "var(--type-page-title-tracking)",
            lineHeight: "var(--type-page-title-leading)", color: "var(--text)"
          }}>{title}</h1>
          {meta && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "12px",
              fontVariantNumeric: "tabular-nums", color: "var(--text-3)"
            }}>{meta}</span>
          )}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>}
      </div>
    );
  }

  Object.assign(window.SonariumKit, { Shell, PageHeader });
})();
