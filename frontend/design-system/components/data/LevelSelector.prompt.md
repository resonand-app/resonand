Can read / Can edit / Can manage, as radio rows with the plain wording visible.

```jsx
<LevelSelector
  label="What Sam Rivera can do"
  levels={shares.levels}          {/* level + level_description, from the API */}
  value={share.level}
  onChange={setLevel}
/>
```

**`description` is `level_description` from the API, verbatim.** The wording lives beside the levels in the backend and is sent down with every share; a copy in the interface is a copy somebody eventually edits, and then the product describes a permission it does not grant. It is visible and never behind a tooltip — sharing is where "nothing is shared until you share it" is kept or broken. Owner is never selectable and is dropped from the list rather than drawn and disabled.
