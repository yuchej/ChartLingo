const { chromium } = require(process.env.CODEX_NODE_MODULES + "/playwright");

const [baseUrl, opvPackage, opvTxt, transitPackage, transitTxt] = process.argv.slice(2);
if (![opvPackage, opvTxt, transitPackage, transitTxt].every(Boolean)) {
  throw new Error("Usage: node glyph_merge_and_standalone_e2e.js <url> <OPV.chartlingo> <OPV.txt> <transit.chartlingo> <transit.txt>");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl || "http://127.0.0.1:4173/chartlingoV2/", { waitUntil: "domcontentloaded" });
    await page.locator("#packageInput").setInputFiles(opvPackage);
    await page.locator("#csvInput").setInputFiles(opvTxt);
    await page.waitForFunction(() => document.querySelectorAll("#mappingTable .mapping-row").length > 0);

    const opv = await page.evaluate(() => {
      const artboard = board();
      const list = objects();
      const rowTerms = ["排水量", "航速", "续航力", "编制"];
      const applied = rowTerms.map(term => {
        const pair = state.pairs.find(item => item.ch.includes(term));
        if (!pair) throw new Error(`OPV ${term} translation was not loaded`);
        const group = fragmentGroupsForPair(pair).find(candidate => candidate.objectIds.some(id => {
          const item = list.find(object => object.frameId === id);
          return hasPreservedGlyph(item);
        }));
        if (!group) throw new Error(`OPV ${term} fragment group did not contain its bullet source frame`);
        const sourceGlyph = list.find(item => group.objectIds.includes(item.frameId) && hasPreservedGlyph(item));
        const originalId = sourceGlyph.frameId;
        const originalX = sourceGlyph.layout.x;
        const originalY = sourceGlyph.layout.y;
        const replacement = replaceFragmentGroup(pair, group);
        return { term, originalId, originalX, originalY, replacementId: replacement.frameId };
      });
      const document = new DOMParser().parseFromString(englishSvg(artboard, true), "image/svg+xml");
      const markers = applied.map(item => {
        const marker = list.find(object => object.replacementMode === "preserved-glyph-only" && object.preservedFromFrameId === item.originalId);
        const node = marker && document.querySelector(`[data-id="${CSS.escape(marker.frameId)}"] [data-chartlingo-preserved-glyph="prefix"]`);
        const replacementNode = document.querySelector(`[data-id="${CSS.escape(item.replacementId)}"] text`);
        return { term: item.term, id: marker?.frameId, text: node?.textContent, fill: node?.getAttribute("fill"), positionPreserved: marker?.layout.x === item.originalX && marker?.layout.y === item.originalY, originalFragmentHidden: !document.querySelector(`[data-id="${CSS.escape(item.originalId)}"]`), replacementHasNoDuplicateGlyph: !replacementNode?.querySelector("[data-chartlingo-preserved-glyph]") && !hasPreservedGlyph(list.find(object => object.frameId === item.replacementId)) };
      });
      return {
        markers,
        replacementCount: applied.length,
        missingMappingIssues: CLV2.validate(artboard, list).filter(issue => issue.rule === "MISSING_MAPPING").length
      };
    });
    if (opv.replacementCount !== 4 || opv.markers.some(item => !item.id || item.text !== "● " || !item.fill || !item.positionPreserved || !item.originalFragmentHidden || !item.replacementHasNoDuplicateGlyph) || opv.missingMappingIssues) {
      throw new Error(`OPV combined bullet regression failed: ${JSON.stringify(opv)}`);
    }

    await page.goto(baseUrl || "http://127.0.0.1:4173/chartlingoV2/", { waitUntil: "domcontentloaded" });
    await page.locator("#packageInput").setInputFiles(transitPackage);
    await page.locator("#csvInput").setInputFiles(transitTxt);
    await page.waitForFunction(() => document.querySelectorAll("#mappingTable .mapping-row").length > 0);
    const transit = await page.evaluate(() => {
      state.active = state.pkg.document.artboards.findIndex(item => item.textFrames.some(frame => /^cl-tf-2-[1-5]$/.test(frame.id)));
      const board = state.pkg.document.artboards[state.active];
      const expectedIds = ["cl-tf-2-1", "cl-tf-2-2", "cl-tf-2-3", "cl-tf-2-4", "cl-tf-2-5"];
      const document = new DOMParser().parseFromString(englishSvg(board, true), "image/svg+xml");
      const rendered = expectedIds.map(id => {
        const node = document.querySelector(`[data-id="${CSS.escape(id)}"] [data-chartlingo-preserved-glyph="prefix"]`);
        return { id, text: node?.textContent, fill: node?.getAttribute("fill"), visible: Boolean(node) };
      });
      const list = state.objects.get(board.id);
      return {
        artboard: board.name,
        markers: rendered,
        mappingErrors: CLV2.validate(board, list).filter(issue => issue.rule === "MISSING_MAPPING").map(issue => issue.objectId)
      };
    });
    if (transit.markers.length !== 5 || transit.markers.some(item => !item.visible || item.text !== "● " || !item.fill) || transit.mappingErrors.some(id => transit.markers.some(item => item.id === id))) {
      throw new Error(`Standalone bullet regression failed: ${JSON.stringify(transit)}`);
    }
    console.log(JSON.stringify({ opv, transit }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
