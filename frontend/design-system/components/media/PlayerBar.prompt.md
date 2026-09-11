The persistent player, pinned to the bottom of the shell inside the 12px panel gap. It survives navigation — playback never stops because the user moved to another view.

```jsx
<PlayerBar title="The house on Carrer Nou" library="Àvia Teresa" played={0.375} position="18:04" duration="48:12" />
```

Only one exists per session. The waveform here always shows the playhead. Pass no `peaks` and the slot collapses to the position and the total — which is what the bar shows while the recording being played is the one on screen, and for one whose peaks job has not run.
