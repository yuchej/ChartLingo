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

const creditFrames = global.__CLV2.atomicTextFrames([{
  id: "cl-tf-1-18",
  name: "Text 18",
  sourceText: "资料来源／《纽约时报》、全球能源监测机构等 地图／张进培",
  visibleLines: ["", "资料来源／《纽约时报》、全球能源监测机构等", "地图／张进培"],
  bounds: { x: 20, y: 700, width: 500, height: 40 },
}]);
if (creditFrames.length !== 2 || creditFrames[0].fieldType !== "source" || creditFrames[1].fieldType !== "credit") {
  throw new Error("Combined source and map-credit lines were not separated into atomic fields");
}
const creditPairs = global.__CLV2.parseCsv("CH,EN\n资料来源 / 《纽约时报》、全球能源监测机构等,Source / The New York Times and Global Energy Monitor\n地图 / 张进培,LHZB Map / Zhang Jinpei\n");
const creditMatches = global.__CLV2.match(creditFrames, creditPairs);
if (creditMatches[0].pairId !== creditPairs[0].id || creditMatches[1].pairId !== creditPairs[1].id) {
  throw new Error("Full-width and ASCII credit separators did not normalize to the same CSV fields");
}
const mapCreditFrames = global.__CLV2.atomicTextFrames([{
  id: "map-credit",
  sourceText: "资料来源：市区重建局 早报地图：张进培",
  visibleLines: ["资料来源：市区重建局", "早报地图：张进培"],
  bounds: { x: 20, y: 700, width: 500, height: 40 },
}]);
if (mapCreditFrames.length !== 2 || mapCreditFrames[1].fieldType !== "credit" || mapCreditFrames[1].sourceText !== "早报地图：张进培") {
  throw new Error("Zaobao map credit was not separated as a credit field");
}

process.stdout.write("CSV period matching: passed\n");
