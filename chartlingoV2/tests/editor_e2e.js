const { chromium } = require(process.env.CODEX_NODE_MODULES + "/playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:4175/chartlingoV2/";
const packagePath = process.argv[3];
const csvPath = process.argv[4];

if (!packagePath || !csvPath) {
  throw new Error("Usage: node editor_e2e.js <url> <package.chartlingo> <translations.csv>");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  process.stderr.write("open\n");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  process.stderr.write("package\n");
  await page.locator("#packageInput").setInputFiles(packagePath);
  process.stderr.write("csv\n");
  await page.locator("#csvInput").setInputFiles(csvPath);
  process.stderr.write("generate\n");
  await page.locator("#generate").click();
  process.stderr.write("editor\n");
  await page.locator("#openEditor").click();
  await page.locator("#editorZoom").selectOption("70");

  const textarea = page.locator("#editText");
  await textarea.focus();
  await textarea.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.locator("#editPartialColor").fill("#e90044");
  await page.locator("#editPartialStrokeEnabled").check();
  await page.locator("#editPartialStrokeColor").fill("#ffffff");
  await page.locator("#editPartialStrokeWidth").fill("1.5");
  await page.locator("#applyPartialColor").click();
  const undoEnabledAfterEdit = await page.locator("#undoEdit").isEnabled();
  await page.locator("#undoEdit").click();
  const redoEnabledAfterUndo = await page.locator("#redoEdit").isEnabled();
  await page.locator("#redoEdit").click();
  await page.locator('[data-inspector-target="appearanceSection"]').click();
  const appearanceOpened = await page.locator("#appearanceSection").evaluate((node) => node.open);
  await page.locator('[data-inspector-target="characterSection"]').click();

  await page.screenshot({ path: "/private/tmp/chartlingo-editor-light.png", fullPage: true });
  const result = await page.evaluate(() => ({
    editorOpen: document.querySelector("#app").classList.contains("editing-mode"),
    inspectorVisible: getComputedStyle(document.querySelector("#textInspector")).display !== "none",
    tabs: Array.from(document.querySelectorAll(".inspector-tabs button")).map((node) => node.textContent.trim()),
    backVisible: getComputedStyle(document.querySelector("#exitEditor")).display !== "none",
    importToolbarHidden: getComputedStyle(document.querySelector(".top-actions")).display === "none",
    zoom: document.querySelector("#editorZoom").value,
    svgWidth: document.querySelector("#outputCanvas svg").style.width,
    strokeEnabled: document.querySelector("#editPartialStrokeEnabled").checked,
    strokeWidthEnabled: !document.querySelector("#editPartialStrokeWidth").disabled,
    exportSvgEnabled: !document.querySelector("#exportSvg").disabled,
    exportPngEnabled: !document.querySelector("#exportPng").disabled,
    exportJpgEnabled: !document.querySelector("#exportJpg").disabled,
    visibleTextObjects: document.querySelectorAll("#outputCanvas .english-object").length,
    transformHandles: document.querySelectorAll("#outputCanvas .transform-handle").length,
    alignButtonsEnabled: Array.from(document.querySelectorAll("[data-align-action]")).every((button) => !button.disabled),
  }));
  result.undoEnabledAfterEdit = undoEnabledAfterEdit;
  result.redoEnabledAfterUndo = redoEnabledAfterUndo;
  result.appearanceOpened = appearanceOpened;

  await page.locator("#applyInspector").click();
  result.applyExitedEditor = !(await page.locator("#app").evaluate((node) => node.classList.contains("editing-mode")));
  result.consoleErrors = consoleErrors;
  process.stdout.write(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
