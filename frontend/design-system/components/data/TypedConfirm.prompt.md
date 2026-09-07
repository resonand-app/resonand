Permanent deletion, stated in numbers and typed out.

```jsx
<TypedConfirm
  open={deleting}
  name={library.name}
  consequence="84 recordings, 12 h 40 min of audio and their transcripts"
  onConfirm={destroy}
  onCancel={close}
/>
```

**Only for deletion that cannot be undone.** Sending something to the trash is recoverable and uses an ordinary `Dialog` with a danger button; using this for it is the boy who cried wolf. The comparison is trimmed, Unicode-normalised and case-insensitive but **accent-sensitive** — the names here are Catalan, and "Avia" is not "Àvia". The confirm button is a real `disabled` button until the name matches, so it is out of the tab order and cannot fire.
