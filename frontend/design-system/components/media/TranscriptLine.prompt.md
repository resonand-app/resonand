A timestamped transcript line. The active line takes `--accent-soft` and full-strength text; every other line steps back to `--text-2`.

```jsx
<TranscriptLine at="18:04" active onClick={() => seek(1084)}>
  Field recording, long take had a balcony that looked over the square.
</TranscriptLine>
```

Auto-scrolling the active line into view is the only motion in the app that starts on its own, and it must hold still under prefers-reduced-motion.
