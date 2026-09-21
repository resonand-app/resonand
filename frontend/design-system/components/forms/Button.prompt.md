The text button. One `primary` per view — in Resonand that is almost always "Upload audio" in the top nav.

```jsx
<Button variant="primary" icon="upload">Upload audio</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="danger" icon="trash-2">Delete</Button>
```

`busy` turns a spinner in place of the icon while the press is still out there — for a request
that leaves the instance and comes back, never for a screen that is merely loading, which gets a
skeleton and does not move. Pair it with a label that says what is happening, and with `disabled`
where pressing twice would ask twice.

```jsx
<Button variant="secondary" busy={check.isPending} disabled={check.isPending}>Checking</Button>
```

Always a pill. Never square a button off, and never put two primaries in one view.
