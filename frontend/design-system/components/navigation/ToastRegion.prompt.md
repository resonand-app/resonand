Where toasts go, and how they are announced.

```jsx
<ToastRegion toasts={toasts} onDismiss={dismiss} playerVisible={playing} />
```

One region for all of them: two stacks in two corners is a product where "did that work?" depends on which corner you looked at, and two live regions is a screen reader nobody can follow. `aria-live="polite"`, because a toast reports something that already happened. It sits **above** the player rather than over it — the play button is the one control that has to stay reachable. A failure carrying a retry takes `timeout: null`: an action nobody had time to read is an action nobody was offered.
