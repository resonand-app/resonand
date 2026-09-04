The base of the interface. Three zones, fixed: sidebar toggle plus logo on the left, search in the centre, Upload audio plus the account button on the right.

```jsx
<TopNav initials="MC" onToggleSidebar={toggle} onProfile={openMenu}>
  {searching && <SearchResults hits={hits} total={34} query={query} />}
</TopNav>
```

The account button opens ProfileMenu. Never add a fourth zone or a second primary button.
