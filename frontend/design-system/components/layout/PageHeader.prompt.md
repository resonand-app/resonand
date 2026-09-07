The page title, the mono meta line, and the view's actions.

```jsx
<PageHeader
  title={library.name}
  meta="37 recordings · 24 h 12 min"
  before={<LibraryDot colour={library.colour} />}
  actions={<Button variant="primary" icon="upload">Upload audio</Button>}
/>
```

**One per screen, and the only Chillax on it.** `title` is a `string` and not a node, deliberately: a node is how a second typeface, an icon or a "beta" pill gets inside the page title six months from now. Anything that belongs beside the title goes in `before`, at the interface's own size.
