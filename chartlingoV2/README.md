# ChartLingo

This directory contains the source-first ChartLingo application.

For team testing and step-by-step Illustrator setup, see the [ChartLingo Team User Guide](USER_GUIDE.md).

## Included vertical slice

- Versioned `.chartlingo` structured interchange format.
- Illustrator extraction prototype for live text, paragraphs, visible lines, artboards, geometry and style metadata.
- Multi-artboard ChartLingo workspace.
- Translation CSV or TXT import with ID, exact, normalized and fuzzy matching.
- One translation per Illustrator text frame, even when the frame renders on multiple lines.
- Deterministic English wrapping, font-size floor and boundary/overlap validation.
- A 1200-pixel-wide English canvas with Auto height by default and an opt-in per-artboard Fixed 1200 × 800 mode; fixed output fits artwork and typography uniformly without stretching.
- Source SVG text is removed structurally before English is generated; V2 no longer paints white masks over Chinese text.
- The Illustrator exporter hides live text while generating the artwork preview, so source glyph outlines are not duplicated behind English.
- Packages contain `previewSvg` for the complete Chinese reference. ChartLingo derives the English artwork in the browser by removing live SVG text.
- Illustrator exporter 0.8.4 exports directly into any selected folder, including nested folders and paths containing spaces or Unicode characters. It tests write access in that exact folder, generates collision-safe filenames from the Illustrator document name, reads every completed package back, validates its JSON and schema, and only reports success after every expected file is present and verified. It removes XML-invalid control characters from embedded SVG artwork, while the browser importer repeats the cleanup for packages made with older exporters. It separates explicit lines and whitespace-delimited items inside a text frame for better translation matching, keeps a same-size multi-line headline as one object, and rejoins decimal axis fragments such as `8` + `.0`. Tabular exports preserve tab anchors and give the final column a full neighboring column width.
- Merged chart content records a structural `styleRole` and inherits only from a same-level sibling. Same-row siblings take priority, followed by the dominant same-role style in the surrounding chart section; translation length and wrapped-line count do not choose the font size.
- Chart-content objects support per-object Auto, Single line, and Manual line-break modes. Headline, subtitle, footer, Source, and Credit objects are excluded from this control.
- Multiple chart-content objects can be selected in the mapping panel and merged into one canonical CSV field. The merged output records `mergedFrom` and `csvField`, inherits the surrounding header typography and column geometry, and remains one logical translation item even when it wraps visually.
- Merged headers store `styleReferenceId` and `inheritStyle`. The editor automatically chooses the nearest sibling header in the same row, or accepts an explicit style reference before merging. Font size is inherited directly and may shrink by no more than 10% only when wrapped text cannot fit vertically.
- The English preview has per-artboard Undo and Redo history for dragging, text edits, CSV remapping, line-break changes, and merge operations. Generating a new English chart starts a fresh edit history.
- Unmatched numeric values use the source artboard as their coordinate system and are mapped proportionally to the 1200px-wide English output. Source/Credit wrap inside the dynamically calculated space before the logo, and only the bottom area grows when extra lines are required.
- An optional per-chart English reference package supplies exact geometry, line breaks, font size and alignment for matching translated frames while the source package continues to supply the artwork.
- Reference matching uses normalized approved English text. Titles are always Roboto Bold, credits follow their reference frames, and CSV-unmatched content keeps the source package geometry unchanged.
- Text frames without a CSV match retain their original content, which keeps years, values and percentages visible.
- Retained multi-line frames preserve their original visible lines instead of collapsing into one long line.
- English remains anchored to the source text frame's exact top-left position; fitting uses wrapping and font reduction rather than movement.
- Bundled Roboto Regular and Bold are used for measurement, preview, PNG and editable SVG export.
- Direct SVG and PNG export from ChartLingo.
- Original Chinese layers are not intentionally overwritten.

## Run

From the repository root:

```bash
ruby -run -e httpd . -p 4173 -b 127.0.0.1
```

Open `http://127.0.0.1:4173/chartlingoV2/` and choose **Load sample** for the built-in demonstration.

## Translation CSV or TXT

`CH` and `EN` are required. `ID` is recommended because it matches the Illustrator text-frame ID exactly.

```csv
ID,CH,EN
headline-01,"航程缩短3小时，新加坡经济可获什么？","What can Singapore gain from a three-hour reduction in flight time?"
```

TXT files may use one Chinese/English pair per line separated by a Tab (recommended), `|`, or `=>`. Labelled `CH:`/`EN:` pairs and alternating Chinese and English lines are also supported. Comma-separated TXT files require a `CH,EN` header.

## Illustrator prototype

Scripts are in `illustrator/`:

1. Open a production file in Illustrator.
2. Run `export-to-chartlingo.jsx` through **File → Scripts → Other Script…**.
3. Import the resulting `.chartlingo` file into ChartLingo.
4. Import the approved CSV or TXT file and, when available, the matching English reference `.chartlingo` package.
5. Generate English, review and run checks.
6. Export directly as SVG or PNG when the result is ready.

The Illustrator scripts are capability prototypes. They must be validated on Illustrator 2024, 2025 and 2026 on both macOS and Windows before newsroom deployment.

## Known prototype limitations

- Multiple Illustrator artboards retain independent text frames, but the embedded full-artwork SVG preview is currently used only for a single-artboard package. Multi-artboard packages fall back to structured text previews until per-artboard Illustrator SVG export is validated.
- Outlined text cannot be extracted and is reported for manual review only when the Illustrator object/layer naming provides evidence.
- Text on paths, threaded text, clipping masks, mixed styles inside one frame and compound transforms need additional Illustrator capability tests.
- PNG export depends on browser SVG rendering, using the bundled Roboto files.
- English SVG export embeds the bundled Roboto files.
- PDF export and embedded production fonts are not yet implemented in V2.
- Write-back object IDs are deterministic for a stable document traversal order; persistent Illustrator object tagging still needs a capability spike.

## Safety

- Keep the original `.ai` file backed up.
- Always select a new `.ai` filename during write-back.
- Inspect fonts, overflow, clipping and effects before publication.
