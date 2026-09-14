Per-file upload progress, and nothing else.

```jsx
<Progress value={0.64} label="field-recording-03.m4a" detail="64% · 284 MB" />
<Progress value={0.1} label="Overall" detail="3 of 30 uploaded, 1 failed" />
<Progress value={1} label="field-recording-03.m4a" detail={<Done />} />
```

The name is on its own line with the bar under it, and the `detail` sits beside both and centred
against them, in a column wide enough for the longest status so the bar never changes width as one
state becomes the next. A `detail` can be a
glyph rather than a string where the word adds nothing to a full bar — a tick for an upload that
finished — but then it carries its own accessible name, because only the caller knows what it
means.

**There is no indeterminate mode and there will not be one.** Transcription is the other thing somebody would reach for a bar for, and transcription has no percentage: it reports a state and a start time, and the honest way to show it is "running, started 4 minutes ago" — a `StateBadge` and a relative time. A bar filling itself at an invented rate would be the interface making something up about somebody's recording.
