A recording in the card view of a library. A 52px waveform, taller than any other, because the recording itself is the subject here.

```jsx
<RecordingCard name="Field recording, long take" meta="48:12 · 12 Mar 2026" state="done" tags={["field","outdoor"]} peaks={rec.peaks} />
```

The waveform is a picture of the file and does not move. `playing` marks the card with the accent ring, lights the shape in `--wave`, and turns its play control into a pause -- lit, never filled: the player at the foot of the shell is the one thing that draws how far through a recording is.

Use the dense RecordingRow instead once a library passes a few dozen recordings.

Pass `favourite` and the card draws a heart at its foot, across the waveform from the play control. A marked heart is always there; an empty one appears on hover or focus, like the checkbox, and always where nothing can hover. Leave `favourite` out wherever marking means nothing — a specimen, a picker — rather than drawing a heart that does nothing.
