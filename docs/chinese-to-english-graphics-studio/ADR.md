# Architecture decision record

## ADR-001 — Canonical scene and immutable input

Accepted. A serializable project/card/scene model is the boundary between adapters and the editor. Each card retains its original source and sanitized immutable source. Chinese and English objects are distinct.

## ADR-002 — Browser-native editor shell for the local slice

Accepted with migration note. Native SVG provides exact viewBox behavior, editable text and safe DOM construction with no runtime dependency. UI modules do not own parsing, mapping, layout or validation logic. A later React/Next.js shell can call the same contracts.

## ADR-003 — Local revisioned persistence and jobs

Accepted for the local V1. Project state is revisioned and autosaved to localStorage. Imports/exports use deterministic job-like states. PostgreSQL/object storage/Redis are deferred until deployment requirements exist.

## ADR-004 — Provider isolation

Accepted. OCR and mapping are interfaces. Local deterministic providers are the default and only configured providers. External calls require a separate data-flow and credential decision.

## ADR-005 — Font and export strategy

Accepted with release caveat. English objects use `Roboto, Arial, sans-serif`; SVG remains editable. Canvas creates PNG at logical size. A minimal vector PDF preserves the page box and English text. Roboto embedding, cross-browser render goldens and multi-page PDF remain release-gate gaps.
