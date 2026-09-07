A truncated title in full, a technical field's meaning, an icon-only control's name.

```jsx
<Tooltip content="Share this library">
  <IconButton icon="share-2" variant="ghost" label="Share this library" />
</Tooltip>
```

**Never the only place information exists.** It cannot be reached by touch, cannot be copied, and is gone the moment the pointer moves. The permission wording in particular never goes in one — `LevelSelector` renders `level_description` as visible text for exactly this reason. It is the one overlay that does not trap focus, and a pointer has to rest for a moment before it appears while focus shows it at once.
