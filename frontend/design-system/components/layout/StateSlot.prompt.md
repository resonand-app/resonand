§3.5's state family: the centred message card, and the two skeletons.

```jsx
<StateCard icon="library" title="No recordings yet" body="Upload audio to get started." action={<Button variant="primary" icon="upload">Upload audio</Button>} dashed />
<StateCard icon="search" title="No recordings match memòria" action={<Button variant="secondary">Clear the filter</Button>} />
<CardSkeleton />  <RowSkeleton />
```

**"Nothing yet" and "the filter matched nothing" are different screens** — one is a new library, the other a mistyped tag, and confusing them is the classic mistake. `dashed` is for the first only. For an error, the body is the problem document's `detail`, shown rather than replaced. The skeletons match the real layout and **never shimmer**: the transcript following playback is the only thing in this product that moves on its own.
