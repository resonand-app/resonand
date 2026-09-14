Text input for dialogs and settings — library name, email, display name.

```jsx
<TextField label="Library name" value="Field recordings" />
<TextField value="Personal" error="You already have a library with this name." />
<TextField
  type="password"
  label="Password"
  value={password}
  showPasswordLabel="Show password"
  hidePasswordLabel="Hide password"
/>
```

10px radius, never a pill: pills are for buttons and the search field only.

`type="password"` with both `showPasswordLabel` and `hidePasswordLabel` set adds a reveal toggle inside the field. Omit either and it is a plain password field, exactly as before.
