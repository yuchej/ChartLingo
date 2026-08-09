# Product Requirements Document

## 1. Product summary

**Working name:** ChartLingo  
**Product:** A browser-based production tool that converts Chinese charts, news cards, maps and infographics into English versions using third-party translations, while preserving design structure and allowing final text editing and export.

The product is a localization and layout tool, not a translation engine and not a design generator. Its central promise is: upload one graphic or a series, paste approved English, automatically map and lay out the copy, review it beside the Chinese original, fix exceptions, and export at the original dimensions.

## 2. Problem and goals

Newsroom graphics contain many text roles and tightly constrained layouts. English is often longer than Chinese, and source files may contain corrupted text, outlined glyphs or flattened imagery. Manual recreation is slow and error-prone.

### Goals

- Reduce manual localization work while preserving editorially approved English.
- Preserve exact canvas dimensions and almost all non-text visual structure.
- Make every English text item, including data labels, editable.
- Make layout failures explicit and actionable.
- Support a natural series workflow without making single-card use cumbersome.
- Reach Level 2 in V1: most SVG graphics need only mapping review and light adjustment.
- Evolve to Level 3: upload, paste, validate and publish with little or no layout work.

### Non-goals for V1

- Producing authoritative translations.
- Redesigning charts or changing underlying data.
- Pixel-perfect reconstruction of arbitrary flattened PNG/JPG files.
- Native parsing of every Illustrator feature.
- Multi-user approvals, asset libraries, billing or a full DAM.

## 3. Users and success measures

Primary users are newsroom graphic designers, visual journalists and localization editors. Secondary users are producers who validate and export localized series.

V1 success targets to validate with a representative, rights-cleared fixture set:

- At least 90% of editable-text SVG text regions are detected.
- At least 90% of English mappings are correct or require only a single manual reassignment.
- At least 80% of test cards pass hard layout checks after auto-layout without manual geometry edits.
- 100% of exports preserve the original pixel/viewBox dimensions.
- 100% of reported hard violations identify the card and object.
- No approved English wording, number or unit is silently rewritten.

These are product targets, not assumed facts; instrument and measure them before claiming them.

## 4. Scope and maturity

| Capability | V1 / Level 2 | Later / Level 3 |
|---|---|---|
| SVG with editable text | Production focus | Hardened, broad SVG compatibility |
| Datawrapper SVG | Geometry parse + rendered visual verification | Better provider-specific recovery |
| PDF | Adapter contract; experimental if implemented | Text-run reconstruction and reliable import |
| AI | Guided conversion to SVG/PDF or experimental adapter | Server-side conversion with explicit limits |
| PNG/JPG | Adapter contract; optional OCR preview | Robust OCR/vision reconstruction |
| Mapping | Smart Paste + manual table | Higher-confidence, near-touchless mapping |
| Layout | Strict/Flexible + validation | Near-production automatic resolution |
| Collaboration | Local project workflow | Optional review/approval history |

The upload UI may advertise the final supported family only when the corresponding adapter is actually enabled. Unsupported or experimental formats must be labeled honestly and must not imply SVG-level fidelity.

## 5. Core workflow

1. Create or name a project/series.
2. Upload one or multiple graphics; preserve input order and allow reordering.
3. Parse structure, render a visual reference and detect/classify text.
4. Show import quality and unresolved regions.
5. Paste approved English for the whole series by default, or for one card.
6. Auto-match English segments to Chinese text objects; show confidence and ambiguity.
7. Review/edit mappings: edit, reorder, assign, unassign, merge, split and rematch.
8. Generate a separate English layer in Roboto.
9. Apply Strict or Flexible layout.
10. Validate boundary, collision, safe-area and typography rules.
11. Review Chinese and English side by side; edit English text and geometry.
12. Export current card or the entire series.

## 6. Functional requirements

### 6.1 Import and series

- Accept 1..N cards per series; assign stable card IDs independent of order.
- Preferred input is SVG with text preserved as text.
- Read and lock width, height and SVG viewBox where present.
- Preserve original asset bytes for reprocessing and audit.
- Show per-card import status: queued, parsing, needs review, ready, failed.
- Allow add, remove, rename and reorder before export.
- Sanitize SVG; reject scripts, event handlers, external active content and unsafe URLs.
- Enforce configurable file-count, size, dimension and decompression limits.

### 6.2 Hybrid SVG detection

Never assume embedded SVG text is correct.

For each SVG:

1. Parse DOM structure and transforms; extract text/textPath/tspan geometry, style, anchors and grouping.
2. Render a deterministic raster reference at original dimensions or a known scale.
3. Perform visual text detection/OCR on rendered regions.
4. Compare embedded text with visual recognition using script validity, encoding heuristics, geometry overlap and OCR confidence.
5. Select the content source per region while keeping structural geometry as the primary layout source.
6. Record provenance and confidence; never overwrite the preserved original.

If embedded text is mojibake but the rendering is readable, use visually recognized Chinese content and original SVG geometry. If text is outlined, infer regions visually and create new editable English objects while retaining the original paths in the Chinese/original layer. If both sources are uncertain, require review.

### 6.3 Text semantics

Classify text objects as TITLE, SUBTITLE, BODY, ANNOTATION, DATA_LABEL, AXIS_LABEL, LEGEND, SOURCE, FOOTNOTE or CAPTION. LOGO_BUG is a protected non-editable object/region, not translatable text. Users may correct roles.

### 6.4 Translation and mapping

- Smart Paste is the default and accepts a full series translation or one-card copy.
- Segment pasted content without paraphrasing.
- Third-party English is authoritative for wording, values, units, currencies and percentages.
- Allowed automatic presentation changes: whitespace normalization, line breaks and configurable capitalization styling. Preserve the underlying approved string separately.
- AI matches segments using Chinese content, semantic role, card order, grouping and visual layout.
- Every mapping has confidence, rationale codes and status: proposed, confirmed, ambiguous or unmapped.
- Never silently drop or duplicate a segment.
- Mapping table supports assign/unassign, edit English, reorder, merge/split and rematch.
- Low-confidence and many-to-many matches require visible review.

### 6.5 Layers and editor

- Preserve an immutable original representation and logical Chinese layer.
- Generate a separate English layer; layer visibility can be toggled.
- Default workspace is synchronized side-by-side Chinese/English.
- English objects support direct text editing, selection, drag and resize.
- Typography controls: Roboto family, weight, size, line height, letter spacing and alignment.
- Geometry controls: x, y, width, height and rotation.
- Data labels are independent editable text objects while retaining relationships to chart marks.
- Undo/redo covers content, mapping and layout operations.
- Reset Position restores the last auto-layout geometry for the selected object.
- Reset Card restores the generated English card baseline after confirmation without changing the Chinese original.
- Autosave edits; show saving/saved/error states.

### 6.6 Layout modes

Hard constraints in both modes:

- Canvas width, height and viewBox are unchanged.
- No English text crosses the canvas boundary.
- No English object enters the logo protected area.
- Non-text chart/illustration/image/icon/logo geometry remains unchanged unless a future explicit feature permits it.
- Minimum English size is `max(roleMinimum, mappedChineseSize × 0.8)`; never shrink beyond 20% relative to mapped Chinese.
- Any unresolved constraint creates a warning/error; it is never hidden.

Strict priority:

1. Preserve anchor and position.
2. Adjust line breaks.
3. Resize the text box into available space.
4. Reduce font size down to the allowed minimum.
5. Warn.

Flexible may additionally move/resize text within configurable role-specific limits and adjust nearby English text spacing, while preserving hierarchy and chart-label relationships. It still cannot move non-text visuals or violate hard constraints.

### 6.7 Validation

Run automatically after generation and relevant edits; also provide Run Check.

- Canvas boundary / clipping.
- English-to-English collision.
- English-to-protected visual collision, including logo safe area.
- Text-to-chart collision where protected geometry is known.
- Minimum font size and 20% shrink limit.
- Missing/duplicate/unmapped approved English.
- Empty or invalid text, missing font and export readiness.
- Role-aware checks: axis/data labels have tighter displacement thresholds.

Each issue has severity, card, object(s), rule, message, suggested action and status. Warnings may be exported after acknowledgement; errors block export. Exact blocking policy is configurable but must be deterministic and visible.

### 6.8 Export

- Export current card or full series as PNG, SVG or PDF.
- Preserve exact dimensions and deterministic ordering/names such as `project-name_EN_01.svg`.
- Full-series multi-file export is a ZIP; a multi-page PDF may also be offered.
- SVG retains editable English `<text>` whenever technically possible and embeds/references Roboto according to licensing and portability policy.
- PNG exposes scale (1× default) without changing logical dimensions.
- Export defaults to English visible and Chinese hidden; optional bilingual/layer-preserving SVG can be explicit.
- Run preflight and include acknowledged warnings in an export report/manifest.

## 7. UX and quality principles

- Keep the approved copy visible and traceable.
- Confidence is assistance, not certainty; ambiguous work is reviewable.
- Prevent hidden damage: preserve originals, use non-destructive layers and provide reset/history.
- Optimize for exception handling, not only the happy path.
- Keyboard navigation, visible focus, accessible labels and non-color-only severity cues are required.

## 8. Security, privacy and reliability

- Treat uploaded SVG/XML, filenames and pasted translations as untrusted.
- Sanitize before DOM insertion or rendering; isolate rendering workers.
- Do not send assets to an AI/OCR provider without a documented data-flow choice and user-visible policy.
- Avoid logging source graphic content or translation text; use IDs and metrics.
- Use signed/short-lived asset access, retention/deletion controls and least privilege.
- Jobs are idempotent, retryable and observable. Preserve intermediate artifacts and model/provider versions for reproducibility.

## 9. Open implementation decisions

These should be resolved by short technical spikes, not silently guessed:

- Deployment environment and identity/storage requirements.
- Approved OCR/vision and LLM providers, data residency and retention.
- Browser/server rendering library and PDF engine.
- Roboto embedding/subsetting policy.
- Default role minimum sizes, logo padding and Flexible displacement bounds.
- Exact format adapter release dates and acceptable AI/PDF fidelity.

