window.SonariumKit = window.SonariumKit || {};
(function () {

  /* First contact. The mark at rest, one field at a time, and a single sentence of what this is. */
  function LoginScreen({ mode = "signin", onMode, onSubmit, ds }) {
    const { Logo, Button, TextField } = ds;
    const signup = mode === "signup";
    return (
      <div style={{
        position: "absolute", inset: 0, background: "var(--bg)",
        display: "grid", placeItems: "center", overflow: "hidden"
      }}>
        <div style={{ width: 380, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <Logo size={34} />
            <p style={{
              margin: 0, fontFamily: "var(--font-sans)", fontSize: "14.5px", lineHeight: 1.6,
              color: "var(--text-3)", textWrap: "pretty"
            }}>
              Your recordings, transcribed and searchable. Nothing is shared until you share it.
            </p>
          </div>

          <div style={{
            background: "var(--surface)", borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-panel)",
            padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)"
          }}>
            <h1 style={{
              margin: 0, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--type-title-size)",
              letterSpacing: "var(--type-title-tracking)", color: "var(--text)"
            }}>{signup ? "Create your account" : "Sign in"}</h1>
            {signup && <TextField label="Name" placeholder="Martí Colom" />}
            <TextField label="Email" placeholder="you@example.com" />
            <TextField label="Password" type="password" placeholder="••••••••" />
            <Button variant="primary" onClick={onSubmit} style={{ justifyContent: "center", marginTop: 4 }}>
              {signup ? "Create account" : "Sign in"}
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-3)" }}>
              {signup ? "Already have an account?" : "No account yet?"}
            </span>
            <button type="button" onClick={() => onMode(signup ? "signin" : "signup")} style={{
              border: "none", background: "transparent", padding: 0, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "var(--accent)"
            }}>{signup ? "Sign in" : "Create one"}</button>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window.SonariumKit, { LoginScreen });
})();
