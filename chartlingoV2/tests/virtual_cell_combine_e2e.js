const { chromium } = require(process.env.CODEX_NODE_MODULES + "/playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/chartlingoV2/";
const packagePath = process.argv[3];
const translationPath = process.argv[4];

if (!packagePath || !translationPath) {
  throw new Error("Usage: node virtual_cell_combine_e2e.js <url> <package.chartlingo> <translations.txt>");
}

const expectedUnits = [
  ["投放与回收系统", "Launch and Recovery System"],
  ["即使海况复杂，也能安全、有序、高效地投放和回收船艇。", "Safely, orderly, and efficiently launches and recovers boats even in complex sea conditions."],
  ["任务配置灵活", "Flexible Mission Configuration"],
  ["可按不同任务需要装载不同设备，并支持多种有人及无人载具的投放。", "Can be equipped with different equipment according to different mission needs, and supports the deployment of various manned and unmanned craft."],
  ["两种推进模式", "Two Propulsion Modes"],
  ["可采用柴油电力或柴油推进模式，低速巡逻时节省燃油，有需要时则可高速航行迅速应对事故。", "Can adopt diesel-electric or diesel propulsion modes, saving fuel during low-speed patrols and cruising at high speed to quickly respond to incidents when needed."],
];

const expectedRows = [
  [0, "排水量 2700公吨"],
  [1, "航速 超过23节"],
  [2, "续航力 超过4000海里（约7400公里）"],
  [3, "基本编制 约40人"],
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#packageInput").setInputFiles(packagePath);
    await page.locator("#csvInput").setInputFiles(translationPath);
    await page.waitForFunction(() => document.querySelectorAll("#mappingTable .mapping-row").length > 0);

    const renderedUnits = await page.evaluate(() => {
      const ids = ["cl-tf-1-7-", "cl-tf-1-8-", "cl-tf-1-9-"];
      const list = state.objects.get(board().id) || [];
      return list.filter(item => ids.some(prefix => item.frameId.startsWith(prefix)))
        .map(item => ({ id: item.frameId, text: item.english, rendered: !!document.querySelector(`#outputCanvas .english-object[data-id="${item.frameId}"]`), mergedInto: item.mergedInto || null }));
    });
    const byEnglish = new Map(renderedUnits.map(item => [item.text, item]));
    if (renderedUnits.length !== expectedUnits.length || new Set(renderedUnits.map(item => item.id)).size !== expectedUnits.length || renderedUnits.some(item => !item.rendered || item.mergedInto)) {
      throw new Error(`Expected six independently rendered section 3/4/5 text boxes; found ${renderedUnits.length}: ${JSON.stringify(renderedUnits)}`);
    }
    for (const [, english] of expectedUnits) {
      if (!byEnglish.has(english)) throw new Error(`Expected separate translated text box not found: ${english}; rendered ${JSON.stringify(renderedUnits)}`);
    }

    const combineSuggestions = await page.evaluate(rows => rows.map(([row, expectedSource]) => {
      const list = state.objects.get(board().id);
      const selected = list.filter(item => item.originalSource?.illustrator?.sourceFrameId === "cl-tf-1-2" && item.originalSource.illustrator.row === row);
      if (selected.length < 2) return { row, expectedSource, error: `Only ${selected.length} cells found` };
      state.mergeSelection = new Set(selected.map(item => item.frameId));
      updateMergeTools();
      const field = document.querySelector("#mergeCsvField");
      const button = document.querySelector("#mergeSelected");
      const pair = state.pairs.find(item => CLV2.matchKey(item.ch) === CLV2.matchKey(expectedSource));
      const issue = pair ? projectMismatchIssues().find(item => item.pairId === pair.id) : null;
      const groups = issue?.fragmentGroups.filter(group => group.objectIds.every(id => {
        const fragment = list.find(item => item.frameId === id);
        return fragment?.originalSource?.illustrator?.sourceFrameId === "cl-tf-1-2" && fragment.originalSource.illustrator.row === row;
      })) || [];
      const suggestionMarkup = pair && groups.length ? fragmentedReplacementMarkup({ fragmentGroups: groups }, row, pair) : "";
      return { row, expectedSource, selected: selected.map(item => item.originalSource.sourceText), suggestedSource: field.selectedOptions[0]?.textContent?.split(" → ")[0] || "", fragmentGroup: groups[0]?.objectIds || [], offersCsvCombine: suggestionMarkup.includes("CSV") && groups.length === 1, enabled: !button.disabled };
    }), expectedRows);

    for (const suggestion of combineSuggestions) {
      if (suggestion.error || suggestion.suggestedSource !== suggestion.expectedSource || !suggestion.enabled || !suggestion.offersCsvCombine || suggestion.fragmentGroup.length !== suggestion.selected.length) {
        throw new Error(`Incorrect Combine suggestion: ${JSON.stringify(suggestion)}`);
      }
    }

    process.stdout.write(JSON.stringify({ renderedUnits, combineSuggestions }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
