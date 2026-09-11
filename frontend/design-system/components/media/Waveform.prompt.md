The signature element. Amplitude sampled into rounded bars with fully rounded caps; minimum bar height equals bar width, so a silent passage stays a row of dots rather than disappearing.

```jsx
<Waveform peaks={rec.peaks} height={38} />
<Waveform peaks={rec.peaks} height={34} played={0.42} playhead advance={0.0004} playedAt={at} />
<Waveform pending height={20} />
```

Never draw a filled envelope, a stroked contour, or a bar chart with square caps. Never invent a shape for a recording whose peaks job has not run — use `pending`, which is also what an empty `peaks` array draws. `played` is an anchor and not an instruction: give it `advance` — how much of the recording a second of playback covers — and the drawing carries the position forward itself on every frame, instead of stepping four times a second when the element reports in. `playedAt` says when the anchor was true, since a position reported at 20 ms to 250 ms intervals is already a few milliseconds old by the time it arrives. The mark in `Logo` shares this geometry, so logo and data read as the same object.
