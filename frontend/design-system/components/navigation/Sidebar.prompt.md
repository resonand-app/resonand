The left bar, toggled from the top nav. It lists the user's libraries and the libraries shared with them, with Trash and Settings pinned to the bottom.

```jsx
<Sidebar own={own} shared={shared} trashCount={4} activeId="libraries" onSelect={go} />
<Sidebar own={own} collapsed />
```

Collapsed it is 52px of icons only. It is a floating panel with its own elevation, separated from the nav and the content by the 12px panel gap — it never shares an edge with anything.
