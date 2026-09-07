The overflow menu: card and row actions, library actions, job actions.

```jsx
<Menu
  label="Recording options"
  items={[
    { id: 'download', label: 'Download the original', icon: 'upload' },
    { id: 'move', label: 'Move to another library', icon: 'library' },
    { id: 'trash', label: 'Send to trash', icon: 'trash-2', destructive: true, separated: true },
  ]}
  onSelect={run}
/>
```

**An action the user cannot take is absent, never disabled** — there is no `disabled` on a menu item to reach for. Filter the list before passing it. `ProfileMenu` is a specific dialog with an identity block, not a menu, and is not built on this. One destructive item per menu, always last, always under the rule, and always followed by a confirm that says what will be lost.
