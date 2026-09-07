Mono key/value rows: technical metadata, the provider card, system status.

```jsx
<KeyValueList rows={[{ key: 'Sample rate', value: '48 000 Hz' }, { key: 'Channels', value: '2' }]} />
<KeyValueList rows={providerRows} layout="inline" />
```

`stacked` for a narrow panel or a phone sheet, `inline` where the value is short and right-aligned. The value takes a node because some of these are a badge or a host name; the key is a string and is uppercased here, so a key that arrives capitalised and one that does not still sit in the same column. Anything comparable to another number is mono and tabular — that is the whole reason this exists rather than three ad-hoc tables.
