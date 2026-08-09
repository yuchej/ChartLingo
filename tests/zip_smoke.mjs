import fs from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(fs.readFileSync(new URL('../src/exporters.js',import.meta.url),'utf8'));
const zip=await createZip([{name:'chartlingo_EN_01.svg',blob:new Blob(['<svg/>'])}]);
const bytes=new Uint8Array(await zip.arrayBuffer());
const view=new DataView(bytes.buffer);
if(view.getUint32(0,true)!==0x04034b50)throw new Error('Missing ZIP local-file header');
if(view.getUint32(bytes.length-22,true)!==0x06054b50)throw new Error('Missing ZIP end-of-central-directory record');
console.log(`ZIP smoke test passed (${bytes.length} bytes)`);
