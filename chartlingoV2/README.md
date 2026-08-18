# ChartLingoV2

ChartLingoV2 is a separate source-first prototype. It does not replace or modify the original ChartLingo application in the repository root.

## Included vertical slice

- Versioned `.chartlingo` structured interchange format.
- Illustrator extraction prototype for live text, paragraphs, visible lines, artboards, geometry and style metadata.
- Multi-artboard ChartLingo workspace.
- Translation CSV import with ID, exact, normalized and fuzzy matching.
- One translation per Illustrator text frame, even when the frame renders on multiple lines.
- Deterministic English wrapping, font-size floor and boundary/overlap validation.
- A 1200-pixel-wide English canvas whose height is calculated automatically from the source aspect ratio; artwork and typography scale uniformly.
- Source SVG text is removed structurally before English is generated; V2 no longer paints white masks over Chinese text.
- The Illustrator exporter hides live text while generating the artwork preview, so source glyph outlines are not duplicated behind English.
- Packages contain both `previewSvg` (the complete Chinese reference) and `artworkSvg` (the same artwork with live text hidden) so the original and English panels use the correct source.
- Illustrator exporter 0.4.1 detects tab-delimited table text frames and exports every non-empty row/column cell as an independent virtual text block. It also records font weight and detects the main title from its position and size. Ordinary multiline titles remain one translation object.
- Text frames without a CSV match retain their original content, which keeps years, values and percentages visible.
- Retained multi-line frames preserve their original visible lines instead of collapsing into one long line.
- English remains anchored to the source text frame's exact top-left position; fitting uses wrapping and font reduction rather than movement.
- Bundled Roboto Regular and Bold are used for measurement, preview, PNG and editable SVG export.
- Direct SVG and PNG export from ChartLingoV2.
- Optional `.chartlingo-result` export and Illustrator write-back prototype.
- Original Chinese layers are not intentionally overwritten; write-back creates an `English - ChartLingoV2` layer and requires a new `.ai` save target.

## Run

From the repository root:

```bash
ruby -run -e httpd . -p 4173 -b 127.0.0.1
```

Open `http://127.0.0.1:4173/chartlingoV2/` and choose **Load sample** for the built-in demonstration.

## Translation CSV

`CH` and `EN` are required. `ID` is recommended because it matches the Illustrator text-frame ID exactly.

```csv
ID,CH,EN
headline-01,"航程缩短3小时，新加坡经济可获什么？","What can Singapore gain from a three-hour reduction in flight time?"
```

## Illustrator prototype

Scripts are in `illustrator/`:

1. Open a production file in Illustrator.
2. Run `export-to-chartlingo.jsx` through **File → Scripts → Other Script…**.
3. Import the resulting `.chartlingo` file into ChartLingoV2.
4. Import the approved CSV, generate English, review and run checks.
5. Export directly as SVG or PNG when the result is ready.
6. For complex cases, export **Send to Illustrator** and run `apply-chartlingo-result.jsx` against the matching original file.

The Illustrator scripts are capability prototypes. They must be validated on Illustrator 2024, 2025 and 2026 on both macOS and Windows before newsroom deployment.

## Known prototype limitations

- Multiple Illustrator artboards retain independent text frames, but the embedded full-artwork SVG preview is currently used only for a single-artboard package. Multi-artboard packages fall back to structured text previews until per-artboard Illustrator SVG export is validated.
- Outlined text cannot be extracted and is reported for manual review only when the Illustrator object/layer naming provides evidence.
- Text on paths, threaded text, clipping masks, mixed styles inside one frame and compound transforms need additional Illustrator capability tests.
- PNG export depends on browser SVG rendering, using the bundled Roboto files.
- English SVG export embeds the bundled Roboto files. Illustrator handoff requires Roboto to be installed in Illustrator and reports substitutions when it is unavailable.
- PDF export and embedded production fonts are not yet implemented in V2.
- Write-back object IDs are deterministic for a stable document traversal order; persistent Illustrator object tagging still needs a capability spike.

## Safety

- Keep the original `.ai` file backed up.
- Apply results only to the matching source document.
- Always select a new `.ai` filename during write-back.
- Inspect fonts, overflow, clipping and effects before publication.
