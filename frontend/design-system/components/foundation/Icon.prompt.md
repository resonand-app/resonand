Renders one Lucide glyph at the system's stroke weight; use it for every icon in the interface rather than inlining SVG.

```jsx
<Icon name="search" size={17} />
```

Requires the Lucide UMD script on the page: `<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"></script>`.
Colour comes from `currentColor`, so set `color` on the parent. Common names in this system: `search`, `upload`, `panel-left`, `library`, `plus`, `play`, `pause`, `skip-back`, `skip-forward`, `share-2`, `more-vertical`, `trash-2`, `sliders-horizontal`, `moon`, `log-out`, `align-left`, `clock`, `tag`.
