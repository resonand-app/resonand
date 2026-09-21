The Resonand lockup: the mark standing in for the S, with `re` before it and `onand` after. Use it in the top nav, on the sign-in screen, and nowhere else.

```jsx
<Logo size={18} />
<Logo size={22} showWordmark={false} />
```

`size` is the height of the mark. The wordmark's size and its lead follow from it, because the brand kit draws the lockup as one object -- there is no call site that sets them apart.

Chillax appears here and in page titles only. On an amber fill, pass `color="var(--accent-on)"`. The S is the third letter, so the word is split around the mark and what is on screen is `re` + `onand`; the lockup carries its own accessible name, and `label` is for where something else should be announced.
