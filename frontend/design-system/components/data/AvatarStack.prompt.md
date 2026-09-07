Who a library is shared with, as overlapping initials.

```jsx
<AvatarStack people={shares.map((s) => ({ id: s.grantee.id, name: s.grantee.display_name }))} />
```

There are no avatar images anywhere in this product: no storage exists for one, and fetching one externally would break the promise that nothing leaves the instance. Identity is initials, derived by `initialsOf` so two lists cannot disagree about them. Past `max` the rest become a count, because a stack of eleven circles is not a list of people.
