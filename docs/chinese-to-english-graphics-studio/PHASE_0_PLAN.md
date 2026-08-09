# Phase 0 implementation plan

## Repository discovery

- The repository was greenfield: only `test.webp` existed and no `AGENTS.md`, package manifest, tests, or stack conventions were present.
- The local machine has Python 3 but no Node.js runtime. The first vertical slice therefore uses browser-native ES modules, SVG and Canvas with a Python standard-library development server and tests. Modules are separated so a React/Next.js shell can replace the UI without replacing the scene/import/mapping/layout/validation contracts.
- No deployment, credentials, external OCR/LLM calls, database, or paid service is used.

## Executable phases

1. Foundation: canonical scene model, immutable sanitized SVG source, stable card IDs, local revisioned persistence.
2. Safe SVG import: limits, signature checks, active-content sanitizer, exact canvas/viewBox parsing, text/tspan extraction, protected bottom-right logo region.
3. Deterministic hybrid detection and mapping: injectable OCR/matcher interfaces with local fakes, mojibake reconciliation, lossless approved-English segmentation, ambiguity/duplicate/unmapped reporting.
4. English generation/editor: separate Roboto text layer, side-by-side original/English views, text and geometry controls, card reorder, Strict/Flexible modes and local history.
5. Validation/export: versioned rules, error blocking/warning acknowledgement, current/series SVG, PNG and PDF, deterministic names and ZIP for multi-file exports.
6. Evidence: synthetic fixtures and acceptance-ID tests; document partial and unverified areas honestly.

## Decisions and assumptions

- SVG is the only enabled import adapter. PDF/AI/PNG/JPG are shown as disabled guidance, not mature inputs (AC-025).
- Source bytes are preserved in browser-local project state for this local V1. Production storage/retention remains an open deployment decision.
- `LOGO_SAFE_PADDING=16`; a bottom-right element whose id/class contains `logo` or `bug` defines the protected area. If absent, users can review the configured guide; production templates should provide explicit metadata.
- Role minimum font sizes: title 18, subtitle 14, body 12, data/axis/source/footnote 10 CSS px. Flexible displacement: title/subtitle/body 32, labels 8.
- Roboto is requested through the CSS font stack without a network fetch. Preflight reports a warning if unavailable; production embedding/subsetting remains open.
- Browser-native PNG and a deterministic minimal vector PDF exporter are implemented and tested structurally. Cross-browser pixel/PDF fidelity and multi-page PDF are not claimed mature until AC-019/TC-019/020 visual gates pass.
- Fake OCR recognizes `data-visual-text` fixture metadata only. It never sends source data off-device. The provider boundary is explicit for later approved OCR.
- Warnings require acknowledgement; errors block export.

## Phase 0 exit

The app has a dependency-free boot path, fixture policy, honest format matrix, configuration defaults, architecture decisions, and deterministic test commands. Unsupported input formats are not accepted.
