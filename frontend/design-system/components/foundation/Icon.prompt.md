Renders one Lucide glyph at the system's stroke weight; use it for every icon in the interface rather than inlining SVG.

```jsx
<Icon name="search" size={17} />
```

Glyphs come from the bundled `lucide-react` package — there is no script to add to the page and nothing is fetched at runtime. Colour comes from `currentColor`, so set `color` on the parent.

`name` is one of the registered names, not any Lucide name: `align-left`, `alert-circle`, `check`, `chevron-left`, `circle-dashed`, `clock`, `library`, `loader`, `log-out`, `moon`, `more-vertical`, `panel-left`, `pause`, `play`, `plus`, `search`, `share-2`, `skip-back`, `skip-forward`, `sliders-horizontal`, `tag`, `trash-2`, `upload`, `x`. Anything else throws in development and logs in a build. To add one, add it to `GLYPHS` in `Icon.jsx` — the registry is what keeps the other fourteen hundred icons out of the bundle.
