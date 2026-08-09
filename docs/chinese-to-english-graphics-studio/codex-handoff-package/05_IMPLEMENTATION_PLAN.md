# Phased Implementation Plan and Task Breakdown

## Delivery strategy

Build vertical slices behind feature flags. A phase is complete only when its acceptance IDs pass with deterministic local dependencies. Do not defer sanitation, dimensions or validation until the end.

## Phase 0 — Discovery and decisions

- Inspect repository, instructions, stack, auth/storage and deployment constraints.
- Record architecture decision records for scene representation, editor/rendering library, job model, persistence and font/export strategy.
- Assemble rights-cleared fixtures and baseline screenshots.
- Define enabled formats and honest UI labels.
- Establish test, lint, type-check and CI commands.

Exit: app boots; fixture policy exists; open product decisions are recorded; no unsupported capability is implied.

## Phase 1 — Foundation and safe SVG import

- Project/card schema, asset storage abstraction, revisions and job status.
- Upload limits, MIME/signature checks and error taxonomy.
- SVG sanitizer and isolated renderer with network disabled.
- SVG parser for canvas/viewBox, groups, transforms, styles, text/tspan and protected objects.
- Canonical scene graph persistence and immutable source.
- Card strip for one or many uploads with progress/failure isolation.

Exit: clean and malicious fixtures behave correctly; exact dimensions survive a parse/render round trip.

## Phase 2 — Hybrid detection and import review

- Render reference and OCR/vision provider interface with deterministic fake.
- Embedded-text quality and mojibake heuristics.
- Candidate reconciliation, provenance and confidence.
- Outlined-text region reconstruction.
- Semantic role classifier and manual role correction.
- Import-review UI for uncertain regions, merge/split and candidate selection.

Exit: Datawrapper mojibake fixture uses visual content plus SVG geometry; outlined fixture yields editable target regions; uncertainty is visible.

## Phase 3 — Translation ingestion and mapping

- Whole-series/current-card paste and lossless segmentation.
- Approved vs display text storage.
- Matcher provider interface, schema validation and deterministic fake.
- Constraint-based mapping with omissions/duplicates/many-to-many detection.
- Mapping table with confirm, edit, assign/unassign, reorder, merge/split and rematch.
- Instrument confidence and manual correction.

Exit: single and five-card fixtures map without dropping/duplicating approved segments; ambiguous mappings require review.

## Phase 4 — English layer and editor

- Generate separate English objects in Roboto, preserving source relationships.
- Side-by-side synchronized canvases and layer toggles.
- Direct text, typography and geometry editing; data-label editing.
- Selection, drag, resize, keyboard nudge and accessible object list.
- Autosave, optimistic concurrency and saved/error feedback.
- Undo/redo, Reset Position and Reset Card.

Exit: reload preserves edits; undo/redo/reset are deterministic; original layer bytes/scene are unchanged.

## Phase 5 — Layout and validation

- Exact font loading/measurement and line-breaking candidates.
- Strict solver in required priority order.
- Flexible solver with role-specific bounds/penalties.
- Protected logo safe area and protected visual geometry.
- Versioned incremental and full validation rules.
- Issues panel, click-to-focus, resolution/acknowledgement and export policy.

Exit: long-copy, collision, boundary and logo fixtures produce expected layouts/issues; no solver output bypasses validation.

## Phase 6 — Export

- Deterministic SVG writer with editable English text.
- PNG renderer and PDF writer.
- Current-card and series jobs; ZIP naming and optional multi-page PDF.
- Exact-dimension preflight, font policy and export manifest.
- Retry/status/download UI and expiry behavior.

Exit: exports pass dimension, content, order and editability checks across browsers/renderers selected for support.

## Phase 7 — Hardening and Level 2 pilot

- Complete E2E, visual regression, accessibility and malicious-input suites.
- Load tests for agreed card/file limits and worker retry/idempotency.
- Privacy/log audit; retention/deletion verification.
- Pilot with representative newsroom fixtures; measure PRD success targets.
- Fix top failure clusters and publish known limitations/runbook.

Exit: all P0 criteria pass; measured targets and remaining gaps are reported honestly.

## Phase 8 — Level 3 roadmap

- Production PDF text-run reconstruction.
- Explicit AI conversion service and compatibility matrix.
- PNG/JPG OCR/layout reconstruction improvements.
- Higher-confidence mapping and automatic exception resolution.
- Review/approval workflows, provider observability and broader export fidelity.

## Workstream dependencies

```text
Foundation → SVG scene → hybrid detection → mapping → English layer
                                   └──────────────→ layout/validation → export
Security + revisions + tests run across every phase
```

## Suggested issue decomposition

Each issue should cite acceptance IDs and include fixture/tests. Keep tasks small enough for one reviewable change: schema/migration, sanitizer, parser transforms, OCR adapter, reconciliation, paste segmentation, matcher schema, mapping actions, canvas selection, text inspector, history, Strict solver, Flexible solver, each validation rule, each exporter and each E2E journey.

## Definition of done

- Acceptance IDs covered by automated tests where feasible.
- Type-check/lint/unit/integration/E2E commands pass.
- No secrets or proprietary fixtures committed.
- UI includes loading, empty, partial failure and retry states.
- Data and security implications documented.
- Known gaps are explicit; disabled functionality is not presented as supported.

