# Sonarium — app UI kit

A click-through recreation of the signed-in product, built entirely from the system's components.

## The flow

1. **Login** — sign in or create an account. Submitting either goes to the app; no validation.
2. **Libraries landing** — the create tile first, then seven library cards. Click a card to open it.
3. **A library** — its recordings as cards or as dense 36px rows (toggle in the header). Click one to open it.
4. **Audio detail** — the recording's waveform at 130px with a playhead, then the transcript. Click a line to move the active line and the player position.

Also live: the sidebar toggle in the nav, the account menu (theme switches the whole app between dark and light, sign out returns to login), the search field (type anything to see quick hits; the first hit opens audio detail), the create-library dialog (picking a colour and creating prepends a real card), and the upload dialog. Trash and Settings are deliberate placeholders.

## Files

| File | What it is |
|---|---|
| `index.html` | Entry point and loader. Also the `@dsCard` and `@startingPoint` for the app. |
| `App.jsx` | Routing, state, and the shell composition. |
| `Shell.jsx` | `Shell` (nav + sidebar + content + player) and `PageHeader`. |
| `LandingScreen.jsx` | The libraries landing page. |
| `LibraryScreen.jsx` | One library, card view and dense list view. |
| `AudioDetailScreen.jsx` | Waveform plus synced transcript. |
| `LoginScreen.jsx` | Sign in and sign up. |
| `data.js` | Sample libraries, recordings, transcript and search hits. |

## How it loads

`index.html` links the compiled component bundle (`_ds_bundle.js`) when the system has been indexed. Before that exists, it falls back to fetching the component sources from `components/` and transforming them in the browser, so the kit renders either way. Every screen file registers itself on `window.SonariumKit` rather than using ES modules, because the page runs without a bundler.

Components are passed into each screen as a single `ds` prop rather than imported, so a screen can be lifted into another host by handing it a different component object.
