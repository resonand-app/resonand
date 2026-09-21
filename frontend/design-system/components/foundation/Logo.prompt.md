The Resonand lockup: the mark standing in for the S, which is the third letter of the name. Use it in the top nav, on the sign-in screen, and nowhere else.

```jsx
<Logo size={18} />
<Logo size={22} showWordmark={false} />
```

`size` is the height of the mark. The wordmark's size and its lead follow from it, because the brand kit draws the lockup as one object -- there is no call site that sets them apart.

Both halves are artwork -- no font is loaded, and none is needed. On an amber fill, pass `color="var(--accent-on)"`. The lockup carries its own accessible name, which since `NAM-5` is the only thing on screen that says what it is; pass `label` only where something else should be announced.
