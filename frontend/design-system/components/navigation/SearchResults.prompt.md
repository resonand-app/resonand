The quick-hits dropdown under the search field. Show a handful of matches with their transcript excerpt and timestamp; Enter opens the full search view.

```jsx
<SearchResults query="carrer nou" total={34} hits={hits} onSeeAll={goToSearch} />
```

Render it as a child of TopNav so it anchors to the field. A transcript hit always shows the matching line — the excerpt is the result, not decoration.
