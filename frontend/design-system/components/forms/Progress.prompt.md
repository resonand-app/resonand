Per-file upload progress, and nothing else.

```jsx
<Progress value={0.64} label="Entrevista àvia 03.m4a" detail="64% · 284 MB" />
<Progress value={0.1} label="Overall" detail="3 of 30 uploaded, 1 failed" />
```

**There is no indeterminate mode and there will not be one.** Transcription is the other thing somebody would reach for a bar for, and transcription has no percentage: it reports a state and a start time, and the honest way to show it is "running, started 4 minutes ago" — a `StateBadge` and a relative time. A bar filling itself at an invented rate would be the interface making something up about somebody's recording.
