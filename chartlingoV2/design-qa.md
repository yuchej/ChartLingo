**Design QA**

- Source visual truth: `/Users/yuchen@sphnet.com.sg/.codex/generated_images/019fefa0-f5ef-7552-b062-83220f1c0ed4/exec-546c809d-dd50-4d60-a94e-06a124f6d871.png`
- Browser-rendered implementation: `/private/tmp/chartlingo-editor-light.png`
- Viewport: `1440 × 1000` CSS px, device scale factor `1`
- Source pixels: `1484 × 1060`
- Implementation pixels: `1440 × 1082`
- Density normalization: both images reviewed at 1×; the comparison focused on the editor chrome and panel proportions rather than chart content because the source mock and test package intentionally contain different graphics.
- State: English editing mode, one text item selected, Character tab active, 70% canvas zoom, partial fill and stroke applied.

**Full-view comparison evidence**

- The implementation preserves the source composition: dark product header, compact editing toolbar, large light canvas on the left, and a fixed contextual properties panel on the right.
- The visible Back/Undo/Redo controls, simple percentage zoom selector, reference toggle, Character/Paragraph/Appearance tabs, blue transform selection, and sticky Apply/Remove/Reset actions match the approved light-mode direction.
- The inspector remains denser than the conceptual mock so existing ChartLingo controls remain available without losing functionality; this is an intentional product constraint, not a fidelity defect.

**Focused region comparison evidence**

- Highlight controls were reviewed at readable size. Fill uses the requested `#e90044`; Stroke defaults to a diagonal-slash “None” state and reveals independent stroke color/width controls only when enabled.
- Typography, paragraph alignment, transform, and appearance controls use consistent light borders, compact labels, and blue active states.
- No substitute logos, decorative image assets, or non-standard icons were introduced.

**Required fidelity surfaces**

- Fonts and typography: Roboto UI typography, compact labels, clear section hierarchy, and readable weights match the intended Illustrator-inspired density.
- Spacing and layout rhythm: panel width, toolbar height, section dividers, grid spacing, and footer actions are consistent and do not obscure the canvas.
- Colors and visual tokens: navy product header, neutral light surfaces, Adobe-like blue selection/active states, and the requested red highlight token are consistent.
- Image quality and asset fidelity: the chart remains SVG-based and crisp; the selected object outline and handles are vector UI.
- Copy and content: Character, Paragraph, Appearance, Highlight, Transform, Apply, Remove text, Reset, Back, Undo, Redo, and Show Chinese reference are present and correctly grouped.

**Findings**

- No actionable P0/P1/P2 visual mismatches remain for the approved editor redesign.

**Comparison history**

1. Initial browser capture showed the global import/export toolbar while editing and lacked the mock's visible Back action.
2. Fixed by hiding the global action group in editing mode and restoring a visible Back button in the editor toolbar.
3. Post-fix capture confirms the editor now has the intended focused toolbar and a clear return path.

**Primary interactions tested**

- Open a real `.chartlingo` package and CH/EN CSV.
- Generate English and enter editing mode.
- Select and edit a text object.
- Change zoom to 70%.
- Apply partial fill and text stroke.
- Undo and redo the character-level edit.
- Open the Appearance tab and return to Character.
- Verify transform handles and one-item alignment controls.
- Verify SVG, PNG, and JPG exports remain enabled.
- Apply changes and return to the gallery.
- Browser console errors checked: none.

**Follow-up polish**

- The specific legacy sample package used for QA contains some pre-existing chart-label collisions. Those belong to chart-generation/layout logic rather than this editor-interface redesign.

**Implementation Checklist**

- [x] Light contextual editor layout
- [x] Character/Paragraph/Appearance navigation
- [x] Percentage zoom control
- [x] Fill and optional stroke controls
- [x] Existing edit, transform, history, and export behavior preserved
- [x] Browser-rendered regression test added

final result: passed
