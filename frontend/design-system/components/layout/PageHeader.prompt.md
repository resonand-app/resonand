The page title, the mono meta line, and the view's actions.

```jsx
<PageHeader
  title={library.name}
  meta="37 recordings · 24 h 12 min"
  before={<LibraryDot colour={library.colour} />}
  actions={<Button variant="primary" icon="upload">Upload audio</Button>}
/>

<PageHeader                                        {/* correctable in place */}
  title={audio.title}
  meta="12:23 · Uploaded by Alex Morgan"
  onTitleSave={rename}
  editLabel="Edit the title"
/>
```

**One per screen, and the only Gabarito on it.** `title` is a `string` and not a node, deliberately: a node is how a second typeface, an icon or a "beta" pill gets inside the page title six months from now. Anything that belongs beside the title goes in `before`, at the interface's own size.

**`onTitleSave` makes the title correctable, and is why the string stayed a string.** It draws its own pencil, at the interface's size and never in Gabarito, and saves on blur and on `Enter`; `Esc` puts back what was there. Reach for it where the title is the subject's own name and is wrong exactly where it is largest — a recording's, not a library's, which is corrected in its settings beside the description and the colour. Omit it and the title is a heading and nothing else, which is also the read-only state: a title somebody may not change has no pencil to reach for, rather than one that turns out to do nothing.
