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

process.stdout.write("numeric axis coalescing: passed\n");
