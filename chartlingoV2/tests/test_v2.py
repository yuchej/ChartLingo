import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class ChartLingoV2Tests(unittest.TestCase):
    def test_v2_is_self_contained(self):
        for name in ["index.html", "styles.css", "core.js", "app.js", "README.md"]:
            self.assertTrue((ROOT / name).is_file(), name)

    def test_schema_contracts_are_versioned(self):
        package = json.loads((ROOT / "schemas/package-v2.schema.json").read_text())
        result = json.loads((ROOT / "schemas/result-v2.schema.json").read_text())
        self.assertEqual(package["$id"], "https://chartlingo.local/schemas/package-v2.json")
        self.assertEqual(result["$id"], "https://chartlingo.local/schemas/result-v2.json")
        self.assertEqual(package["properties"]["schemaVersion"]["const"], "2.0.0")
        self.assertEqual(result["properties"]["schemaVersion"]["const"], "2.0.0")

    def test_multiline_text_is_one_source_object(self):
        core = (ROOT / "core.js").read_text()
        self.assertIn("visibleLines:['航程缩短3小时，','新加坡经济可获什么？']", core)
        self.assertIn("sourceText:'航程缩短3小时，新加坡经济可获什么？'", core)
        self.assertEqual(core.count("id:'headline-01'"), 1)

    def test_direct_and_illustrator_exports_exist(self):
        app = (ROOT / "app.js").read_text()
        self.assertIn("function exportSvg()", app)
        self.assertIn("function exportPng()", app)
        self.assertIn("function exportResult()", app)
        self.assertTrue((ROOT / "illustrator/export-to-chartlingo.jsx").is_file())
        self.assertTrue((ROOT / "illustrator/apply-chartlingo-result.jsx").is_file())

    def test_embedded_svg_is_sanitized(self):
        core = (ROOT / "core.js").read_text()
        self.assertIn("CLV2.sanitizeSvg", core)
        self.assertIn("script,foreignObject,iframe,object,embed,audio,video", core)
        self.assertIn("name.startsWith('on')", core)

    def test_illustrator_scripts_do_not_require_native_json(self):
        exporter = (ROOT / "illustrator/export-to-chartlingo.jsx").read_text()
        importer = (ROOT / "illustrator/apply-chartlingo-result.jsx").read_text()
        self.assertIn("function jsonStringify", exporter)
        self.assertIn("function jsonParse", importer)
        self.assertNotIn("JSON.stringify", exporter)
        self.assertNotIn("JSON.parse", importer)

    def test_v2_removes_source_text_and_uses_1200px_output(self):
        core = (ROOT / "core.js").read_text()
        app = (ROOT / "app.js").read_text()
        self.assertIn("CLV2.removeSourceText", core)
        self.assertIn("querySelectorAll('text,textPath,flowRoot,flowPara')", core)
        self.assertIn("const width=1200", app)
        self.assertIn("height=Math.round(artboard.bounds.height*scale)", app)
        self.assertIn('transform="scale(${spec.scale})"', app)
        self.assertNotIn("source-masks", app)
        self.assertNotIn("source-mask", app)

    def test_unmatched_text_is_retained_and_roboto_is_bundled(self):
        core = (ROOT / "core.js").read_text()
        app = (ROOT / "app.js").read_text()
        self.assertIn("pair?.en||frame.sourceText", core)
        self.assertIn("sourceRetained:!pair", core)
        self.assertIn("function updateMapping", app)
        self.assertIn("Use original Chinese content", app)
        self.assertIn("manual-match", app)
        self.assertIn("if(score<.82)pair=null", core)
        self.assertIn("fontPostScriptName:'Roboto-Regular'", app)
        self.assertTrue((ROOT / "fonts/Roboto-Regular.ttf").is_file())
        self.assertTrue((ROOT / "fonts/Roboto-Bold.ttf").is_file())
        self.assertTrue((ROOT / "fonts/OFL.txt").is_file())

    def test_generated_text_can_be_dragged_and_exported_at_new_position(self):
        app = (ROOT / "app.js").read_text()
        styles = (ROOT / "styles.css").read_text()
        self.assertIn("function bindCanvasDragging", app)
        self.assertIn("node.onpointerdown", app)
        self.assertIn("object.layout.x=", app)
        self.assertIn("object.layout.y=", app)
        self.assertIn("cursor:grab", styles)

    def test_strict_positions_and_text_free_illustrator_preview(self):
        core = (ROOT / "core.js").read_text()
        app = (ROOT / "app.js").read_text()
        exporter = (ROOT / "illustrator/export-to-chartlingo.jsx").read_text()
        self.assertIn("x=frame.bounds.x,y=frame.bounds.y", core)
        self.assertIn("sourceRetained&&original.visibleLines?.length>1", app)
        self.assertIn("readArtworkWithoutLiveText", exporter)
        self.assertIn("doc.textFrames[i].hidden = true", exporter)
        self.assertIn("doc.textFrames[i].opacity = 0", exporter)
        self.assertIn("version: '0.4.0'", exporter)

    def test_illustrator_tab_tables_export_as_independent_cells(self):
        exporter = (ROOT / "illustrator/export-to-chartlingo.jsx").read_text()
        importer = (ROOT / "illustrator/apply-chartlingo-result.jsx").read_text()
        self.assertIn("function tableRows", exporter)
        self.assertIn("function tableColumns", exporter)
        self.assertIn("'-r' + (rowIndex + 1) + '-c' + (columnIndex + 1)", exporter)
        self.assertIn("kind: 'table-cell'", exporter)
        self.assertIn("virtualCell: true", exporter)
        self.assertIn("sourceFrameId(change.id)", importer)

    def test_legacy_packages_warn_instead_of_failing(self):
        core = (ROOT / "core.js").read_text()
        app = (ROOT / "app.js").read_text()
        self.assertIn("copy.legacyExporter=", core)
        self.assertIn("CLV2.removeLegacyOutlinedText", core)
        self.assertIn("fill===target.color", core)
        self.assertIn("CLV2.removeLegacyOutlinedText(packaged||sourceSvg(board),board.textFrames)", app)
        self.assertIn("Older package imported", app)
        self.assertIn("LEGACY_EXPORTER", app)
        self.assertNotIn("This package was made by an older Illustrator exporter", core)

    def test_original_application_paths_are_not_referenced_for_writes(self):
        for path in ROOT.rglob("*"):
            if path.is_file() and path.suffix in {".js", ".jsx", ".html"}:
                text = path.read_text(errors="ignore")
                self.assertNotIn("../src/", text)
                self.assertNotIn("../index.html", text)


if __name__ == "__main__":
    unittest.main()
