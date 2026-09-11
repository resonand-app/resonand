Where a thing lives, and the one way back to it. Above the page title on a recording's screen.

```jsx
<Breadcrumb
  name="Àvia Teresa"
  href="/library/avia"
  detail="Interviews"
  label="Where this recording is"
  onNavigate={keepInRouter}
/>
```

The name is the control and carries the chevron, so nothing else on the screen has to offer a
second way back. No underline — the line reads as a path, not as prose with a link in it. The
detail after it names what the thing is filed under and is never a link; it is the half that
truncates when the line runs out of room.
