# Changelog

## 0.1.0

- Restore the larger centered image and compact desktop controls, using pixel dimensions.
- Remove omitted/null/undefined captions instead of stringifying them; preserve the original annotation colors.
- Prefer centered tooltips above a region with a below-region fallback; use 12px tooltip text.

- Expose annotation background, hover/focus background, and border colors as CSS custom properties, preserving the existing defaults.

- Extract the site's Svelte image viewer into a dependency-free Custom Elements v1 package.
- Provide modal image viewing, stepped zoom (50–400%), bounded mouse/touch pan, captions, and percentage annotations.
- Add reflected attributes/properties, localized labels, typed events and declarations, CSS parts and variables, and a Custom Elements Manifest.
- Support explicit or automatic registration, SSR imports/fallback images, cleanup and reconnection, multi-viewer scroll locking, and focus restoration.
- Integrate the package into the host site through a Svelte 5 adapter.
- Add cross-engine browser tests, consumer tarball validation, host integration tests, and manual release CI.
