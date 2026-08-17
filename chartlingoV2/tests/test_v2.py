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

    def test_original_application_paths_are_not_referenced_for_writes(self):
        for path in ROOT.rglob("*"):
            if path.is_file() and path.suffix in {".js", ".jsx", ".html"}:
                text = path.read_text(errors="ignore")
                self.assertNotIn("../src/", text)
                self.assertNotIn("../index.html", text)


if __name__ == "__main__":
    unittest.main()
