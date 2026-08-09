# README / Delivery and Operating Guide

## What this package authorizes

It defines and plans the product. It does not authorize deploying, purchasing provider services, uploading proprietary graphics to third parties or weakening privacy/security controls. Codex should implement locally within the repository and ask before external side effects.

## Handoff checklist

Provide Codex with:

- This complete folder.
- The target repository and its local instructions.
- Synthetic/rights-cleared sample SVGs, especially a real-shaped Datawrapper mojibake example.
- Brand logo safe-area dimensions or a rule for detecting/setting them.
- Agreed minimum font sizes and Flexible movement limits by role.
- Decisions on OCR/LLM provider, data handling, retention and deployment.
- Expected browser and maximum file/card limits.

If these choices are unavailable, Codex should use configurable placeholders and deterministic local fakes, not hard-code an external provider.

## Recommended first run

1. Place the package under the repository documentation folder.
2. Paste `04_CODEX_MASTER_PROMPT.md` into the implementation task.
3. Ask Codex to complete Phase 0 and return the decision log and fixture gaps before large implementation work.
4. Review the proposed stack only where the repository does not already decide it.
5. Implement phases in order and require acceptance IDs in pull-request descriptions.

## Input guidance for users

- Best: Illustrator/Datawrapper SVG with text preserved as text.
- SVG remains useful even if embedded text is corrupt because geometry and chart structure may be recoverable.
- For outlined SVG, the tool reconstructs editable English text over preserved source paths and requires more review.
- PDF/AI/PNG/JPG should be treated according to the enabled adapter label; V1 quality expectations must remain SVG-first.

## Configuration to expose

```text
MAX_FILES_PER_SERIES
MAX_UPLOAD_BYTES
MAX_CANVAS_DIMENSION
LOGO_SAFE_PADDING
ROLE_MIN_FONT_SIZE_*
FLEX_MAX_DISPLACEMENT_*
OCR_REVIEW_THRESHOLD
MAPPING_REVIEW_THRESHOLD
EXPORT_WARNING_POLICY
ASSET_RETENTION_DAYS
```

Provider settings and secrets belong in environment configuration and a secret store. Ship an `.env.example` with names only.

## Operational runbook outline

- Import failures: identify sanitation, parser, renderer or OCR stage; preserve source and retry only idempotently.
- Mapping failures: fall back to manual mapping; never auto-translate missing approved copy.
- Font mismatch: block or warn according to preflight; use the same pinned Roboto assets in editor and exporter.
- Export mismatch: compare canonical dimensions, renderer version and scene revision; do not rescale silently.
- Provider outage: keep edits available, mark job retryable and expose manual import/mapping paths.
- Partial series failure: isolate the card and permit export of valid cards only when the user explicitly chooses it.

## Versioning and change control

- Version the PRD, API, scene schema, validation rules, model prompts/provider models and export renderer.
- Any change to hard constraints requires PRD and acceptance updates.
- Keep migrations backward compatible or provide explicit project migration.
- Record which versions produced each export for reproducibility.

## Key assumptions

- The logo is normally bottom-right, but safe-area geometry must be configured/detected per template/card rather than guessed from page percentage.
- “Same dimension” means unchanged logical canvas and export dimensions, not merely the same aspect ratio.
- Capitalization changes are a presentation option; approved original English remains stored.
- Warnings can be acknowledged and exported; errors block export. The actual severity mapping is configurable and tested.
- V1 “Level 2” is a measurable target for representative SVG fixtures, not a promise for every possible file.

## Final delivery expected from implementation

The finished repository should include application code, database/configuration changes, fixtures, automated tests, setup/run/test documentation, architecture decisions, a supported-format matrix and an acceptance report. Sample downloadable exports should demonstrate clean SVG, Datawrapper mojibake, long-copy warning and a full series.

