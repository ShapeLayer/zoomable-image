# Zoomable Image

A dependency-free TypeScript Web Component for zooming images, captions, and image annotations. MIT licensed. Requires Custom Elements v1, Shadow DOM, Pointer Events, ResizeObserver, modal `dialog`, and dynamic viewport units in a modern browser.

## Install and register

```sh
npm install @shapelayer/zoomable-image
```

```js
import { defineZoomableImage } from '@shapelayer/zoomable-image';
defineZoomableImage();
```

Or import `@shapelayer/zoomable-image/register` once to register automatically. The package ships native ESM and TypeScript declarations; it has no framework, stylesheet, or icon-font dependency.

```html
<zoomable-image
  src="/diagram.png"
  alt="Architecture diagram"
  width="1200"
  height="800"
  caption="Deployment architecture"
  display-width="80%"
></zoomable-image>
```

```js
const image = document.querySelector('zoomable-image');
image.annotations = [
  {
    id: 'api',
    x: 10,
    y: 20,
    width: 30,
    height: 15,
    text: 'API server',
    tooltip: 'Handles incoming requests.'
  }
];
image.labels = {
  open: '이미지 열기',
  close: '이미지 닫기',
  zoomIn: '확대',
  zoomOut: '축소'
};
image.addEventListener('zoomable-annotation', (event) => {
  console.log(event.detail.annotation);
});
```

Annotation coordinates are percentages of the whole source image. Invalid regions and duplicate IDs throw `TypeError` without changing the existing data. Caption, labels, and tooltip text are rendered as plain text. Arrays and labels are copied; reassign properties to update them. Properties assigned before registration are upgraded on connection.

## API

| Kind                  | Names                                                       | Behavior                                                          |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Attributes            | `src`, `alt`, `width`, `height`, `caption`, `display-width` | Reactive HTML values; width/height are intrinsic image dimensions |
| Reflected properties  | `src`, `alt`, `caption`, `displayWidth`                     | Strings reflected to the matching attribute                       |
| Structured properties | `annotations`, `labels`                                     | Values assigned in JavaScript                                     |
| Read-only properties  | `isOpen`, `zoom`                                            | Viewer state and current scale                                    |
| Methods               | `open()`, `close()`, `zoomIn()`, `zoomOut()`, `reset()`     | Open/close, step zoom, or reset pan and zoom                      |
| Events                | `zoomable-open`, `zoomable-close`                           | Viewer lifecycle                                                  |
| Events                | `zoomable-zoom`                                             | `detail: { scale }`                                               |
| Events                | `zoomable-annotation`                                       | `detail: { annotation }` on annotation activation                 |
| Events                | `zoomable-error`                                            | `detail: { src }` when the viewer image fails to load             |

All events bubble and cross shadow boundaries. `ImageAnnotation`, `ViewerLabels`, and `ZoomableImageEventMap` are exported types. `HTMLElementTagNameMap` and `HTMLElementEventMap` provide typed element lookup and event listeners. The package includes a Custom Elements Manifest at `@shapelayer/zoomable-image/custom-elements.json` for editor/tooling support.

Zoom steps: 50%, 75%, 100%, 150%, 200%, 300%, 400%. Drag with a mouse or a single touch to pan above 100%. Enter/Space opens the thumbnail, +/− zoom, Escape closes, and Tab navigates controls and annotation regions. Regions show a tooltip on hover, focus, or activation. Zoom/pan hides the tooltip.

Native modal dialog provides background inertness and focus containment. Focus is restored on close, and document scrolling is locked while any library viewer remains open. Removal closes the viewer and disconnects observers/listeners. Reconnection is supported. Events from image activation and viewer keyboard shortcuts are isolated from surrounding clickable cards and bubble-phase popup handlers; capture-phase handlers in host applications must account for their own event priority.

## Styling

Use `::part(trigger)`, `thumbnail`, `dialog`, `image`, `close`, `caption`, `toolbar`, `annotation`, or `tooltip` to style the shadow content.

```css
zoomable-image {
  --zoomable-image-width: 80%;
  --zoomable-image-backdrop: rgba(0, 0, 0, 0.85);
  --zoomable-image-controls: #25364c;
}
zoomable-image::part(annotation) {
  border-color: #93c5fd;
}
```

Annotation box colors can be configured per viewer with CSS custom properties. Omitting them preserves the existing colors:

| CSS property                                    | Default                  | Applies to                          |
| ----------------------------------------------- | ------------------------ | ----------------------------------- |
| `--zoomable-image-annotation-background`        | `rgba(28, 32, 40, 0.15)` | Normal background                   |
| `--zoomable-image-annotation-active-background` | `rgba(28, 32, 40, 0.25)` | Hover and keyboard focus background |
| `--zoomable-image-annotation-border-color`      | `rgba(28, 32, 40, 0.2)`  | Border                              |

```css
zoomable-image {
  --zoomable-image-annotation-background: rgba(59, 130, 246, 0.15);
  --zoomable-image-annotation-active-background: rgba(59, 130, 246, 0.3);
  --zoomable-image-annotation-border-color: #3b82f6;
}
```

`display-width` controls the inline width; normal author CSS can override it. The viewer remains in the browser top layer even inside a transformed or clipped ancestor.

## SSR and frameworks

The main entry is safe to import on an SSR server and does not register elements. Register on the client; DOM objects cannot be instantiated on the server. The `register` entry is the automatic-registration entry. For HTML rendered before hydration or with JavaScript disabled, put a fallback image inside the element:

```html
<zoomable-image src="/photo.jpg" alt="A landscape">
  <img src="/photo.jpg" alt="A landscape" loading="lazy" style="width:100%;height:auto" />
</zoomable-image>
```

The shadow tree hides fallback children after upgrade. Framework adapters should assign `annotations` and `labels` as properties after mounting. [The site adapter](https://github.com/ShapeLayer/jonghyeon.me/blob/main/src/lib/components/ZoomableImage.svelte) demonstrates Svelte 5 client registration, reactive properties, localized labels, and an SSR fallback.

`defineZoomableImage(tagName?, registry?)` supports custom tag names and a registry, is idempotent for this library, and reports collisions with unrelated elements. After default registration, `new ZoomableImage()` also works in the browser. Custom tag names do not automatically augment TypeScript's tag-name map.

## Development and verification

From repository root (Node 22+, pnpm 12.6.0):

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm test:release
pnpm test:package
```

`test:release` runs type, unit, and browser checks. Browser projects cover Chromium, Firefox, WebKit, Android Chromium emulation, and iPhone WebKit emulation. `test:package` packs and installs the actual artifact into an isolated consumer, verifies exports/SSR/types/license, and rejects unexpected files.

Build with `pnpm build`. Run `node test/server.mjs` and open `http://127.0.0.1:4174/examples/` for the self-contained demo. Host integration tests are maintained in the separate jonghyeon.me repository.

On macOS 27, Playwright Firefox may exit before tests with `Could not find profile folder` due to its shared Firefox app-data directory ([upstream report](https://github.com/microsoft/playwright/issues/42768)). The configuration accepts `ZOOMABLE_FIREFOX_EXECUTABLE` for an isolated test-browser launcher. CI uses Linux and the normal bundled Firefox. Test results describe browser-engine checks and emulated touch environments, not physical-device certification.

## Release

Version `0.1.0` is the initial release. See [CHANGELOG.md](./CHANGELOG.md) in the source repository for changes.

1. Run the verification commands above and commit the reviewed source to `main`.
2. Use an npm account with access to the `@shapelayer` scope. For the first release, sign in with `npm login` and publish from the package directory:

   ```sh
   npm publish --access public
   ```

3. For subsequent CI releases, configure npm trusted publishing for repository `ShapeLayer/zoomable-image`, workflow `zoomable-image-release.yml`, and environment `npm`. Alternatively, configure an `NPM_TOKEN` secret with package publish access. Configure any desired approval protection on the GitHub `npm` environment.
4. Run the **Publish Zoomable Image** workflow on `main` with the exact manifest version. The workflow re-runs browser and installed-package checks before publishing with provenance. It never publishes automatically on a push.

Trusted publishing requires an eligible Node/npm version and package publisher configuration; see [npm's instructions](https://docs.npmjs.com/trusted-publishers/). The workflow uses Node 24. Authentication and scope access are external account prerequisites; this repository does not contain credentials.

Initial scope includes stepped zoom and single-pointer pan. Wheel/pinch zoom, annotation authoring, and HTML captions are outside the `0.1.0` API.

Viewer dimensions and typography use explicit pixel values: desktop controls are 22px tall with an 11px zoom label; touch controls are 38px tall with a 15px label. Without a caption, the image is centered in the full viewport and fits within 32px horizontal and 96px vertical margins. Tooltips use 12px text and prefer the centered position above a region, falling back below when space is insufficient. Null/undefined caption properties remove the caption. Viewport units and percentage annotation coordinates remain responsive.
