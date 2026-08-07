## Unreleased

- (v0_9) Move universal basic catalog component implementations (`A2uiText`, `A2uiButton`, `A2uiCard`, etc.) to `@a2ui/web_core/v0_9/basic_catalog` and re-export them from `@a2ui/lit/v0_9` and `@a2ui/lit/v0_9/catalogs/basic` for backwards compatibility. [#2190](https://github.com/a2ui-project/a2ui/pull/2190)

- (v0_9) Align Basic Catalog component behaviors and styling contracts with the Angular reference implementation: [#2205](https://github.com/a2ui-project/a2ui/pull/2205)
  - `TextField`: Render all validation error messages in `validationErrors` instead of only the first error, simplify input change handling, and support overridable full-width container styling (`width: var(--a2ui-textfield-width, 100%)`, `box-sizing: border-box`).
  - `DateTimeInput`: Add overridable `width: var(--a2ui-datetimeinput-width, 100%)` container styling and `box-sizing: border-box` input sizing.
  - `Column`: Add consistent flex layout distribution and strict alignment mappings.
  - `Row`, `Column`, `List`: Use Lit `repeat` directive with key extractors to ensure child elements are tracked by key and DOM nodes are preserved across reordering operations.
  - `Tabs`: Reset `activeIndex` to 0 when out of bounds in `willUpdate` when `tabs` array changes dynamically.
  - `Text`: Directly render semantic HTML tags for non-markdown variants (`h1`-`h5`, `caption`) and add flex weight styling.
  - `Video`: Wrap video in `.a2ui-video-container` with fallback message for unsupported browsers.
  - `Image`: Remove default `width: 100%` constraint on `img` elements to preserve intrinsic aspect ratios and support explicit layout sizing.
  - `Modal`: Migrate from native `<dialog>` to an overlay container (`.a2ui-modal-overlay`, `.a2ui-modal-content`) managed with explicit `@state() isOpen` lifecycle tracking, standard backdrop theming (`--a2ui-modal-backdrop-bg`), accessible dialog ARIA attributes (`role="dialog"`, `aria-modal="true"`), and an accessible close button (`aria-label="Close"`).
- (v0_9) Migrate Basic Catalog components and surface rendering from Shadow DOM to Light DOM. [#2204](https://github.com/a2ui-project/a2ui/pull/2204)

## 0.10.3

- Enable `inlineSources` in `tsconfig.json` to populate `sourcesContent` in sourcemaps.

## 0.10.2

- (v0_9) Normalize Safari placeholder text color for `DateTimeInput` by updating CSS selectors for `.a2ui-date-time-input`.

## 0.10.1

- (v0_9) Tighten resolved child list types in the basic catalog layout components.
- (v0_9) Narrow `A2uiChildRef` to the supported child reference shapes used by
  `renderNode`.
- (v0_9) Add missing CSS classes to the `Modal`, `Tabs` components to align with the Angular implementation and
  integration tests.
- (v0_9) Avoid rendering an `A2uiLitElement` when its surface is disposed of or the component is removed.
- (v0_9) Fix `DateTimeInput` to correctly render `datetime-local`, `date` and `time` input types.

## 0.10.0

- **BREAKING CHANGE**: (v0_9) Rename Icon `path` property to `svgPath` and update component to correctly render SVG elements.
- (v0_9) Wire up agent-provided primary color to basic catalog components.

## 0.9.1

- (v0_9) Re-style the v0_9 catalog components using the default theme from
  `web_core`. [#1079](https://github.com/a2ui-project/a2ui/pull/1079)
- (v0_9) Add missing features to ChoicePicker and CheckBox. [#1145](https://github.com/a2ui-project/a2ui/pull/1145)

## 0.9.0

- (v0_9) Modify Text widget from the basic catalog to support markdown.
- (v0_9) Add `Context.markdown` to the public API
- (CI) Fix post-build script. This pins the dependency on `@a2ui/web_core` to
  the latest available in the repo when publishing.

## 0.8.4

- Add a `v0_9` renderer. Import from `@a2ui/lit/v0_9`.

## 0.8.3

- Prepare to land a `v0_9` renderer.
  - Expose a `v0_8` entrypoint for the package. Users should prefer importing
    from `@a2ui/lit/v0_8`.
  - Mark the old `v0_8` namespace (from the root of the package) as deprecated.

## 0.8.2

- Handle `TextField.type` renamed to `TextField.textFieldType`.
