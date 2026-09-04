The four transcription states, exactly as the API reports them: none, running, done, failed.

```jsx
<StateBadge state="done" />
<StateBadge state="running" variant="glyph" />
```

Never show state as a bare colour dot: the glyph carries it for colour-blind users, and the word carries it everywhere there is room. Never invent a fifth state.
