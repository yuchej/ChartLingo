# ChartLingo

ChartLingo is a local, SVG-first newsroom graphics localization studio. It preserves the original canvas and Chinese source, maps approved third-party English into a separately editable Roboto layer, validates hard layout constraints, and exports at the original dimensions.

## Run

No external provider, credential, or JavaScript package installation is required. You can double-click `index.html`; ChartLingo no longer requires ES-module loading for its local upload workflow.

To use a local web address instead, run:

```bash
ruby -run -e httpd . -p 4173 -b 127.0.0.1
```

Open `http://127.0.0.1:4173`. Upload one or more SVG fixtures from `test/fixtures/graphics-localization`, paste one approved English segment per line, then choose **Auto match & generate**. The upload area now reports importing, success, and per-file failure states and also accepts drag-and-drop.

## Test

```bash
python3 -m unittest discover -s tests -v
```

## What is implemented

- SVG-only multi-card import with stable IDs, exact canvas/viewBox capture and per-card failure isolation.
- Active SVG content and external URLs are removed before DOM preview.
- Canonical Chinese and English text objects, deterministic fake OCR/matcher, Datawrapper mojibake candidate selection and visible provenance in the scene model.
- Approved copy segmentation without rewriting, basic mapping integrity, editable Roboto English and local autosave/history.
- Preferred structured translation-file workflow for CSV/TXT files with `CH` and `EN` headers: exact, normalized-exact and fuzzy matching; confidence/method display; manual pair selection, confirmation, unlinking and English editing; whole-series reuse and unused-entry reporting. XLSX remains disabled.
- Strict/Flexible deterministic layout, 80%/role size floor, boundary/text/logo/mapping/font validation.
- Side-by-side original and English canvases; object text, geometry, size and role controls.
- Editable SVG, logical-size PNG and experimental single-card PDF export.

## Known release-gate gaps

- The local fake OCR reads fixture metadata; production visual OCR and outlined-glyph reconstruction are not enabled.
- Nested transform/tspan extraction currently preserves source but does not yet resolve all geometry into world coordinates (AC-005 incomplete).
- Manual mapping merge/split/assign UI, card drag reorder, resize handles, Reset Card, full operation history and revision conflicts are incomplete.
- Full-series downloads currently emit deterministic individual downloads; ZIP packaging and multi-page PDF are not complete (AC-019 incomplete).
- PDF uses a minimal Helvetica text writer and is experimental; Roboto embedding, Unicode fidelity, PNG/PDF cross-browser visual goldens and E2E release evidence are pending.
- LocalStorage is the V1 persistence fake; production database, object storage, retention and isolated worker policy await deployment decisions.

See [Phase 0](docs/chinese-to-english-graphics-studio/PHASE_0_PLAN.md), [architecture decisions](docs/chinese-to-english-graphics-studio/ADR.md), and the [format matrix](docs/chinese-to-english-graphics-studio/SUPPORTED_FORMATS.md).
