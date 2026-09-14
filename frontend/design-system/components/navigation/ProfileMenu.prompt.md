Opens from the account button in the top nav. Four things only: who you are, the theme, Settings, Sign out.

```jsx
<ProfileMenu name="Ángela Ruiz" email="marti@sonarium.app" theme="Dark" onSignOut={signOut} />
```

Settings is a full view, not a submenu — this menu never nests. Anchor it to the top-right corner beneath the avatar, offset 8px.
