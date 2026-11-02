Something finished while you were looking somewhere else: a bulk outcome, an upload, a background failure.

```jsx
<Toast onDismiss={dismiss}>12 recordings moved to Field recordings</Toast>

<Toast onDismiss={dismiss} actions={<Button variant="secondary">Undo</Button>}>
  3 recordings sent to the trash
</Toast>

<Toast tone="failed" actions={<React.Fragment><Button variant="secondary">Retry 3</Button><Button variant="ghost">Dismiss</Button></React.Fragment>}>
  9 moved, 3 failed. The three that failed are still selected.
</Toast>
```

**Never the only place a result exists** — it is gone in seconds, so the failures stay selected, the tray still shows the file, the job still says failed. If a result exists nowhere else it is a state, not a toast. **One line wherever the width allows**, the button beside the sentence rather than under it; it wraps only when it does not fit. **Undo only where it is an exact inverse** — a trash is undone by a restore; a move, which drops the category, is not undone by moving back. A toast with a button stays longer than one without. Placement, stacking, the live region and the timers are `ToastRegion`'s; this draws one and knows nothing about where it is. Not for the transcript's follow-and-release, which needs a persistent affordance instead.
