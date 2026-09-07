The metadata panel's workhorse: a field you correct in place, in the panel beside the audio.

```jsx
<InlineField label="Title" value={audio.title} onSave={rename} />
<InlineField label="Notes" value={audio.notes} onSave={saveNotes} multiline />
<InlineField label="Title" value={audio.title} onSave={noop} readOnly />   {/* Can read */}
```

Three states, and the third is the one to get right: **read-only because of permission** must read as deliberately non-editable rather than broken, so there is no box, no pencil and no disabled control — the value sits on the page under a hairline. It saves on blur, because a panel of eight fields with eight Save buttons is a form and this is a caption you are correcting. `Esc` puts back what was there.
