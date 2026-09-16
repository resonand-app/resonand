The left bar, toggled from the top nav. It lists the user's libraries and the libraries shared with them, with Trash and Settings pinned to the bottom.

```jsx
<Sidebar own={own} shared={shared} trashCount={4} activeId="libraries" onSelect={go} />
<Sidebar own={own} collapsed />
```

Collapsed it is 52px of icons only. It is a floating panel with its own elevation, separated from the nav and the content by the 12px panel gap — it never shares an edge with anything.

Only the libraries scroll. The Libraries destination stays at the top and Trash and Settings stay at the bottom however many there are between them, and the library you are in is brought back into view when you arrive at it. Do not reach for a "show first few" variant: it hides libraries behind a count, and every rule for picking the few reorders the bar as you use it.
