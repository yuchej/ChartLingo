const fs = require("node:fs");
const vm = require("node:vm");

vm.runInThisContext(`${fs.readFileSync(require.resolve("../core.js"), "utf8")}\nglobalThis.__CLV2 = CLV2;`);

const pairs = global.__CLV2.parseCsv("\uFEFFCH,EN\n上半年,First Half\n2026上半年,First Half of 2026\n2026下半年,Second Half of 2026\n");
if (pairs.length !== 3) throw new Error(`Expected 3 CSV rows, got ${pairs.length}`);

const frames = [
  { id: "frame-1", sourceText: "2026 上半年" },
  { id: "frame-2", sourceText: "2026\u00a0下半年" },
  { id: "row-1", sourceText: "上半年" },
];
const matches = global.__CLV2.match(frames, pairs);

if (matches[0].english !== "First Half of 2026" || matches[0].method !== "normalized") {
  throw new Error("Spaced Chinese half-year label did not match its complete CSV field");
}
if (matches[1].english !== "Second Half of 2026") {
  throw new Error("Non-breaking-space Chinese label did not normalize correctly");
}
if (matches[2].english !== "First Half" || matches[2].method !== "exact") {
  throw new Error("Automatic row ID incorrectly overrode the exact source-text match");
}

process.stdout.write("CSV period matching: passed\n");
