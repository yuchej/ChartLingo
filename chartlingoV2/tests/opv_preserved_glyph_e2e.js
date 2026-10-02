const { chromium } = require(process.env.CODEX_NODE_MODULES + "/playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/chartlingoV2/";
const packagePath = process.argv[3];
const translationPath = process.argv[4];
const expectedGlyphCount = Number(process.argv[5] || 12);
const expectedGlyphColors = String(process.argv[6] || "#ed1e39").split(",").map(color => color.trim().toLowerCase());
const darkTextFrameId = process.argv[7] || "cl-tf-1-24";

if (!packagePath || !translationPath) {
  throw new Error("Usage: node opv_preserved_glyph_e2e.js <url> <package.chartlingo> <translations.txt>");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#packageInput").setInputFiles(packagePath);
    await page.locator("#csvInput").setInputFiles(translationPath);
    await page.waitForFunction(() => document.querySelectorAll("#mappingTable .mapping-row").length > 0);
    if (process.env.CHARTLINGO_SCREENSHOT) await page.locator("#outputCanvas").screenshot({ path: process.env.CHARTLINGO_SCREENSHOT });
    const result = await page.evaluate(darkTextFrameId => {
      const output = new DOMParser().parseFromString(englishSvg(board(), true), "image/svg+xml");
      const glyphFrames = board().textFrames.filter(frame => frame.preservePrefixGlyph && frame.prefixGlyph);
      const rendered = glyphFrames.map(frame => {
        const node = output.querySelector(`[data-id="${CSS.escape(frame.id)}"] [data-chartlingo-preserved-glyph="prefix"]`);
        return { id: frame.id, symbol: frame.prefixGlyph, fill: node?.getAttribute("fill") || null, fontSize: node?.parentElement?.getAttribute("font-size") || null, sourceGlyphSize: frame.prefixStyle?.fontSize, frameFontSize: frame.style?.fontSize, rendered: Boolean(node) };
      });
      const mainSpecifications = ["cl-tf-1-2-r1-c1", "cl-tf-1-2-r2-c1", "cl-tf-1-2-r3-c1", "cl-tf-1-2-r4-c1"].map(id => rendered.find(item => item.id === id));
      return { expected: glyphFrames.length, renderedCount: rendered.filter(item => item.rendered).length, glyphs: rendered, mainSpecifications, sourceTextFill: output.querySelector(`[data-id="${CSS.escape(darkTextFrameId)}"] > text`)?.getAttribute("fill") };
    }, darkTextFrameId);
    const missing = result.glyphs.filter(item => !item.rendered);
    const wrongColor = result.glyphs.filter((item, index) => item.fill?.toLowerCase() !== expectedGlyphColors[Math.min(index, expectedGlyphColors.length - 1)]);
    const missingMainSpecifications = expectedGlyphCount === 12 && result.mainSpecifications.some(item => !item?.rendered);
    if (result.expected !== expectedGlyphCount || result.renderedCount !== expectedGlyphCount || missing.length || wrongColor.length || missingMainSpecifications || (darkTextFrameId !== "-" && result.sourceTextFill !== "#000000")) {
      throw new Error(`OPV preserved bullets failed: ${JSON.stringify({ ...result, missing, wrongColor })}`);
    }
    process.stdout.write(JSON.stringify({ expected: result.expected, rendered: result.renderedCount, expectedColorsRetained: wrongColor.length === 0, example: result.glyphs[0] }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
