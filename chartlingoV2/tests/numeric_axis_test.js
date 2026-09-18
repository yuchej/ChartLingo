const fs = require("node:fs");
const vm = require("node:vm");

vm.runInThisContext(`${fs.readFileSync(require.resolve("../core.js"), "utf8")}\nglobalThis.__CLV2 = CLV2;`);

const frames = ["1.2", "1.0", "0.8", "0.6"].map((sourceText, index) => ({
  id: `axis-r${index + 1}`,
  name: `Axis ${index + 1}`,
  sourceText,
  visibleLines: [sourceText],
  kind: "list-item",
  role: "DATA_LABEL",
  bounds: { x: 10, y: index * 24, width: 40, height: 20 },
  style: { fontSize: 12 },
  illustrator: { sourceFrameId: "axis", virtualCell: true, row: index },
}));

const merged = global.__CLV2.coalesceNumericAxes(frames);
if (merged.length !== 1) throw new Error(`Expected one numeric axis frame, got ${merged.length}`);
if (merged[0].sourceText !== "1.2\n1.0\n0.8\n0.6") throw new Error("Decimal labels were not preserved");
if (merged[0].visibleLines.join("|") !== "1.2|1.0|0.8|0.6") throw new Error("Visible decimal lines changed");
if (merged[0].kind !== "axis-scale") throw new Error("Numeric scale role was not restored");

const fragmentedFrame = {
  id: "fragmented-axis",
  name: "Fragmented decimal axis",
  sourceText: "1 .2 1 .0 0 .8 0 .6",
  visibleLines: ["1", ".2", "1", ".0", "0", ".8", "0", ".6"],
  kind: "point",
  role: "DATA_LABEL",
  bounds: { x: 10, y: 0, width: 40, height: 96 },
  style: { fontSize: 12 },
  illustrator: { textFrameIndex: 1 },
};
const repairedFrame = global.__CLV2.coalesceNumericAxes([fragmentedFrame]);
if (repairedFrame.length !== 1) throw new Error("Fragmented numeric axis should remain one text object");
if (repairedFrame[0].visibleLines.join("|") !== "1.2|1.0|0.8|0.6") throw new Error("Fragmented decimal rows were not repaired");
if (repairedFrame[0].sourceText !== "1.2\n1.0\n0.8\n0.6") throw new Error("Fragmented numeric source text was not repaired");

const fragmentedCells = [
  ["1", 0, 0], [".2", 12, 0],
  ["1", 0, 24], [".0", 12, 24],
  ["0", 0, 48], [".8", 12, 48],
  ["0", 0, 72], [".6", 12, 72],
].map(([sourceText, x, y], index) => ({
  id: `fragment-${index}`,
  sourceText,
  visibleLines: [sourceText],
  kind: "list-item",
  role: "DATA_LABEL",
  bounds: { x, y, width: 12, height: 20 },
  style: { fontSize: 12 },
  illustrator: { sourceFrameId: "fragmented-cell-axis", virtualCell: true },
}));
const repairedCells = global.__CLV2.coalesceNumericAxes(fragmentedCells);
if (repairedCells.length !== 1) throw new Error("Fragmented numeric cells should become one text object");
if (repairedCells[0].visibleLines.join("|") !== "1.2|1.0|0.8|0.6") throw new Error("Same-row numeric fragments were not joined");

const independentFragments = [
  ["8", 100, 0], [".0", 116, 0],
  ["7", 100, 30], [".5", 116, 30],
  ["7", 100, 60], [".0", 116, 60],
  ["6", 100, 90], [".5", 116, 90],
].map(([sourceText, x, y], index) => ({
  id: `independent-${index}`,
  sourceText,
  visibleLines: [sourceText],
  kind: "point",
  role: "DATA_LABEL",
  bounds: { x, y, width: sourceText.startsWith(".") ? 18 : 14, height: 22 },
  style: { fontSize: 14 },
  illustrator: { sourceFrameId: `separate-source-${index}` },
}));
const repairedIndependent = global.__CLV2.mergeSpatialDecimalTicks(independentFragments);
if (repairedIndependent.length !== 4) throw new Error("Independent decimal fragments should become four tick objects");
if (repairedIndependent.map(frame => frame.sourceText).join("|") !== "8.0|7.5|7.0|6.5") throw new Error("Spatial decimal fragments were not joined correctly");
if (repairedIndependent.some(frame => frame.visibleLines.length !== 1)) throw new Error("Each repaired tick must remain one logical text box");

process.stdout.write("numeric axis coalescing: passed\n");
