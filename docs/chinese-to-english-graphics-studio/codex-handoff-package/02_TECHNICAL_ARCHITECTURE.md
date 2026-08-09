# Technical Architecture, Data Model, APIs and Modules

## 1. Architecture principles

- Canonical internal scene graph separates source, detected Chinese and generated English.
- Format adapters normalize inputs into the same model.
- Original assets and extraction evidence are immutable.
- AI proposes mappings; deterministic code enforces geometry and safety.
- Long-running parse, OCR, layout and export work runs as idempotent jobs.
- V1 may be a modular monolith, but module boundaries must survive later service extraction.

## 2. Recommended reference stack

Use the existing repository conventions if present. For a greenfield implementation: TypeScript; React/Next.js UI; Canvas/SVG editor using native SVG or a well-supported scene library; Node API; PostgreSQL; S3-compatible object storage; Redis-backed queue; isolated workers; Playwright and Vitest. Keep OCR/LLM/rendering behind provider interfaces.

This is a recommendation, not permission to replace an established stack.

## 3. System view

```text
Web client
  ├─ series/import UI
  ├─ mapping workbench
  ├─ side-by-side editor
  └─ validation/export UI
        │ REST + job events (SSE/WebSocket or polling)
API / application layer
  ├─ project & revision service
  ├─ asset service
  ├─ mapping service
  ├─ layout orchestration
  ├─ validation service
  └─ export service
        │
Workers
  ├─ SVG/PDF/raster/AI adapters
  ├─ safe renderer + OCR/vision
  ├─ semantic classifier + matcher
  ├─ deterministic layout solver
  └─ PNG/SVG/PDF exporters
        │
PostgreSQL + object storage + queue/cache
```

## 4. Canonical scene model

All coordinates use canonical canvas units. Store transforms as matrices and normalized resolved geometry. Use floating-point internally; apply deterministic export rounding.

```ts
type UUID = string;
type Format = 'svg' | 'pdf' | 'ai' | 'png' | 'jpg';
type Role = 'TITLE'|'SUBTITLE'|'BODY'|'ANNOTATION'|'DATA_LABEL'|
  'AXIS_LABEL'|'LEGEND'|'SOURCE'|'FOOTNOTE'|'CAPTION';
type Provenance = 'embedded'|'visual_ocr'|'manual'|'translation'|'generated';

interface Project { id: UUID; name: string; localeFrom: 'zh'; localeTo: 'en';
  mode: 'STRICT'|'FLEXIBLE'; revision: number; createdAt: string; updatedAt: string; }
interface Card { id: UUID; projectId: UUID; order: number; name: string;
  sourceAssetId: UUID; format: Format; canvas: CanvasSpec; importStatus: string; revision: number; }
interface CanvasSpec { width: number; height: number; viewBox?: [number,number,number,number]; unit?: string; }
interface SceneObject { id: UUID; cardId: UUID; parentId?: UUID; kind: 'text'|'path'|'image'|'group'|'protected';
  layer: 'ORIGINAL'|'CHINESE'|'ENGLISH'|'GUIDE'; zIndex: number; transform: number[];
  bounds: Rect; locked: boolean; sourceRef?: string; }
interface TextObject extends SceneObject { kind: 'text'; role: Role; content: string;
  approvedContent?: string; provenance: Provenance; confidence?: number;
  style: TextStyle; geometry: TextGeometry; relation?: ChartRelation; }
interface TextStyle { family: string; weight: number; size: number; lineHeight: number;
  letterSpacing: number; align: 'left'|'center'|'right'; fill: string; rotation: number; }
interface TextGeometry { x:number; y:number; width:number; height:number; anchorX:number; anchorY:number; }
interface Mapping { id: UUID; projectId: UUID; chineseObjectIds: UUID[];
  segmentIds: UUID[]; status: 'proposed'|'confirmed'|'ambiguous'|'unmapped';
  confidence: number; rationaleCodes: string[]; manuallyEdited: boolean; }
interface TranslationSegment { id: UUID; scope: 'series'|'card'; cardHint?: UUID;
  order: number; approvedText: string; displayText: string; sourceRange?: [number,number]; }
interface ProtectedArea { id: UUID; cardId: UUID; type: 'LOGO_SAFE_AREA'|'VISUAL';
  geometry: Rect|Polygon; padding: number; locked: true; }
interface ValidationIssue { id: UUID; cardId: UUID; objectIds: UUID[]; rule: string;
  severity: 'warning'|'error'; message: string; suggestion?: string;
  status: 'open'|'acknowledged'|'resolved'; revision: number; }
interface Operation { id: UUID; projectId: UUID; cardId?: UUID; type: string;
  beforeRevision: number; afterRevision: number; payload: unknown; createdAt: string; }
```

Store extraction candidates separately so changing a selected candidate does not destroy evidence:

```ts
interface TextCandidate { id: UUID; objectId: UUID; text: string; provenance: Provenance;
  confidence: number; scriptScore?: number; encodingFlags: string[]; bounds: Rect; engineVersion: string; }
```

## 5. Import pipeline

### Common stages

`upload → MIME/signature validation → quarantine → sanitize/normalize → parse → safe render → detect text → reconcile → classify → build scene → validate import → ready/review`

### SVG adapter

- Parse XML without executing it.
- Remove scripts, event attributes, foreignObject by policy, unsafe links, external resource loads and CSS escape paths.
- Resolve inherited styles, nested transforms, tspans, text anchors, clipping and viewBox.
- Preserve a sanitized source copy plus normalized scene objects.
- Render in an isolated process with network disabled.
- OCR rendered text regions and reconcile candidates.

Reconciliation signals include: valid Han/Latin script ratio, replacement/mojibake characters, glyph/text bounding-box overlap, normalized edit similarity, OCR confidence, semantic plausibility and provider fingerprints. A score threshold selects embedded or OCR; close scores become review-required. Geometry remains SVG-derived whenever trustworthy.

### Other adapters

- PDF: group glyphs/runs into lines and boxes, render pages, reconcile with OCR.
- AI: either an explicitly supported conversion service or a clear “export SVG first” path; never pretend generic native parsing is reliable.
- PNG/JPG: OCR/vision creates reconstructed text objects over an immutable background; confidence and fidelity warnings are mandatory.

## 6. Mapping engine

1. Segment paste while preserving exact source ranges.
2. Create features from card order, object order, role, Chinese content/length, grouping and neighborhood.
3. Ask the model/provider for structured candidate mappings only.
4. Validate the returned schema and object/segment IDs.
5. Solve assignment constraints; detect omissions, duplicates and many-to-many mappings.
6. Persist proposal with confidence and rationale.
7. Require review below configurable thresholds.

The model may not invent replacement copy. `approvedText` is immutable unless a user edits it; `displayText` may differ only by allowed capitalization/whitespace presentation and must remain traceable.

## 7. Layout engine

Text measurement must use the exact Roboto font files and export renderer. For each object, generate candidates (line breaks, width/height, size, position) and score them.

Hard constraints:

```text
inside(canvas, bounds)
intersection(bounds, logoSafeArea) = 0
fontSize >= max(roleMinimum, chineseFontSize * 0.8)
intersection(bounds, lockedProtectedGeometry) = 0
```

Strict fixes x/y/anchor except for rounding and follows the PRD priority. Flexible adds bounded displacement and size candidates with role-specific penalties. DATA_LABEL and AXIS_LABEL receive very high displacement penalties. Use deterministic tie-breaking and store solver inputs/version/output.

Collision calculations should use oriented bounds or glyph outlines for rotated text when needed; broad-phase spatial indexing can use axis-aligned bounds. Never accept a solver output without running the independent validator.

## 8. Validation rules

Define a versioned rule interface:

```ts
interface Rule { id: string; version: string;
  evaluate(ctx: ValidationContext): ValidationIssue[]; }
```

Required rules: `CANVAS_BOUNDARY`, `TEXT_OVERLAP`, `LOGO_SAFE_AREA`, `PROTECTED_VISUAL_COLLISION`, `MIN_FONT_SIZE`, `MAX_SHRINK`, `MISSING_MAPPING`, `DUPLICATE_SEGMENT`, `MISSING_FONT`, `INVALID_OBJECT`, `EXPORT_DIMENSION`. Run incrementally for interactive edits and fully for preflight.

## 9. API design

Use `/api/v1`; accept idempotency keys for mutating job starts and optimistic concurrency via `If-Match`/revision.

```text
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
POST   /projects/:id/cards/uploads        -> signed upload + card shell
POST   /cards/:id/import-jobs              -> 202 Job
GET    /jobs/:id
GET    /projects/:id/events                -> progress stream/poll alternative
POST   /projects/:id/translations          -> paste + segmentation
POST   /projects/:id/mapping-jobs
GET    /projects/:id/mappings
PATCH  /mappings/:id
POST   /mappings/actions                   -> merge/split/assign/rematch
POST   /projects/:id/layout-jobs           -> scope, mode
PATCH  /cards/:id/objects/:objectId         -> content/style/geometry
POST   /projects/:id/operations/undo
POST   /projects/:id/operations/redo
POST   /cards/:id/reset-object
POST   /cards/:id/reset-card
POST   /projects/:id/validation-jobs
GET    /projects/:id/issues
PATCH  /issues/:id                         -> acknowledge/resolve
POST   /projects/:id/export-jobs            -> scope + format + options
GET    /exports/:id                         -> status + signed download
```

Example job response:

```json
{"jobId":"...","status":"queued","projectRevision":12,"links":{"self":"/api/v1/jobs/..."}}
```

Return typed error codes such as `UNSAFE_SVG`, `UNSUPPORTED_FORMAT`, `REVISION_CONFLICT`, `IMPORT_REVIEW_REQUIRED`, `EXPORT_BLOCKED` and `PROVIDER_UNAVAILABLE`.

## 10. Front-end modules

- `SeriesManager`: upload, reorder, statuses.
- `ImportReview`: candidates, source/provenance and region correction.
- `TranslationPaste`: scope and segmentation preview.
- `MappingWorkbench`: table, confidence, merge/split and assignment.
- `DualCanvasWorkspace`: synchronized zoom/pan, layer toggles and selection.
- `EnglishEditor`: text/style/geometry controls and keyboard behavior.
- `HistoryController`: undo/redo/reset.
- `ValidationPanel`: grouped issues, canvas focus and acknowledgements.
- `ExportDialog`: scope, format, preflight and progress.

## 11. Persistence, revisions and observability

- Store assets/exports in object storage; metadata and revisions in the database.
- Use immutable card snapshots or operation log plus periodic snapshots.
- Every worker records job ID, input revision, engine/model versions, duration and outcome.
- Metrics: parse success by format/provider, detection reconciliation rates, mapping confidence/corrections, layout pass rate, issue types, manual edits and export success.
- Never log raw translation or graphic content by default.

## 12. Testing strategy

- Unit: transforms, text measurement, segmentation, constraints and rules.
- Golden fixtures: sanitized SVG scene extraction and deterministic exports.
- Contract: provider adapters and structured model output.
- Integration: upload through export, retries and revision conflicts.
- Visual regression: editor and rendered exports at exact dimensions.
- Security: malicious SVG corpus, oversized files, external resource attempts and formula/XML edge cases.
- E2E: single card, series, mojibake Datawrapper SVG, outlined text and warning acknowledgement.

