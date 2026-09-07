A setting that takes effect at once: Administration's toggles, "transcribe when the upload finishes".

```jsx
<Switch
  checked={transcribeOnUpload}
  onChange={setTranscribeOnUpload}
  label="Transcribe when the upload finishes"
  description="Transcription is sent to api.openai.com. The audio leaves this instance."
/>
```

**Never for something that needs a Save** — that is why Account's fields are text fields and not switches. Because there is no confirm step, a switch whose consequence matters has to say so in `description` before it is flipped; that is where `EgressNotice`'s wording goes. A `role="switch"` and not a checkbox: a checkbox is part of a set you will submit, a switch is a thing that is on.
