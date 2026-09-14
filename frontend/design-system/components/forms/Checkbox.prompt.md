Multiple selection on cards and in dense rows.

```jsx
<Checkbox checked={selected} onChange={setSelected} label="Select Digitised cassette" />
<Checkbox checked="mixed" onChange={selectAll} label="Select all" size="row" />
```

On a card it goes in the corner **opposite** the play control — selecting forty recordings and playing one are things people do in the same minute. In a dense list it has its own column, at 16px. `mixed` is a header's state and never an item's, and clicking a mixed header selects the rest rather than clearing, because clearing throws away work somebody has already done. `label` is required: the control has no visible text in either place it is used.
