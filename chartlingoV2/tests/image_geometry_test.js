const fs = require("node:fs");
const vm = require("node:vm");
vm.runInThisContext(`${fs.readFileSync(require.resolve("../core.js"), "utf8")}\nglobalThis.__CLV2 = CLV2;`);

const board = { imageObjects: [{
  id: "image-1",
  type: "image",
  original: { x: 40, y: 120, width: 837, height: 435, rotation: 17 },
  bounds: { x: 31, y: 92, width: 930, height: 665 },
  lockedGeometry: false,
}] };
const images = global.__CLV2.normalizeImageObjects(board);
if (images.length !== 1) throw new Error("Image metadata was lost");
const image = images[0];
if (image.original.x !== 40 || image.original.y !== 120 || image.original.width !== 837 || image.original.height !== 435 || image.original.rotation !== 17) throw new Error("Original image geometry changed");
if (image.bounds.width !== 930 || image.bounds.height !== 665) throw new Error("Visible rotated bounds changed");
if (!image.lockedGeometry) throw new Error("Image geometry was not locked");
if (Math.abs(image.aspectRatio - 837 / 435) > 1e-9) throw new Error("Image aspect ratio changed");
process.stdout.write("image geometry locking: passed\n");
