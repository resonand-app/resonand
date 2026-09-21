The modal panel: create a library, rename, share, confirm a delete.

```jsx
<Dialog title="Create a library" onClose={close}
  footer={<React.Fragment><Button variant="ghost">Cancel</Button><Button variant="primary">Create</Button></React.Fragment>}>
  <TextField label="Name" />
  <ColorSwatchPicker value="clay" onChange={setColour} />
</Dialog>
```

Titles are Geist 600, never the display face — Gabarito is the page title only. Destructive dialogs say what will be lost in the description, and the confirm button is danger.
