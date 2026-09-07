The phone's metadata panel and its filter bar — the pattern the phone layout rests on.

```jsx
<Sheet open={showMetadata} onClose={close} title="Metadata">
  <KeyValueList rows={technical} />
</Sheet>
```

Phone only. On a desktop the same content is a panel beside the audio, not a thing that covers it. It traps focus, closes on `Esc`, on the scrim and on a drag past the grabber, and it stops the page underneath from scrolling — which a `Menu` must never do and a cover always must. The title is Geist 600 and never Chillax: there is one Chillax title per screen and it is the page's.
