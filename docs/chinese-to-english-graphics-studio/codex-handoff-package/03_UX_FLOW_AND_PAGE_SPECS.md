# UX Flow and Page Specifications

## 1. Information architecture

```text
Projects / Recent work
  └─ Series workspace
      ├─ Import
      ├─ Translation & mapping
      ├─ Edit & compare
      ├─ Layout check
      └─ Export
```

V1 may open directly into a new series workspace if accounts/project listing are out of scope.

## 2. End-to-end flow

### Happy path

New series → drop 1..N SVGs → import completes → paste full-series English → Auto Match → review proposed mapping → Generate English → Strict layout → side-by-side review → all checks pass → export series ZIP.

### Exception path

Import flags corrupt/outlined text → user reviews visual OCR candidates → mapping has ambiguous segments → user assigns/merges → layout warns on long title → user switches to Flexible or edits box → acknowledges remaining warning → exports.

## 3. Global shell

- Top bar: project name, saved state, undo, redo, mode selector, Run Check, Export.
- Card strip: thumbnails, card number/name, status/severity badge, add/reorder/remove.
- Main area changes by workflow stage but preserves card selection.
- Jobs show progress without blocking navigation; destructive resets/removal require confirmation.

## 4. Screen specifications

### A. New series / upload

Primary drop zone: “Drop SVG, PDF, AI, PNG or JPG.” Supporting text: “Best results: SVG with editable text.” Format badges must reflect actual enabled maturity; disabled adapters explain the SVG conversion route.

Controls: project name, file picker, add more, reorder, continue. Each card shows thumbnail, filename, format, dimensions, import status and actionable error.

States:

- Empty: concise input guidance.
- Uploading/parsing/rendering/checking text: stage and progress.
- Needs review: number of uncertain text regions.
- Failed: reason, retry and replace.
- Unsafe: rejected with no preview execution.

### B. Import review

Left: rendered original with uncertain regions outlined. Right: selected region details showing embedded candidate, visually detected candidate, confidence/provenance and geometry preview.

Actions: choose candidate, manually correct Chinese, mark non-text, change semantic role, split/merge region. “Accept all high-confidence” must never accept ambiguous candidates.

### C. Translation paste

Default scope is Entire Series; alternative is Current Card. Large paste area preserves pasted copy. Show segmentation preview before Auto Match, with detected segment count and card hints if headings exist.

Warnings: copy appears incomplete, duplicate segment, unsupported formatting or empty card. Do not auto-translate missing copy.

### D. Mapping workbench

Table columns: card, Chinese object(s), role, English segment(s), confidence/status, actions. Selecting a row highlights the Chinese region and proposed English placement.

Actions: confirm, edit approved English, assign/unassign, reorder, merge, split and rematch. Filters: ambiguous, unmapped, unconfirmed, card, role. Generate is disabled for blocking unmapped required objects unless the user explicitly marks them intentionally untranslated.

### E. Side-by-side editor (primary workspace)

```text
┌──────────────────────────────────────────────────────────────┐
│ Project   Saved   Undo Redo   Strict ▾   Check   Export      │
├──────────────────────────────────────────────────────────────┤
│ [01 ✓] [02 ⚠] [03 …] [+ Add]                                │
├───────────────────────┬───────────────────────┬──────────────┤
│ CHINESE ORIGINAL      │ ENGLISH               │ INSPECTOR    │
│ immutable/reference   │ selectable/editable   │ Text/Layout  │
│                       │                       │ Issues       │
└───────────────────────┴───────────────────────┴──────────────┘
```

The canvases share zoom and optional synchronized pan. Chinese is read-only. English selection shows handles and exact bounding box. Layer toggles allow Chinese/English/Guides; default comparison remains side by side.

Inspector fields: text, Roboto weight, size, line height, letter spacing, alignment, x/y/w/h, rotation, role and mapping link. Numeric fields support keyboard nudging. Reset Position and Reset Card are visually distinct from ordinary editing.

Canvas interactions: select, multi-select if supported, drag, resize, double-click/edit text, arrow-key nudge and Escape to end editing. Snap guides may be offered but cannot pull text into protected areas. Logo safe area is visibly hatched only as an editing guide and is never exported.

### F. Validation panel

Summary: pass count, warnings, errors and last-checked revision. Group by card and severity. Each issue includes rule, object/role, plain-language problem and suggested fix. Clicking it selects and zooms to the object.

Statuses: open, resolved automatically after change, acknowledged. Export button explains whether a blocking error or acknowledged warning remains.

### G. Export dialog

Choose Current Card or Entire Series; PNG, SVG or PDF; PNG scale; optional bilingual/layer-preserving SVG; naming preview. Preflight summary appears before confirmation.

For series: ZIP for PNG/SVG and option for multi-page PDF if supported. On completion show filename(s), dimensions and download action. On failure retain the project and allow retry.

## 5. Strict/Flexible behavior in UI

- Default to Strict for a new project.
- Switching modes previews/recomputes English layout but never changes the Chinese original.
- If manual changes would be overwritten, explain and offer to apply only to unedited objects or regenerate all.
- Show why Flexible moved an object when selected (for example, “moved 8 px to avoid legend”).

## 6. Feedback and copy

Use direct production language:

- “2 text regions need review.”
- “English title cannot fit without shrinking below 80% of the Chinese size.”
- “Card 3 · Data label overlaps the chart.”
- “The SVG contains unsafe active content and was not imported.”
- “Third-party English is preserved; only line breaks and display capitalization may change.”

Never show a generic “AI error” when a stage/provider can be named.

## 7. Responsive and accessibility requirements

- Desktop-first; supported working viewport starts at 1280×720. At narrower sizes use tabs between canvases but retain a compare action.
- Full keyboard reachability for controls and mapping table.
- Visible focus, minimum target sizes, semantic labels and announcements for job/validation changes.
- Severity uses icon + text, not color alone.
- Canvas objects have an accessible list/tree alternative with role and content.
- Respect reduced motion and browser zoom.

## 8. Empty, loading and failure states

Every asynchronous stage must support queued, running, partial success, retryable failure and terminal failure. A failure on one card must not discard completed cards. The editor should remain usable offline only for already loaded state; do not promise full offline behavior in V1.

