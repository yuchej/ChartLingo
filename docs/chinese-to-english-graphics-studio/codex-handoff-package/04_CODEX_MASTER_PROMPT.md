# Codex Master Prompt

Copy the prompt below into Codex together with this entire documentation folder.

---

You are implementing **ChartLingo**, a web tool for newsroom graphics localization. Read every file in this handoff folder before changing code. Treat `01_PRD.md` as the product source of truth and `06_ACCEPTANCE_AND_QA.md` as the release gate. If the repository contains `AGENTS.md` or project instructions, follow them too.

Your goal is a working, tested V1 at Level 2 quality, focused on SVG. Users upload one graphic or a series, paste approved third-party English, auto-match it to detected Chinese text, generate a separately editable Roboto English layer, validate layout, review Chinese and English side by side, and export at the original dimensions.

Non-negotiable rules:

1. Preserve original canvas width/height/viewBox exactly.
2. Preserve immutable original/Chinese content and create a separate English layer.
3. Third-party English is the source of truth, including wording, numbers, units, currency and percentages. Never silently translate, paraphrase, omit or duplicate it.
4. The bottom-right logo bug and padded safe area are protected in Strict and Flexible modes.
5. Keep non-text visual geometry unchanged.
6. English uses Roboto and stays editable, including data labels.
7. English font size may not go below 80% of the mapped Chinese size or the role minimum. If it still does not fit, create a visible issue.
8. Strict and Flexible modes must use deterministic hard-constraint validation.
9. Datawrapper SVG import uses hybrid detection: structural SVG geometry plus rendered visual verification. If embedded text is corrupt, use visually recognized content while retaining trustworthy SVG geometry and provenance.
10. Sanitize untrusted SVG before preview/rendering. Never execute scripts or fetch uncontrolled external resources.
11. Do not claim mature PDF/AI/PNG/JPG support unless the adapter and its acceptance tests pass. Provide clean adapter interfaces and honest UI labels.
12. SVG export must retain editable English text where technically possible; PNG/SVG/PDF export must preserve dimensions.

Implementation workflow:

- First inspect the repository, current stack, tests and conventions. Do not replace an established architecture unnecessarily.
- Produce a short implementation plan mapped to `05_IMPLEMENTATION_PLAN.md` and identify assumptions/open decisions.
- Build vertical slices, starting with safe SVG upload/import and canonical scene representation, then editor/mapping/layout/validation/export.
- Keep OCR, LLM matching, rendering and storage behind interfaces with deterministic local fakes so core tests do not require network credentials.
- Use an immutable source asset, versioned project/card revisions, autosave and undo/redo/reset semantics.
- Build fixtures for: clean editable SVG, nested transforms/tspans, Datawrapper mojibake, outlined text, long English, logo collision, rotated label, malicious SVG and a 5-card series.
- Add unit, integration, visual and E2E tests. Run the relevant checks after each slice.
- Make no external deployment, paid-provider call, secret configuration or destructive repository action without explicit authorization.

Required V1 user journey:

`upload 1..N SVG → parse/render/reconcile → review uncertain text → paste whole-series or card English → auto-match → manually fix mapping → generate English → Strict/Flexible layout → side-by-side edit → validate → export current/series PNG/SVG/PDF`

Required deliverables:

- Working application and migrations/configuration.
- Provider interfaces plus local deterministic implementations.
- Documented canonical scene model and API contracts.
- Versioned layout validation rules.
- Secure SVG sanitation and isolated rendering path.
- Fixture corpus and automated tests tied to acceptance IDs.
- README with setup, run, test, known limitations and provider configuration.
- Final report listing implemented acceptance criteria, commands/tests run, remaining gaps and screenshots/artifacts where appropriate.

When a requirement cannot be completed, do not silently weaken it. Keep the interface honest, document the gap by acceptance ID, and leave the repository in a working state. Begin by reading the repository and the seven handoff documents, then report your plan before implementation.

