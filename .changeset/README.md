# Changesets

Every publishable Frame change must include a changeset:

```bash
npm run changeset
```

The eight public `@lingcootech/frame-*` packages use one fixed version family. Stable releases are
published publicly to npmjs with the `latest` dist-tag. Preview releases remain on GitHub Packages
with the `preview` dist-tag. Canary releases are immutable builds tied to a Git commit and use the
GitHub Packages `canary` dist-tag.
