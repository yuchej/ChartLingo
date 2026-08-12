import json, pathlib, re, unittest

ROOT = pathlib.Path(__file__).parents[1]
FIX = ROOT / "test/fixtures/graphics-localization"

class AcceptanceSmokeTests(unittest.TestCase):
    def test_ac001_fixture_series_and_order(self):
        names = ["F01-clean.svg", "F02-nested-tspans.svg", "F03-datawrapper-mojibake.svg", "F05-long-title.svg", "F10-malicious.svg"]
        self.assertEqual(names, [p.name for p in map(FIX.__truediv__, names)])

    def test_ac002_dimensions_are_literal_in_exporter(self):
        src = (ROOT / "src/exporters.js").read_text()
        self.assertIn('width="${c.width}" height="${c.height}" viewBox="${vb}"', src)
        self.assertIn('/MediaBox [0 0 ${card.canvas.width} ${card.canvas.height}]', src)

    def test_png_export_uses_standalone_edited_svg_pipeline(self):
        src = (ROOT / "src/exporters.js").read_text()
        app = (ROOT / "src/app.js").read_text()
        for token in ("createStandaloneExportSvg", "document.fonts.ready", "inlineExportImages", "XMLSerializer", "DOMParser", "URL.createObjectURL(blob)", "canvas.toBlob", "PNG_SVG_SERIALIZATION_FAILED", "PNG_EXTERNAL_ASSET_FAILED"):
            self.assertIn(token, src)
        for token in ("http://www.w3.org/2000/xmlns/", "http://ns.adobe.com/AdobeIllustrator/10.0/", "urn:chartlingo:source-namespace:"):
            self.assertIn(token, src)
        self.assertIn(".selection-box,.source-selection,.export-exclude", src)
        self.assertNotIn("querySelectorAll(':scope > rect')", src)
        self.assertIn("pngExportMessage(error)", app)
        self.assertNotIn("Please check the SVG and try again", app)
        self.assertIn("a.download=name", src)
        self.assertIn("document.body.append(a);a.click()", src)
        self.assertIn("targetWidth=1200", src)
        self.assertIn("height*(pixelWidth/width)", src)

    def test_ac003_separate_layers_and_editable_svg(self):
        src = (ROOT / "src/exporters.js").read_text()
        self.assertIn('id="original" visibility="hidden"', src)
        self.assertIn('id="english"', src)
        self.assertIn('<text data-chartlingo-id=', src)

    def test_ac004_sanitizer_covers_active_content(self):
        src = (ROOT / "src/core.js").read_text()
        for token in ('script,foreignObject,iframe,object,embed', 'ACTIVE_ATTR', 'UNSAFE_URL', "url\\s*"):
            self.assertIn(token, src)

    def test_ac006_deterministic_visual_candidate(self):
        fixture = (FIX / "F03-datawrapper-mojibake.svg").read_text()
        self.assertIn('data-visual-text="消费价格指数"', fixture)
        src = (ROOT / "src/core.js").read_text()
        self.assertIn("useVisual?'visual_ocr'", src)
        self.assertIn('candidates:', src)

    def test_ac008_approved_copy_is_not_rewritten(self):
        src = (ROOT / "src/core.js").read_text()
        self.assertIn('approvedText:s,displayText:s', src)
        self.assertNotIn('translate(', src)

    def test_ac014_shrink_floor_and_ac015_rules(self):
        src = (ROOT / "src/core.js").read_text()
        self.assertIn('roleTypography', (ROOT / "config.js").read_text())
        self.assertIn('absoluteMinimum', (ROOT / "config.js").read_text())
        self.assertIn('fontFloor(o)', src)
        for rule in ('CANVAS_BOUNDARY','MAX_SHRINK','LOGO_SAFE_AREA','TEXT_OVERLAP','REGION_BOUNDARY','PLOT_BOUNDARY','MISSING_MAPPING','MISSING_FONT'):
            self.assertIn(rule, src)

    def test_horizontal_bar_regression_uses_anchor_regions_and_real_measurement(self):
        fixture = (FIX / "F11-horizontal-bar-regression.svg").read_text()
        translations = (FIX / "translations-horizontal-bar.csv").read_text()
        core = (ROOT / "src/core.js").read_text()
        app = (ROOT / "src/app.js").read_text()
        self.assertIn('text-anchor="end"', fixture)
        self.assertIn('Public health, prevention and personalized medicine', translations)
        for token in ('originalX','originalY','originalWidth','originalHeight','originalFontSize','originalLineHeight','inferLayoutRegions','semanticWrap','measureText','roleTypography','roleGroup'):
            self.assertIn(token, core + app + (ROOT / "config.js").read_text())
        self.assertIn('getBBox()', app)
        self.assertIn("'TEXT_OVERLAP','error'", core)

    def test_editorial_typography_groups_and_hierarchy(self):
        config = (ROOT / "config.js").read_text()
        core = (ROOT / "src/core.js").read_text()
        for token in ("TITLE:{fontSize:13.5", "CHART_LABEL:{fontSize:8", "DATA_LABEL:{fontSize:7", "SOURCE:{fontSize:9", "FOOTNOTE:{fontSize:9", "typographyReferenceWidth: 670"):
            self.assertIn(token, config)
        for token in ("chart-1-category-labels", "chart-1-values", "canonicalFontSize", "ROLE_GROUP_SIZE", "ROLE_GROUP_ALIGNMENT", "ROLE_GROUP_LINE_HEIGHT", "TYPOGRAPHY_HIERARCHY", "ROW_CORRESPONDENCE"):
            self.assertIn(token, core)

    def test_title_and_footer_responsive_fitting_rules(self):
        config = (ROOT / "config.js").read_text()
        core = (ROOT / "src/core.js").read_text()
        for token in ("twoLineScale:.85", "maxLines:2", "twoLineHeight:1.075", "nowrap:true"):
            self.assertIn(token, config)
        for token in ("fitRoleGroup", "TITLE_MAX_LINES", "TITLE_TWO_LINE_SCALE", "FOOTER_SINGLE_LINE", "FOOTER_MIN_SIZE"):
            self.assertIn(token, core)

    def test_large_svg_mapping_actions_do_not_persist_undo_history(self):
        app = (ROOT / "src/app.js").read_text()
        self.assertIn("const {history,future,...persisted}=state", app)
        self.assertIn("JSON.stringify(persisted)", app)
        self.assertIn('type="button" data-action="use-chinese"', app)

    def test_ac025_honest_format_labels(self):
        ui = (ROOT / "index.html").read_text()
        self.assertIn('SVG and text-preserving PDF import are enabled', ui)
        self.assertIn('application/pdf,.pdf', ui)
        matrix = (ROOT / "docs/chinese-to-english-graphics-studio/SUPPORTED_FORMATS.md").read_text()
        self.assertRegex(matrix, r'AI \| Disabled \| Disabled')

    def test_text_preserving_pdf_import_pipeline(self):
        src = (ROOT / "src/pdf-import.js").read_text()
        app = (ROOT / "src/app.js").read_text()
        for token in ("getDocument", "getTextContent", "page.render", "pdf_text", "PDF_NO_SELECTABLE_TEXT", "pdf-text-mask", "pdf.worker.min.mjs", "mergePdfTextLines", "hasEOL"):
            self.assertIn(token, src + app)
        self.assertIn("document.currentScript.src", src)
        self.assertNotIn("import('/src/", src)
        self.assertIn("parsePdfFile(file)", app)
        self.assertIn("maxPdfPages", (ROOT / "config.js").read_text())

    def test_product_name_is_chartlingo(self):
        self.assertIn('ChartLingo', (ROOT/'index.html').read_text())
        self.assertIn('chartlingo', (ROOT/'package.json').read_text().lower())
        self.assertIn('ChartLingo', (ROOT/'README.md').read_text())

    def test_upload_works_without_module_server_and_reports_status(self):
        ui = (ROOT / "index.html").read_text()
        app = (ROOT / "src/app.js").read_text()
        self.assertNotIn('type="module"', ui)
        self.assertIn('id="importStatus"', ui)
        self.assertIn("imported successfully", app)
        self.assertIn("addEventListener('drop'", app)

    def test_structured_translation_file_workflow(self):
        core = (ROOT / "src/core.js").read_text()
        app = (ROOT / "src/app.js").read_text()
        ui = (ROOT / "index.html").read_text()
        fixture = (FIX / "translations-CH-EN.csv").read_text()
        self.assertTrue(fixture.startswith("CH,EN\n"))
        for behavior in ("parseTranslationFile", "normalizeChinese", "fuzzyScore", "matchTranslationPairs", "translationCoverage"):
            self.assertIn(behavior, core)
        for label in ("Translation File", "Generate English Chart", "Match method", "Unused translations"):
            self.assertIn(label, ui)
        self.assertNotIn("Paste Full Translation", ui)
        self.assertIn("generateEnglishFromPairs", app)

    def test_actual_outlined_svg_has_audited_visual_regions(self):
        svg = (ROOT / "test.svg").read_text()
        core = (ROOT / "src/core.js").read_text()
        self.assertNotIn("<text", svg)
        self.assertGreater(svg.count("<path"), 300)
        self.assertIn("localVisualTextRegions", core)
        for value in ("全天高点", "开盘价", "收盘", "全天低点", "上影线（又名灯芯）", "实体", "下影线（又名尾部）"):
            self.assertIn(value, core)

    def test_canvas_direct_editing_and_no_default_upload(self):
        app = (ROOT / "src/app.js").read_text()
        self.assertIn("wrapEnglish", app)
        self.assertIn("selection-box", app)
        self.assertIn("removeOutlinedChinesePaths", app)
        self.assertNotIn("canvas-text-editor", app)
        self.assertIn("onpointerdown", app)
        self.assertNotIn("Object.assign(state,saved)", app)
        ui = (ROOT / "index.html").read_text()
        self.assertNotIn('id="x"', ui)
        self.assertNotIn('id="y"', ui)

if __name__ == '__main__': unittest.main()
