# ChartLingo — Codex Handoff Package

This folder is the implementation brief for a web tool that turns Chinese charts and infographics into editable English versions while preserving the original canvas and visual structure.

## Start here

1. Give Codex the entire folder.
2. Open `04_CODEX_MASTER_PROMPT.md` and use it as the first implementation prompt.
3. Treat `01_PRD.md` as the product source of truth and `06_ACCEPTANCE_AND_QA.md` as the release gate.
4. Resolve contradictions in this order: PRD → acceptance criteria → architecture → UX → implementation plan → prompt.

## Package contents

| File | Purpose |
|---|---|
| `01_PRD.md` | Complete product requirements, scope, rules and roadmap |
| `02_TECHNICAL_ARCHITECTURE.md` | Architecture, data model, APIs, pipelines and modules |
| `03_UX_FLOW_AND_PAGE_SPECS.md` | User flows, screens, states and editor behavior |
| `04_CODEX_MASTER_PROMPT.md` | Ready-to-paste build prompt for Codex |
| `05_IMPLEMENTATION_PLAN.md` | Phases, tasks, dependencies and deliverables |
| `06_ACCEPTANCE_AND_QA.md` | Acceptance criteria and detailed QA cases |
| `07_DELIVERY_GUIDE.md` | Assumptions, handoff procedure and operating notes |

## Frozen product decisions

- Third-party English copy is the content source of truth, including numbers, units, currency and percentages.
- SVG is the preferred input. V1 is SVG-first and targets Level 2 quality; the architecture must support later PDF, AI, PNG and JPG adapters and Level 3 automation.
- Preserve Chinese and English as separate toggleable layers. English text remains editable.
- The original canvas dimensions never change.
- Non-text visual structure stays fixed by default. The bottom-right logo bug and its padded safe area are protected in every mode.
- Roboto is the default English font.
- Smart Paste supports one card or a complete series; a mapping table provides manual fallback.
- Strict and Flexible layout modes share hard safety constraints.
- English may shrink to no less than 80% of its mapped Chinese size. If it still does not fit, warn; never silently break a hard constraint.
- Export current card or full series as PNG, SVG or PDF. SVG must retain editable English text.

## Suggested repository placement

Copy this folder to `docs/product/graphics-localization/`. Keep fixtures under `test/fixtures/graphics-localization/` and do not commit proprietary newsroom source files.

