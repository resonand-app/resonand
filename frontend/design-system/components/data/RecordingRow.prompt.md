The dense alternative to the card grid, for libraries with hundreds of recordings.

```jsx
<RecordingRow name="Field recording, long take" duration="48:12" state="done" selected />
```

36px is the floor — do not compress it further. State is a glyph here, not a chip: there is no room for the word. There is no waveform column: a 20px sparkline told nobody anything the grid does not.

`favourite` adds the heart as the last column, the one place on the row a click marks rather than opens. Leave it out where marking means nothing; an empty column of hidden hearts still takes its width.
