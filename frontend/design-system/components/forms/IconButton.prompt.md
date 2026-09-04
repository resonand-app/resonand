Round icon-only control for toolbars, card overflow menus, and player transport.

```jsx
<IconButton icon="more-vertical" variant="ghost" label="Library options" />
<IconButton icon="pause" size={38} label="Pause" style={{ background: "var(--accent)", color: "var(--accent-on)" }} />
```

Always circular, always pass `label`. Keep the hit target at 44px even when the visual is 32px.
