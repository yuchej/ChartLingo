# ChartLingo acceptance report — vertical slice 0.1

Date: 2026-08-09

This report records verified behavior rather than declaring the full V1 release-ready.

## Evidence

- Browser smoke journey passed: application booted; two SVG cards imported in order at `800×450` and `600×400`; approved English generated; Strict validation surfaced a named `CANVAS_BOUNDARY` error containing the card and object ID; browser console had zero warnings/errors.
- Upload regression on 2026-08-09 passed: classic-script loading removes the direct-file ES-module blocker; the served regression imported F01 and announced `1 card imported successfully.` with zero browser warnings/errors. Importing, success, partial failure, per-card error, repeat selection, and drag/drop states are implemented.
- Structured translation regression on 2026-08-09 passed: the synthetic `CH,EN` CSV parsed 12 pairs, exact matches generated source-of-truth English for F01, the mapping table displayed method/confidence, coverage and unused counts updated across the locally persisted series, and the browser console had zero warnings/errors.
- Explicit generation UX regression on 2026-08-09 passed: the Paste Full Translation section was absent; uploading the CSV left zero English objects visible; `Generate English Chart` was enabled only with graphic and translation inputs available; clicking it created three editable English objects on the active fixture and announced the series coverage. Browser console had zero warnings/errors.
- Actual outlined-Illustrator regression on 2026-08-09 passed: `test.svg` was confirmed to contain 394 paths and no live `<text>` or Unicode metadata. Audited local visual evidence recovered nine visible occurrences representing seven unique Chinese entries; these matched the CSV CH values and generated nine editable English objects while retaining the chart structure. Browser console had zero warnings/errors. Other unknown outlined SVGs remain blocked unless an OCR provider or audited fixture supplies visual evidence.
- Direct-canvas layout regression on 2026-08-09 passed: a fresh load contained zero preloaded cards; the actual SVG/CSV journey generated 13 wrapped `<tspan>` lines from nine English objects. Pointer-drag persists x/y through the same revision/history path; content editing remains in Inspector. Browser console had zero warnings/errors.
- English-only outlined-chart regression on 2026-08-09 passed: the English canvas removed 51 path/polygon nodes identified geometrically inside verified Chinese regions; zero background-mask rectangles were present. Selecting English displayed one draggable dashed box, zero inline editors, and Inspector contained zero X/Y inputs. Content remains editable through Inspector. Browser console had zero warnings/errors.
- Static acceptance suite exists at `tests/test_acceptance.py`. Its intended command is `python3 -m unittest discover -s tests -v`, but the host Python launcher is blocked because Xcode Command Line Tools are not installed. No test-pass claim is made for that suite.
- Fixtures are synthetic and rights-cleared.

## Acceptance matrix

| ID | Status | Actual evidence / gap |
|---|---|---|
| AC-001 | Partial | Multi-SVG import and order verified; drag reorder UI pending. |
| AC-002 | Partial | Exact width/height/viewBox captured and emitted by all exporters; reimport and binary output inspection pending. |
| AC-003 | Pass (slice) | Immutable source/sanitized source retained; distinct Chinese/English groups and toggle-ready layers. |
| AC-004 | Partial | Sanitizer removes scripts, event attributes, foreignObject, active/external URLs; malicious browser corpus execution test pending. |
| AC-005 | Fail/incomplete | Text/tspan content captured; full nested transform/style/anchor world-geometry normalization pending. |
| AC-006 | Pass (fixture contract) | Mojibake heuristic selects `data-visual-text` fake OCR with SVG bounds and retains both candidates/provenance. |
| AC-007 | Fail/incomplete | Adapter boundary exists; outlined-region reconstruction/review UI pending. |
| AC-008 | Partial | Approved strings preserved line-for-line; Current Card works; Entire Series segmentation/application pending. |
| AC-009 | Partial | Unmapped detection works; manual assign/unassign/merge/split/rematch UI pending. |
| AC-010 | Partial | Text, role, size and x/y/w/h edit and persist locally; rotation, weight, line-height, spacing and full reload test pending. |
| AC-011 | Partial | Roboto is the English default; exact pinned font embedding/measurement pending and missing-font warning is emitted. |
| AC-012 | Partial | Strict keeps non-text visual source immutable and uses size/box candidates; formal priority trace pending. |
| AC-013 | Partial | Flexible displacement is bounded by role and revalidated; broader candidate solver evidence pending. |
| AC-014 | Pass (core rule) | `max(roleMinimum, chineseSize × 0.8)` floor enforced and independently validated. |
| AC-015 | Partial | Boundary, overlap, logo, minimum-size, mapping and font rules identify card/object; oriented/protected-chart geometry pending. |
| AC-016 | Partial | Detected logo geometry and padding are immutable and checked; exported-geometry golden comparison pending. |
| AC-017 | Partial | Text/geometry undo/redo and Reset Position exist; mapping history and Reset Card pending. |
| AC-018 | Pass (slice) | Side-by-side corresponding original/English canvases verified in browser. |
| AC-019 | Fail/incomplete | Current-card SVG/PNG/experimental PDF implemented; series ZIP and multi-page PDF pending. |
| AC-020 | Partial | SVG emits editable English `<text>` and approved strings; escape/Unicode golden test pending. |
| AC-021 | Pass (slice) | Errors block; warnings require explicit acknowledgement. |
| AC-022 | Partial | Per-file exception isolation implemented; malformed-card browser scenario pending. |
| AC-023 | Fail/incomplete | Local autosave/revision display works; concurrency/idempotent retry semantics pending. |
| AC-024 | Partial | Semantic controls/labels and non-color issue text exist; complete keyboard and zoom audit pending. |
| AC-025 | Pass | Non-SVG imports disabled with actionable guidance and honest format matrix. |

## Structured translation-file extension

- CSV/TXT with mandatory `CH` and `EN` headers: implemented. Quoted CSV fields, including `"S$30,000"`, are preserved.
- Matching order: exact, Unicode/punctuation/whitespace-normalized exact, then deterministic fuzzy suggestion. Unmatched/low-confidence rows require review. The external AI provider stage remains an interface-level future fallback and is not falsely invoked.
- Mapping UI: method, confidence, manual pair selection/search, confirmation, unlink and English editing are implemented. Merge/split of detected boxes remains incomplete.
- Series-wide dictionary reuse, repeated phrases, unused entries, unmatched/low-confidence counts and export acknowledgement are implemented.
- XLSX remains disabled and clearly labeled.

## Release decision

Not release-ready. This is a working SVG-first vertical slice and architecture baseline. P0 failures/incomplete items—especially AC-005, AC-009, AC-019 and AC-023—remain explicit gates. PDF export remains experimental; PNG/PDF have not passed visual acceptance and must not be presented as mature production support.
