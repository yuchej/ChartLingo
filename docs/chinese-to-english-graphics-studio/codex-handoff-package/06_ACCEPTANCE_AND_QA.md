# Acceptance Criteria and QA Test Cases

## 1. Release priorities

- **P0:** release blocking for V1.
- **P1:** required for Level 2 pilot unless explicitly waived.
- **P2:** later hardening/Level 3.

## 2. Acceptance criteria

| ID | Pri | Criterion |
|---|---:|---|
| AC-001 | P0 | A user can upload one SVG or a multi-card series; order is preserved and editable. |
| AC-002 | P0 | Width, height and viewBox remain exactly unchanged through import and every export. |
| AC-003 | P0 | Original/Chinese content remains recoverable and unchanged; English exists on a separate toggleable layer. |
| AC-004 | P0 | Unsafe SVG active content and external resource loading are neutralized before preview/render. |
| AC-005 | P0 | Editable SVG text, nested transforms, tspans, style and anchors normalize into correct canonical geometry. |
| AC-006 | P0 | For the mojibake fixture, visual Chinese content is selected while trustworthy SVG geometry is retained, with provenance visible. |
| AC-007 | P1 | Outlined Chinese text can produce reviewable detected regions and new editable English objects without deleting source paths. |
| AC-008 | P0 | Smart Paste accepts whole-series or current-card English without silently changing approved wording, numbers or units. |
| AC-009 | P0 | Mapping identifies unmapped, duplicated and ambiguous segments and supports manual assign/unassign/merge/split/rematch. |
| AC-010 | P0 | All English text, including data/axis labels, can be edited; supported geometry/typography controls persist after reload. |
| AC-011 | P0 | English defaults to Roboto with consistent measurement in editor and export. |
| AC-012 | P0 | Strict mode uses the specified priority and does not move non-text visuals. |
| AC-013 | P0 | Flexible mode can reposition English text only within its limits and never violates hard constraints. |
| AC-014 | P0 | No automatic layout shrinks below 80% of mapped Chinese size or the role minimum; unresolved fit creates an issue. |
| AC-015 | P0 | Boundary, overlap, logo safe-area, protected visual, minimum-size and mapping validation rules identify card and object. |
| AC-016 | P0 | Bottom-right logo and configured padding remain unchanged/protected in both modes and exports. |
| AC-017 | P0 | Undo/redo covers text and geometry edits; Reset Position and Reset Card restore documented baselines without changing Chinese. |
| AC-018 | P0 | Side-by-side view keeps corresponding Chinese and English cards available during editing with synchronized comparison controls. |
| AC-019 | P0 | Current card and full series export to PNG, SVG and PDF with deterministic order/naming; series multi-file export is zipped. |
| AC-020 | P0 | SVG output retains English as editable text where supported and exports contain the approved English exactly apart from allowed presentation changes. |
| AC-021 | P0 | Open errors block export; warnings require visible acknowledgement according to configured policy. |
| AC-022 | P1 | A single-card job failure does not discard or corrupt other cards in the series. |
| AC-023 | P1 | Autosave, revision conflicts, idempotent retry and user-visible saving/error states behave deterministically. |
| AC-024 | P1 | Core workflow is keyboard reachable and severity/status is not conveyed by color alone. |
| AC-025 | P1 | Unsupported PDF/AI/PNG/JPG adapters are disabled or labeled experimental with actionable guidance. |

## 3. Required fixture matrix

| Fixture | Purpose |
|---|---|
| F01 clean editable SVG | Basic text/style/geometry/export |
| F02 nested transforms+tspans | Coordinate/style normalization |
| F03 Datawrapper mojibake SVG | Hybrid detection |
| F04 outlined Chinese text SVG | Visual region reconstruction |
| F05 very long English title | 20% floor and warning |
| F06 logo collision | Safe area in both modes |
| F07 dense chart labels | Role-aware overlap/displacement |
| F08 rotated/anchored labels | Measurement and validation |
| F09 five-card mixed series | Series paste/order/partial failure/export |
| F10 malicious SVG corpus | Script/link/foreign content sanitation |
| F11 duplicate/missing translation | Mapping integrity |
| F12 Unicode copy | Apostrophes, symbols, currency, percentages and CJK |

Fixtures must be synthetic or rights-cleared and include expected scene/validation snapshots.

## 4. Detailed QA cases

### Import and security

**TC-001 (AC-001/002):** Upload F01 alone. Verify one card, exact dimensions/viewBox and ready state. Export/reimport and compare logical dimensions.

**TC-002 (AC-005):** Import F02. Compare normalized bounds, anchors, rotations and computed styles to its golden scene JSON within documented tolerance.

**TC-003 (AC-006):** Import F03 where embedded text is corrupted but rendered Chinese is readable. Verify selected content comes from visual OCR, geometry comes from SVG, both candidates are retained and provenance is shown.

**TC-004 (AC-007):** Import F04. Confirm original paths remain immutable; detected regions can be corrected; generated English is editable.

**TC-005 (AC-004):** Import each F10 variant containing script, event handler, javascript/data URL, external image/font, unsafe CSS and foreignObject. Verify no code/network request executes, unsafe content is removed/rejected, and an actionable error is recorded.

**TC-006 (AC-022):** In F09 make card 3 malformed. Verify cards 1,2,4,5 remain usable and card 3 can be replaced/retried.

### Translation and mapping

**TC-007 (AC-008):** Paste series copy containing `S$30,000`, `12.5%`, `2026`, punctuation and capitalization. Generate and export; compare approved strings to outputs except recorded allowed line-break/display-capitalization transformations.

**TC-008 (AC-009):** Use F11. Verify duplicate use, missing segment and unmatched object are surfaced; no segment disappears. Manually assign and confirm issues resolve.

**TC-009 (AC-009):** Merge two Chinese objects to one English segment, split one pasted segment and rematch. Undo/redo each operation and reload.

**TC-010 (AC-008/009):** Paste for Current Card, then Entire Series. Verify scope is explicit and existing confirmed mappings are not silently overwritten.

### Editing and history

**TC-011 (AC-003/010/011):** Edit title and a data label, change all supported styles/geometry, toggle layers and reload. Verify English persists in Roboto and original/Chinese is byte/logically unchanged.

**TC-012 (AC-017):** Perform text edit → drag → resize → mapping edit. Undo to baseline and redo to final. Reset Position affects only selected geometry; Reset Card restores generated baseline after confirmation.

**TC-013 (AC-018/024):** Navigate cards, canvas objects, inspector and issues by keyboard; verify focus visibility, accessible names and synchronized comparison.

### Layout and validation

**TC-014 (AC-012/014):** Run Strict on F05. Verify position is preserved while line break/box/size candidates are tried in order. Size never falls below floor; unresolved fit creates a named issue.

**TC-015 (AC-013):** Run Flexible on F05/F07. Verify movement remains within role limits, hierarchy is preserved and each move can be explained/reproduced.

**TC-016 (AC-015/016):** Force English into F06 logo region by auto-layout and manual drag. Verify preview feedback and LOGO_SAFE_AREA issue; auto-layout never accepts it; exported logo geometry is unchanged.

**TC-017 (AC-015):** Trigger boundary, text-text overlap, protected-chart overlap, minimum size, missing font and unmapped-copy violations. Confirm correct rule, severity, card, object and click-to-focus.

**TC-018 (AC-015):** Move a rotated F08 label near a boundary. Verify oriented geometry catches true crossing without obvious false positive.

### Export and jobs

**TC-019 (AC-019/020):** Export F01 in all formats. Inspect PNG dimensions, PDF page box, SVG viewBox/text nodes, exact content and Roboto policy.

**TC-020 (AC-019):** Export F09 series. Verify deterministic `name_EN_01..05`, card order, ZIP contents and multi-page PDF order if offered.

**TC-021 (AC-021):** With an open error, export is blocked with navigation to issue. With warnings only, acknowledgement is explicit and export manifest records them.

**TC-022 (AC-023):** Retry the same import/export idempotency key and simulate worker interruption. Verify no duplicate cards/exports and job resumes or fails safely.

**TC-023 (AC-023):** Edit the same revision in two sessions. Verify a clear conflict flow; no last-write-wins data loss.

**TC-024 (AC-025):** Attempt each disabled/experimental non-SVG format. Verify UI/API capability match and guidance is honest.

## 5. Non-functional QA

- Test agreed maximum cards/file size/dimensions without UI lockup or worker memory exhaustion.
- Verify no raw graphic/translation content appears in ordinary logs.
- Test supported browsers at 1280×720 and larger, 200% zoom and reduced motion.
- Run visual regressions for primary screens and golden output renders.
- Test deletion/retention and signed-download expiry once persistence policy is chosen.

## 6. Release evidence

Release report must include acceptance matrix (pass/fail/waived with reason), test commands and results, fixture/version hashes, measured success targets, known limitations and sample exports. A feature is not “supported” because the UI accepts the extension; its applicable acceptance tests must pass.

