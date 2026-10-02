const { chromium } = require(process.env.CODEX_NODE_MODULES + "/playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/chartlingoV2/";
const packagePath = process.argv[3];
const translationPath = process.argv[4];

if (!packagePath || !translationPath) {
  throw new Error("Usage: node virtual_cell_mismatch_suggestions_e2e.js <url> <package.chartlingo> <translations.txt>");
}

const expected = [
  {
    en: "Child support grant",
    ch: "养育儿女补助",
    frame: "cl-tf-1-24",
    fragments: ["养儿育女", "补助"],
  },
  {
    en: "Post-Secondary Education Account top-up",
    ch: "中学后延续教育户头填补",
    frame: "cl-tf-1-22",
    fragments: ["中学后", "延续教育 户头填补"],
  },
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#packageInput").setInputFiles(packagePath);
    await page.locator("#csvInput").setInputFiles(translationPath);
    await page.waitForFunction(() => document.querySelectorAll("#mappingTable .mapping-row").length > 0);

    const beforeOpen = await page.evaluate(expectedRows => expectedRows.map(expectedRow => {
      const pair = state.pairs.find(item => item.en === expectedRow.en && item.ch === expectedRow.ch);
      const issue = pair && projectMismatchIssues().find(item => item.pairId === pair.id);
      const group = issue?.fragmentGroups.find(item => item.objectIds.every(id => id.startsWith(`${expectedRow.frame}-`)));
      const objects = group?.objectIds.map(id => {
        const item = state.objects.get(board().id).find(candidate => candidate.frameId === id);
        return item?.originalSource?.sourceText || "";
      }) || [];
      return {
        en: expectedRow.en,
        pairId: pair?.id || null,
        group: group?.objectIds || [],
        fragments: objects,
        fuzzyPartialMapping: state.objects.get(board().id).some(item =>
          item.originalSource?.illustrator?.sourceFrameId === expectedRow.frame &&
          item.method === "fuzzy" && item.pairId === pair.id &&
          CLV2.matchKey(item.originalSource.sourceText) !== CLV2.matchKey(pair.ch)),
      };
    }), expected);

    for (let index = 0; index < expected.length; index++) {
      const result = beforeOpen[index];
      if (!result.pairId || result.group.length !== 2 || JSON.stringify(result.fragments) !== JSON.stringify(expected[index].fragments)) {
        throw new Error(`Expected a Combine suggestion for ${expected[index].en}; got ${JSON.stringify(result)}`);
      }
    }
    if (!beforeOpen[1].fuzzyPartialMapping) {
      throw new Error("Regression case no longer exercises a fuzzy match on only one post-secondary source fragment.");
    }

    await page.locator("#dataMismatchWarning").click();
    const choices = await page.locator(".mismatch-checklist-row.fragmented-replacement").evaluateAll(nodes =>
      nodes.map(node => ({
        pairId: node.dataset.pairId,
        current: node.querySelector(".keep-fragments")?.innerText || "",
        csv: node.querySelector(".replace-fragments")?.innerText || "",
      }))
    );
    const suggestions = beforeOpen.map(result => {
      const choice = choices.find(item => item.pairId === result.pairId);
      return { en: result.en, current: choice?.current || "", csv: choice?.csv || "" };
    });
    for (let index = 0; index < expected.length; index++) {
      const suggestion = suggestions[index];
      if (!suggestion.current.includes(expected[index].fragments[0]) ||
          !suggestion.current.includes(expected[index].fragments[1]) ||
          !suggestion.csv.includes(expected[index].ch)) {
        throw new Error(`Mismatch panel did not offer the correct source and CSV forms: ${JSON.stringify(suggestion)}`);
      }
    }

    const childPairId = beforeOpen[0].pairId;
    const childRow = page.locator(`.mismatch-checklist-row.fragmented-replacement[data-pair-id="${childPairId}"]`);
    await childRow.locator(".replace-fragments").click();
    await childRow.locator('input[type="checkbox"]').check();
    await page.locator("#confirmSeparation").click();
    await page.waitForFunction(pairId => state.objects.get(board().id).some(item =>
      item.pairId === pairId && item.replacementMode === "full-csv-version" &&
      item.originalSource?.sourceText === "养育儿女补助"), childPairId);
    const applied = await page.evaluate(pairId => {
      const objects = state.objects.get(board().id);
      const replacement = objects.find(item => item.pairId === pairId && item.replacementMode === "full-csv-version");
      const fragments = objects.filter(item => item.originalSource?.illustrator?.sourceFrameId === "cl-tf-1-24" && !item.replacementMode);
      return {
        replacement: replacement?.originalSource?.sourceText || null,
        visibleReplacement: Boolean(replacement?.layout),
        hiddenFragments: fragments.length === 2 && fragments.every(item => item.mergedInto === replacement?.frameId && !item.layout),
      };
    }, childPairId);
    if (applied.replacement !== expected[0].ch || !applied.visibleReplacement || !applied.hiddenFragments) {
      throw new Error(`Applying the CSV structure did not replace the fragments: ${JSON.stringify(applied)}`);
    }
    process.stdout.write(JSON.stringify(suggestions, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
