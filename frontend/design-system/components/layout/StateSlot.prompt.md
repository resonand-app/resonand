§3.5's state family: the centred message card, and the two skeletons.

```jsx
<StateCard icon="library" title="No recordings yet" body="Upload audio to get started." action={<Button variant="primary" icon="upload">Upload audio</Button>} dashed />
<StateCard icon="search" title="No recordings match memòria" action={<Button variant="secondary">Clear the filter</Button>} />
<StateCard icon="loader" busy title="Transcribing" body="Started 2 minutes ago · on whisper" />
<CardSkeleton />  <RowSkeleton />
```

**"Nothing yet" and "the filter matched nothing" are different screens** — one is a new library, the other a mistyped tag, and confusing them is the classic mistake. `dashed` is for the first only. For an error, the body is the problem document's `detail`, shown rather than replaced. The skeletons match the real layout and **never shimmer**: a loading state that animated would be on every screen, for everybody, for ever. `busy` is the one exception and it is not that — it turns the glyph while work is genuinely running somewhere else and will stop, which is a transcription in a provider's queue and nothing else. It claims no percentage; use it where a bar would be a lie but a still card would look stalled.
