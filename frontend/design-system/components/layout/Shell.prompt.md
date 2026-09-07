The desktop frame every view is drawn inside: nav, sidebar, content, player.

```jsx
<Shell
  nav={<TopNav {...nav} />}
  sidebar={<Sidebar own={mine} shared={shared} collapsed={collapsed} />}
  player={playing ? <PlayerBar {...playback} /> : undefined}
  tray={uploads.length > 0 ? <UploadTray /> : undefined}
>
  <PageHeader title={library.name} meta={summary} />
  {grid}
</Shell>
```

The player is **absent rather than empty** when nothing is playing — pass `undefined`, never a `PlayerBar` with no title. Only the content scrolls; the chrome is furniture, which is what makes the player survive every navigation. The phone shell is not this component: below `--breakpoint-phone` the frame is replaced rather than narrowed (`DEC-23`).
