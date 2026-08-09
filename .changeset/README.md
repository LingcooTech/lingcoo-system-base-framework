# Changesets

Every publishable Frame change must include a changeset:

```bash
npm run changeset
```

The eight public `@lingcootech/frame-*` packages use one fixed version family. Preview releases are
published to GitHub Packages with the `preview` dist-tag. Canary releases are immutable builds tied
to a Git commit and use the `canary` dist-tag.
