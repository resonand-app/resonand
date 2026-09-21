The Resonand lockup: the mark standing in for the S, with `onarium` set beside it. Use it in the top nav, on the sign-in screen, and nowhere else.

```jsx
<Logo size={18} />
<Logo size={22} showWordmark={false} />
```

`size` is the height of the mark. The wordmark's size and its lead follow from it, because the brand kit draws the lockup as one object -- there is no call site that sets them apart.

Chillax appears here and in page titles only. On an amber fill, pass `color="var(--accent-on)"`. The word on screen is six letters, so the lockup carries its own accessible name; pass `label` only where something else should be announced.
