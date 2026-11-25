Any number of people out of a list, as a wrapping grid of boxes with their initials.

```jsx
<PersonPicker
  label="Who to share with"
  people={candidates.map((p) => ({ id: p.id, name: p.display_name }))}
  value={chosen}
  onChange={setChosen}
/>
```

A group of toggles: choosing somebody does nothing until whatever comes after it — a level, a button — is confirmed, so it sits beside `LevelSelector` and works the same way, one tab stop and arrows between the boxes, with `Space` turning the box in focus on or off. A chosen box shows a tick in place of the initials. **Not for an action that happens on press**: that is a list of buttons, not a choice. Not for showing who already has access either — that is `AvatarStack`, or the share list with names in it. Whoever cannot be chosen is left out by the caller rather than drawn disabled. Names are shown verbatim and cut with an ellipsis, never wrapped, with the whole name as the box's title.
