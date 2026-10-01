# ChartLingo Technical Handover and Maintenance Guide

This document is for the team taking ownership of ChartLingo. The shorter [Quick User Guide](USER_GUIDE.md) explains the newsroom workflow; this guide explains how the system works, how to maintain it, and how to release changes safely.

## 1. Current production setup

| Item | Current value |
| --- | --- |
| Repository | `https://github.com/yuchej/ChartLingo` |
| Production branch | `main` |
| Published app | `https://yuchej.github.io/ChartLingo/chartlingoV2/` |
| Deployment | GitHub Pages via `.github/workflows/deploy-pages.yml` |
| Package schema | ChartLingo package V2, schema version `2.0.0` |
| Browser application | Static HTML, CSS and JavaScript; no build step |
| Canonical Illustrator exporter | `chartlingoV2/illustrator/export-to-chartlingo.jsx` |
| Standard exporter filename | `export-to-chartlingo.jsx` |

Use `export-to-chartlingo.jsx` consistently in the repository, shared distribution folder and Illustrator Scripts folder. The package generator retains an internal version value for diagnostics and compatibility checks, but that value is not part of the distributed filename.

### Source-of-truth rule for future maintenance

This document records the architecture, maintenance contracts and production state verified when it was updated. Filenames and version numbers will naturally age. For every maintenance task:

1. Inspect the current repository and the latest supplied or installed source files.
2. Treat verified current code as the implementation truth.
3. Treat this document as architecture and maintenance guidance.
4. If code and documentation disagree, call out the discrepancy and determine whether it is intentional.
5. Apply the fix to the correct current baseline rather than an older snippet or filename.
6. Update this document after approval when the production state or architecture actually changes.

An exporter filename or version recorded here must never override a newer verified source file.

## 2. What ChartLingo does

ChartLingo translates newsroom graphics without flattening the complete design:

1. The Illustrator ExtendScript exports a structured `.chartlingo` JSON package.
2. The package contains the original preview, editable artwork, text-frame geometry, styles, images and metadata.
3. A CSV or TXT file supplies approved Chinese-to-English pairs.
4. The browser matches translations to source text, lays out English text over preserved artwork, and provides an editor.
5. The result can be exported as editable SVG, PNG or JPEG.

ChartLingo also accepts generic SVG input through an additive SVG adapter. This route must remain separate from the Illustrator-package route.

## 3. Responsibility pipeline

```text
Illustrator document
    ↓
Illustrator JSX exporter
    ↓
.chartlingo package
    ↓
package validation / normalization
    ↓
translation matching
    ↓
English layout
    ↓
SVG rendering
    ↓
browser export
```

Debug the earliest incorrect stage:

- Illustrator is visually correct but package metadata is wrong → exporter problem.
- Package metadata is correct but ChartLingo renders it incorrectly → browser validation, layout or renderer problem.
- The exporter stores optional metadata correctly but ChartLingo ignores it → package interface-contract or renderer problem.

Do not compensate for incorrect upstream metadata in a later stage unless a deliberate backward-compatibility path requires it.

## 4. Repository map

| Path | Responsibility |
| --- | --- |
| `chartlingoV2/index.html` | Application shell and script loading order |
| `chartlingoV2/assets/css/styles.css` | Application and editor styling |
| `chartlingoV2/assets/js/core.js` | Package validation, sanitisation, matching, wrapping and fitting |
| `chartlingoV2/assets/js/app.js` | Application state, generation, layout, editor, rendering and exports |
| `chartlingoV2/assets/js/svg-import.js` | Generic SVG import and translated SVG write-back |
| `chartlingoV2/illustrator/export-to-chartlingo.jsx` | Canonical Illustrator exporter |
| `chartlingoV2/schemas/` | V2 package and result JSON schemas |
| `chartlingoV2/fixtures/` | Stable test packages, translations and SVG fixtures |
| `chartlingoV2/tests/` | Python source-contract tests and browser end-to-end tests |
| `chartlingoV2/USER_GUIDE.md` | End-user instructions |
| `chartlingoV2/design-qa.md` | Editor visual-QA record |
| `.github/workflows/deploy-pages.yml` | Automatic GitHub Pages deployment |

The repository root also contains an older application under `src/`. Current ChartLingo work discussed in this handover belongs in `chartlingoV2/`. Do not accidentally implement V2 fixes only in the root application.

## 5. Important architecture contracts

### Source preview versus English artwork

- `previewSvg` is the complete Illustrator visual rendering and the source of truth for Chinese Source/Original when it is valid.
- `artworkSvg` is the non-translated/base artwork placed underneath the translated English layer.
- `textFrames` are logical editable/translatable text objects.
- If a valid `previewSvg` exists, Chinese Source must render it directly. Do not reconstruct the Chinese side from `textFrames`.

The conceptual English rendering model is `artworkSvg + translated editable textFrames`. These three package elements have different responsibilities and must not be casually substituted for one another.

### Translation matching

`CLV2.match()` in `assets/js/core.js` uses this order:

1. Exact source-text match.
2. Normalised source-text match.
3. Explicit frame ID match.
4. Fuzzy match above the existing confidence threshold.
5. Otherwise retain the source text.

Do not casually change this hierarchy. It affects existing packages and mismatch reporting.

Preserved visual glyphs are not translation content and must not create false mismatches. When **Data mismatch detected** appears, determine whether the cause is genuinely missing translation, segmentation differences, source-text normalisation, visual-glyph contamination, a frame-ID problem or a matching regression. Do not suppress warnings merely to make the UI look clean.

### Preserved visual glyphs

Legend squares and trend symbols such as `■`, `□`, `▪`, `●`, `◆`, `▲` and `▼` may be visual decoration rather than translation keys. The current implementation supports optional `prefixGlyph`, `suffixGlyph`, `preservePrefixGlyph`, `preserveSuffixGlyph`, `prefixStyle` and `suffixStyle` metadata.

- Matching continues to use `sourceText` only.
- English rendering attaches the glyph inside the same logical SVG `<text>` object.
- Glyph color must remain independent of translated-text color.
- The exporter supports RGB, CMYK, Gray and Illustrator Spot Color, including tint.

For example, gray `■` + `2025年6月` and red `■` + `2026年6月` may become gray `■ Jun 2025` and red `■ Jun 2026` without putting `■` in the TXT translation key.

### Illustrator geometry and layout fallback

For Illustrator-origin packages, reliable Illustrator geometry is preferred over invented layout. Preserve, where practical, source text bounds, real font size, alignment, tab anchors, row/column positions, visible-line structure and permitted regions.

Not every Illustrator table exposes reliable semantic table metadata. When trustworthy geometry is unavailable, ChartLingo may reconstruct a conservative fallback. The rule is:

```text
Illustrator geometry first
→ reconstruction fallback
```

Do not default every table to generic equal-width columns when usable Illustrator geometry exists.

### Virtual text objects

A single Illustrator `TextFrame` may produce multiple logical ChartLingo `textFrames`, including table cells, axis labels, source/credit lines and list items. These are virtual cells/items. They must retain stable source-frame identity, row/column identity when applicable, usable bounds, appropriate font size and matching semantics.

Generate virtual records from cached plain JavaScript information rather than repeatedly querying the original live Illustrator object. Do not blindly assign an oversized parent-frame font estimate to every virtual cell.

The opposite case also matters: a visually multi-line header may remain one logical title. Do not classify every multi-line `TextFrame` as a list.

### Font family versus font size

Font-family lookup and font-size preservation are separate concerns:

- Preserve the real source font size when it is safely available.
- Avoid expensive Illustrator font-family/name/style resolution when it causes severe performance problems.
- Use the currently supported ChartLingo fonts for translated output.
- Do not infer every font size from artboard dimensions when reliable source size exists.
- Virtual cells must respect their actual row/cell geometry.
- Do not globally shrink all text to solve one oversized-frame problem.

### Header and title classification

A title may span multiple Illustrator lines while remaining one translation object. For example, `为照顾年长家人 / 而没有工作的本地居民` may need to match one English translation: `Local residents not working to care for elderly family members`.

When source structure supports it, classify a header/title before generic list splitting. Do not globally merge every pair of same-size text objects.

### Images and vectors

- Vectors remain vectors.
- Displayed photographs can be rasterised at a normalised 1200 px graphic size, capped at 1200 px per image dimension.
- Unsupported photo situations fall back safely rather than flattening the complete chart.
- Artboards without photos skip photo processing.
- The temporary Illustrator objects must always be removed and the original document restored.

### Fonts

- The exporter deliberately avoids expensive source-font resolution and records Noto Sans SC-compatible metadata.
- The browser normalises English output to supported Noto Sans SC or Roboto settings.
- Roboto font files and their licence live in `chartlingoV2/assets/fonts/`.
- Test exported SVG in Illustrator whenever font-family or weight logic changes.

### Browser export

Every SVG, PNG and JPEG export uses the system save dialog. Cancelling the dialog cancels that export. Do not restore silent reuse of a previous directory.

## 6. Local development

No npm installation or compilation is required for the V2 browser application.

From the repository root:

```bash
npm run serve
```

or:

```bash
ruby -run -e httpd . -p 4173 -b 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/chartlingoV2/
```

Direct `file://` use is convenient but a local web server is better for browser tests, font loading and diagnosing fetch/CORS behaviour.

## 7. Installing and maintaining the Illustrator exporter

Canonical source:

```text
chartlingoV2/illustrator/export-to-chartlingo.jsx
```

Typical macOS installation:

```text
/Applications/Adobe Illustrator 2026/Presets.localized/en_US/Scripts/export-to-chartlingo.jsx
```

Typical Windows installation:

```text
C:\Program Files\Adobe\Adobe Illustrator 2026\Presets\en_US\Scripts\export-to-chartlingo.jsx
```

Maintenance rules:

1. Treat the repository copy as canonical.
2. Back up the installed script before replacement.
3. Copy the tested repository script into Illustrator's Scripts folder.
4. Restart Illustrator; the Scripts menu is loaded at startup.
5. Confirm that the completion dialog reports the expected internal exporter version.
6. Export a small no-photo chart and a chart with a clipped photo.
7. Import both packages into the deployed ChartLingo site before distributing the script.

Keep the distributed filename stable as `export-to-chartlingo.jsx`. When exporter behaviour changes, update the internal generator version for package diagnostics without adding the version to the filename.

## 8. Tests and release checks

### Essential checks for every change

```bash
node --check chartlingoV2/assets/js/app.js
node --check chartlingoV2/assets/js/core.js
node --check chartlingoV2/assets/js/svg-import.js
sed '/^#target /d' chartlingoV2/illustrator/export-to-chartlingo.jsx > /tmp/chartlingo-exporter-check.js
node --check /tmp/chartlingo-exporter-check.js
git diff --check
```

Run focused browser tests with Playwright available in the environment:

```bash
node chartlingoV2/tests/preserved_glyph_e2e.js
node chartlingoV2/tests/svg_import_e2e.js
node chartlingoV2/tests/editor_e2e.js
node chartlingoV2/tests/text_separation_e2e.js
```

Other focused tests:

```bash
node chartlingoV2/tests/csv_matching_test.js
node chartlingoV2/tests/image_geometry_test.js
node chartlingoV2/tests/numeric_axis_test.js
```

Python tests:

```bash
python3 -m unittest discover -s chartlingoV2/tests -p 'test_*.py'
```

Known test-suite debt at handover: several older Python assertions check historical exporter version strings or implementation text, and several expect the absent `chartlingoV2/illustrator/apply-chartlingo-result.jsx`. Consequently, the full Python suite is not currently a clean release gate. Do not hide those failures; update stale assertions deliberately and either restore the missing importer or remove its obsolete contracts after team agreement. Focused browser regressions are presently the strongest functional checks.

### Minimum manual regression set

Before release, test:

- A simple text-only Illustrator chart.
- A chart with many text objects.
- A chart with five or more table columns.
- A chart with a large clipped photo.
- A chart with no photo.
- Gray and red legend squares.
- `▲` and `▼` trend indicators.
- Multi-line title and long English labels.
- Source, credit and logo placement.
- Auto-height and Fixed 1200 × 800 output.
- SVG, PNG and JPEG export, each with a visible save confirmation.
- Opening the SVG in Illustrator and confirming editable text and correct font weight.
- Chinese Source against Illustrator's original appearance.
- A legacy `.chartlingo` file without preserved-glyph metadata.
- Generic SVG import, translation and SVG export.

## 9. Release and deployment

GitHub Pages deploys automatically when `main` is pushed.

Recommended release sequence:

1. Create a short-lived branch for non-trivial work.
2. Make the narrowest possible change.
3. Run syntax, focused automated and manual fixture tests.
4. Review `git diff` for unrelated or generated files.
5. Update documentation and cache-busting query strings in `index.html` when browser JavaScript changes.
6. Commit with a clear outcome-based message.
7. Merge or push to `main`.
8. Confirm the GitHub Actions Pages job succeeds.
9. Open the production URL in a fresh/private window.
10. Run one production import → translate → edit → export smoke test.

There is no staging environment at present. For risky changes, test from a branch locally and retain the last known-good commit hash before release.

## 10. Versioning and schema changes

- Increment the internal exporter version whenever package-generation behaviour changes.
- Preserve backward compatibility for optional fields whenever possible.
- Do not make optional metadata mandatory in `CLV2.validatePackage()` without a migration strategy.
- A schema change requires updating `schemas/package-v2.schema.json`, `schemaVersion`, validation, fixtures, tests and this document.
- Adding an optional field normally does not require a schema-version bump if older packages still behave identically.
- Update the script query parameter in `index.html` after changing browser JavaScript so GitHub Pages clients do not retain stale code.

## 11. Debugging guide

### Exporter freezes at the beginning

Likely areas:

- Illustrator text or object traversal.
- Font-property access on legacy or unavailable fonts.
- Large group/path scans.
- Photo discovery or raster preparation.

Illustrator JSX execution and ScriptUI updates are largely synchronous. A progress window that still shows `Scanning selected text — 0/34` records the last UI checkpoint that successfully rendered; it does not prove that scanning text is the operation currently blocking. The script may already have entered the next synchronous Illustrator DOM operation while the window still displays the previous label.

Treat progress labels as checkpoints, not stack traces. Do not assign root cause solely from the last visible message. Test the same artboard with photos temporarily hidden, then test a minimal copied artboard, and use isolation/profiling builds for a severe freeze.

### Isolation method for severe exporter problems

1. Establish the latest known-good production baseline.
2. Divide exporter work into coarse stages: text enumeration/indexing, text classification, metadata access, record construction, table/virtual-cell construction, graphics/vector discovery, image processing, preview SVG generation, artwork SVG generation, serialization and file writing.
3. Create clearly named temporary builds that run only one stage or add one stage at a time.
4. Test the same Illustrator document with every build.
5. Record timing and the last completed stage to narrow the responsible operation.
6. Return to the latest production baseline and apply only the proven fix.

Diagnostic builds may intentionally skip package writing or other behaviour. They are not production exporters and must never be distributed as the final script.

### Exporter build categories

**Production baseline**

- Implements the complete supported workflow.
- Creates usable ChartLingo packages.
- Is the base for production fixes.

**Diagnostic/isolation build**

- Is intentionally incomplete and exists to identify a bottleneck or regression.
- May skip writing files or other stages.
- Must be clearly named and never distributed as the final exporter.

**Experimental build**

- Evaluates a proposed architectural change.
- Is not production until relevant regression checks pass.

After a diagnostic build identifies the cause, return to the production baseline, implement only the proven change, run regression tests and produce the next production candidate. Do not gradually turn an isolation script into production without reconciling it with the real baseline.

### Illustrator DOM performance risks

Repeated reads from the live Illustrator DOM can be unexpectedly expensive, especially font resolution, font family/name/style, paragraph metadata, tab stops, `visibleBounds`/`geometricBounds`, deep group or path traversal, per-character styles, and legacy/missing/variable fonts.

Preferred pattern:

```text
Illustrator DOM
    ↓
read required information once per original object
    ↓
cache plain JavaScript data
    ↓
generate virtual records from the cache
```

Avoid repeatedly reading the same live `TextFrame` property for every virtual table cell. Performance work must still preserve required geometry, layout and style metadata; do not remove necessary behaviour merely because it is expensive.

### Photo export is slow

- Confirm the artboard actually contains a supported raster photo.
- Confirm the normalised-output path is used.
- Check whether the photo fell back to its original embedded data.
- Inspect source image dimensions and clipping complexity.
- Do not flatten the whole artboard; preserve vectors and rasterise only displayed photo content.

### Photo flattening fails with “Required value is missing”

This normally indicates an unsupported Illustrator rasterisation call or invalid bounds. The current exporter must fall back safely. Preserve the source document and capture the AI file, Illustrator version, selected image mode and full error dialog.

### Text is huge or overlaps

- Check the package `textFrames[].style.fontSize` values.
- Confirm the safe source-font-size cap remains in `assets/js/app.js`.
- Check artboard units and source bounds.
- Compare `previewSvg` with `artworkSvg` and generated English SVG.
- Do not fix this by globally shrinking all charts.

### Legend/trend symbols disappear

Inspect the frame for:

```text
prefixGlyph / suffixGlyph
preservePrefixGlyph / preserveSuffixGlyph
prefixStyle / suffixStyle
```

The glyph must not be added to the TXT translation key. It should be rendered by `partialColorLineMarkup()` in `assets/js/app.js` as a nested styled `<tspan>`.

### Red legend symbol becomes navy/black

The navy fallback is `#14283f`. This previously happened when Illustrator Spot Color was unsupported. Confirm the exporter `colorHex()` still handles `SpotColor` and tint, then regenerate the `.chartlingo` package. Existing packages that already contain the wrong fallback color cannot be repaired reliably in the browser.

### Missing font when SVG opens in Illustrator

- Confirm the exported SVG uses Noto Sans SC or Roboto and a valid numeric weight.
- Confirm the corresponding font is installed and activated.
- Inspect `data-chartlingo-font-face` and the Illustrator-compatible SVG processing in `assets/js/app.js`.
- Test a new export; do not assume an old SVG was regenerated.

### Destination folder is unexpected

Browser exports intentionally open the system Save dialog every time. Illustrator exporter destinations are separately selected within Illustrator. Do not cache a browser directory and silently reuse it.

### Chinese Source looks different

Confirm `previewSvg` exists and is valid. The source renderer must use it directly and must not reconstruct Chinese text from `textFrames` when it is available.

## 12. AI-assisted maintenance workflow

When using ChatGPT, Codex or another coding assistant, provide the latest affected source files and, when relevant:

- Current exporter version and ChartLingo commit hash.
- Expected Illustrator screenshot and actual ChartLingo screenshot.
- Generated `.chartlingo` package and TXT/CSV translation file.
- A known-good previous version.
- A precise expected-versus-actual description.

Rules for AI-assisted fixes:

- Inspect the latest code before proposing a change; do not assume old snippets are current.
- Determine whether the problem originates in the exporter or ChartLingo before editing.
- Make the smallest targeted change and preserve unrelated functionality.
- Do not remove functions merely to improve performance.
- Return complete modified files when handing work to another maintainer.
- Run available syntax checks and relevant regression tests.
- Compare with known-good behaviour.
- Label diagnostic builds explicitly.
- Do not claim success until the relevant regression test passes.

## 13. Data safety and privacy

- The normal Illustrator/ChartLingo workflow is local-file based.
- The deployed app is static and has no application database.
- Do not add analytics, external uploads or cloud processing without an explicit newsroom privacy review.
- Generic SVG import sanitises active content and removes unsafe external image references.
- Datawrapper import fetches published Datawrapper assets from `datawrapper.dwcdn.net`; this is the main intentional external-data path.
- Never commit confidential source graphics, unpublished newsroom data, API keys or credentials.
- Use synthetic or explicitly approved fixtures in the public repository.
- Private production examples may be used for local diagnosis but must remain outside the public repository unless cleared.

## 14. Change-control rules

High-risk areas require targeted automated and manual regression tests:

| Area | Primary risk | Required checks |
| --- | --- | --- |
| `CLV2.match()` and mismatch detection | Wrong translation or false mismatch | CSV/TXT matching and a legacy package |
| `previewSvg` routing | Chinese Source differs from Illustrator | Original-preview fixture and side-by-side comparison |
| `artworkSvg` / English composition | Missing artwork or duplicated source text | English preview plus SVG/PNG output |
| Table and multi-column geometry | Column overflow or layout drift | Complex table with five or more columns |
| Preserved glyphs | Missing symbol or incorrect independent color | Gray/red `■`, plus `▲` and `▼` |
| Font conversion and sizing | Oversized, missing or substituted text | Multi-line title and editable SVG opened in Illustrator |
| Photo processing | Slow export, lost clipping or full-artboard flattening | Large clipped photo and no-photo chart |
| SVG sanitisation | Unsafe content or damaged artwork | Generic SVG fixture and editable SVG export |
| Output size and crop | Stretched or clipped chart | Auto height and Fixed 1200 × 800 |
| Save-dialog behaviour | Unknown export location or silent overwrite | SVG, PNG and JPEG save/cancel flows |

When diagnosing an issue, first determine whether it belongs to:

1. Illustrator package generation.
2. Package validation or normalisation.
3. Translation matching.
4. English layout.
5. SVG rendering.
6. Browser export.

Fix the earliest incorrect stage. Avoid compensating for bad exporter metadata with unrelated browser-layout changes.

## 15. Rollback and recovery

If production breaks:

1. Identify the last known-good commit with `git log --oneline`.
2. Prefer a normal revert commit rather than rewriting `main` history.
3. Push the revert to `main` and wait for GitHub Pages deployment.
4. Verify the production URL in a fresh/private browser window.
5. Restore the last known-good Illustrator script from the team's controlled distribution folder.
6. Record the failing package and source AI file as private diagnostic material, not a public repository fixture.

Do not use destructive Git resets on a shared branch.

## 16. Ownership and handover checklist

The receiving team should assign:

- A product owner for workflow and acceptance decisions.
- A web maintainer for `chartlingoV2` and GitHub Pages.
- An Illustrator/ExtendScript maintainer for exporter compatibility.
- A newsroom tester with representative AI charts.
- A release owner who approves script distribution and production deployment.

Before concluding handover, confirm the team can independently:

- Clone and serve the repository.
- Locate the current canonical exporter.
- Install and restart Illustrator.
- Produce and inspect a `.chartlingo` package.
- Prepare valid CSV/TXT translations.
- Generate, edit and export a chart.
- Run the focused tests.
- Diagnose whether a problem originates in Illustrator or the browser.
- Deploy and verify GitHub Pages.
- Revert a faulty release.

## 17. Support information to collect

For reproducible bug reports, collect:

- ChartLingo commit hash.
- Exporter internal version from the completion dialog/package.
- Illustrator version and operating system.
- Browser name and version.
- Source `.ai` file if permitted.
- Generated `.chartlingo` package.
- CSV/TXT translation file.
- Exported SVG/PNG/JPEG when relevant.
- Full error dialog and screenshot.
- Whether the issue reproduces on a minimal copied artboard.
- Expected result versus actual result.

Keep production-sensitive source files outside the public GitHub repository.
