Picks one value from a list: the filter bar, sort, the category picker, playback speed, and the control under `LevelSelector`.

```jsx
<Select
  label="Sort"
  value={sort}
  onChange={setSort}
  options={[
    { value: 'recorded', label: 'Recording date' },
    { value: 'uploaded', label: 'Upload date' },
    { value: 'duration', label: 'Duration' },
  ]}
/>
```

`initialFocus` is for the one case where this control is why a dialog is open -- `MoveDialog`'s destination -- so the dialog opens on the picker rather than on the close control it draws first. Leave it off everywhere else: a filter bar with a focused control is a page that has moved the caret somewhere nobody asked for.

Not for two or three short options — those are `Chip`s, which show every choice at once and cost one click instead of two. Not a native `<select>`: an option can carry a description, and the menu is drawn in this system's colours rather than the operating system's. An option nobody may choose is `disabled` and still readable; an action nobody may take belongs in a `Menu`, where it is absent instead.
