Sections inside one view: Settings' four, and the phone's metadata sheet.

```jsx
<Tabs
  label="Settings sections"
  tabs={[{ value: 'account', label: 'Account' }, { value: 'sessions', label: 'Sessions' }]}
  value={section}
  onChange={setSection}
/>
```

A hairline track with a 2px accent bar, never a pill track — a segmented control reads as a filter here, and the filter bar above a library grid is made of pills. It renders the strip and not the panels: which section is on screen is the caller's state. Not for switching between two things that are not sections of the same view; that is navigation, and it belongs in the sidebar.
