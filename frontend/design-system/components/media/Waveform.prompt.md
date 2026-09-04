The signature element. Amplitude sampled into rounded bars with fully rounded caps; minimum bar height equals bar width, so a silent passage stays a row of dots rather than disappearing.

```jsx
<Waveform peaks={rec.peaks} height={38} />
<Waveform peaks={rec.peaks} height={34} played={0.42} playhead />
<Waveform pending height={20} />
```

Never draw a filled envelope, a stroked contour, or a bar chart with square caps. Never invent a shape for a recording whose peaks job has not run — use `pending`. The mark in `Logo` shares this geometry, so logo and data read as the same object.
