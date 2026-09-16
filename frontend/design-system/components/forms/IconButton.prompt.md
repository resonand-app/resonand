Round icon-only control for toolbars, card overflow menus, and player transport.

```jsx
<IconButton icon="more-vertical" variant="ghost" label="Library options" />
<IconButton icon="pause" size={38} label="Pause" style={{ background: "var(--accent)", color: "var(--accent-on)" }} />
```

With `href` it renders an `<a>` in the same shape, for a navigation the browser performs itself:

```jsx
<IconButton icon="download" variant="ghost" href="/api/audio/abc/original" download label="Download the original" />
```

Always circular, always pass `label`. Keep the hit target at 44px even when the visual is 32px.
