function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function exportSvg(card){
  const c=card.canvas; const vb=c.viewBox.join(' ');
  const original=card.sanitizedSource.replace(/^<svg[^>]*>|<\/svg>$/g,'');
  const english=card.english.map(o=>{const lines=o.lines||[o.approvedContent],lineHeight=o.style.size*o.style.lineHeight,anchorX=o.style.align==='end'?o.bounds.x+o.bounds.width:o.style.align==='middle'?o.bounds.x+o.bounds.width/2:o.bounds.x,first=textMetrics(lines[0]||'Mg',o.style.size,o.style),last=textMetrics(lines.at(-1)||'Mg',o.style.size,o.style),totalHeight=first.ascent+(lines.length-1)*lineHeight+last.descent,baseline=o.rowCenterY!==undefined?o.rowCenterY-totalHeight/2+first.ascent:o.bounds.y+first.ascent;return `<text data-chartlingo-id="${o.id}" x="${anchorX}" y="${baseline}" text-anchor="${o.style.align}" font-family="Roboto, Arial, sans-serif" font-weight="${o.style.weight}" font-size="${o.style.size}" fill="${esc(o.style.fill)}">${lines.map((line,i)=>`<tspan x="${anchorX}" dy="${i?lineHeight:0}">${esc(line)}</tspan>`).join('')}</text>`}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${vb}" data-product="ChartLingo"><g id="original" visibility="hidden">${original}</g><g id="english">${english}</g></svg>`;
}
function pngError(code,cause){const error=new Error(code);error.code=code;if(cause)error.cause=cause;return error}
function pngExportMessage(error){return ({PNG_CANVAS_NOT_READY:'English canvas is not ready.',PNG_INVALID_DIMENSIONS:'canvas dimensions are invalid.',PNG_SVG_SERIALIZATION_FAILED:'SVG serialization error.',PNG_EXTERNAL_ASSET_FAILED:'an external image could not be embedded.',PNG_IMAGE_LOAD_FAILED:'canvas could not rasterize the SVG.',PNG_CANVAS_CONTEXT_FAILED:'the browser could not create a canvas.',PNG_CANVAS_TAINTED:'an image made the canvas unsafe to export.',PNG_ENCODING_FAILED:'the browser could not encode the PNG.'})[error?.code||error?.message]||'the graphic could not be rendered.'}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
async function inlineExportImages(svg){
  const images=[...svg.querySelectorAll('image')];
  for(const image of images){const href=image.getAttribute('href')||image.getAttributeNS('http://www.w3.org/1999/xlink','href')||image.getAttribute('xlink:href');if(!href||href.startsWith('data:'))continue;try{const response=await fetch(href);if(!response.ok)throw new Error(`HTTP ${response.status}`);const dataUrl=await blobToDataUrl(await response.blob());image.setAttribute('href',dataUrl);image.removeAttribute('xlink:href');}catch(cause){throw pngError('PNG_EXTERNAL_ASSET_FAILED',cause)}}
}
async function createStandaloneExportSvg(card){
  const live=document.querySelector('#english svg');if(!live)throw pngError('PNG_CANVAS_NOT_READY');
  const width=Number(card.canvas.width),height=Number(card.canvas.height);if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw pngError('PNG_INVALID_DIMENSIONS');
  if(document.fonts?.ready)await document.fonts.ready;
  const clone=live.cloneNode(true);clone.querySelectorAll('.selection-box,.source-selection,.export-exclude').forEach(node=>node.remove());
  clone.querySelectorAll('[data-editable]').forEach(node=>{node.removeAttribute('data-editable');node.removeAttribute('class')});
  clone.querySelectorAll('[data-removed-chinese="true"]').forEach(node=>{node.removeAttribute('data-removed-chinese');node.setAttribute('display','none')});
  const xmlns='http://www.w3.org/2000/xmlns/',namespaceUris={xlink:'http://www.w3.org/1999/xlink',i:'http://ns.adobe.com/AdobeIllustrator/10.0/'};clone.setAttributeNS(xmlns,'xmlns','http://www.w3.org/2000/svg');
  const prefixes=new Set();for(const node of [clone,...clone.querySelectorAll('*')]){const elementPrefix=node.nodeName.includes(':')?node.nodeName.split(':')[0]:null;if(elementPrefix&&!['xml','xmlns'].includes(elementPrefix))prefixes.add(elementPrefix);for(const attr of [...node.attributes]){const prefix=attr.name.includes(':')?attr.name.split(':')[0]:null;if(prefix&&!['xml','xmlns'].includes(prefix))prefixes.add(prefix)}}for(const prefix of prefixes)clone.setAttributeNS(xmlns,`xmlns:${prefix}`,namespaceUris[prefix]||`urn:chartlingo:source-namespace:${prefix}`);
  clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));clone.setAttribute('viewBox',card.canvas.viewBox.join(' '));clone.removeAttribute('style');clone.setAttribute('data-chartlingo-export','png');
  const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font-family:Roboto,Arial,sans-serif}.selection-box,.source-selection,.export-exclude{display:none!important}';clone.insertBefore(style,clone.firstChild);
  await inlineExportImages(clone);
  let markup;try{markup=new XMLSerializer().serializeToString(clone)}catch(cause){throw pngError('PNG_SVG_SERIALIZATION_FAILED',cause)}
  const parsed=new DOMParser().parseFromString(markup,'image/svg+xml'),parserError=parsed.querySelector('parsererror');if(parserError||parsed.documentElement.localName!=='svg')throw pngError('PNG_SVG_SERIALIZATION_FAILED',new Error(parserError?.textContent||'Serialized root is not SVG.'));
  console.debug('ChartLingo PNG export: standalone SVG ready',{width,height,characters:markup.length,images:clone.querySelectorAll('image').length});return {markup,width,height};
}
function loadSvgImage(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),image=new Image();image.onload=()=>resolve({image,url});image.onerror=event=>{URL.revokeObjectURL(url);reject(pngError('PNG_IMAGE_LOAD_FAILED',event))};image.decoding='sync';image.src=url})}
async function exportPng(card,targetWidth=1200){
  const {markup,width,height}=await createStandaloneExportSvg(card),svgBlob=new Blob([markup],{type:'image/svg+xml;charset=utf-8'});console.debug('ChartLingo PNG export: SVG Blob created',{bytes:svgBlob.size,type:svgBlob.type});
  const pixelWidth=Math.max(1,Math.round(targetWidth)),pixelHeight=Math.max(1,Math.round(height*(pixelWidth/width))),canvas=document.createElement('canvas');canvas.width=pixelWidth;canvas.height=pixelHeight;const context=canvas.getContext('2d');if(!context)throw pngError('PNG_CANVAS_CONTEXT_FAILED');
  const loaded=await loadSvgImage(svgBlob);try{context.clearRect(0,0,pixelWidth,pixelHeight);context.drawImage(loaded.image,0,0,pixelWidth,pixelHeight);console.debug('ChartLingo PNG export: SVG drawn to canvas',{pixelWidth,pixelHeight})}catch(cause){throw pngError('PNG_IMAGE_LOAD_FAILED',cause)}finally{URL.revokeObjectURL(loaded.url)}
  try{const png=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(pngError('PNG_ENCODING_FAILED')),'image/png'));console.debug('ChartLingo PNG export: PNG encoded',{bytes:png.size});return png}catch(error){if(error?.name==='SecurityError')throw pngError('PNG_CANVAS_TAINTED',error);throw error}
}
function pdfEscape(s){return s.replace(/([()\\])/g,'\\$1').replace(/[^\x20-\x7e]/g,'?');}
function exportPdf(card){
  const lines=card.english.map(o=>`BT /F1 ${o.style.size.toFixed(2)} Tf ${o.bounds.x.toFixed(2)} ${(card.canvas.height-o.bounds.y-o.style.size).toFixed(2)} Td (${pdfEscape(o.approvedContent)}) Tj ET`).join('\n');
  const objs=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${card.canvas.width} ${card.canvas.height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,`<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`]; let out='%PDF-1.4\n',offset=[0];objs.forEach((o,i)=>{offset.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});const x=out.length;out+=`xref\n0 6\n0000000000 65535 f \n${offset.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return new Blob([out],{type:'application/pdf'});
}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}

const ZIP_CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})();
function zipCrc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=ZIP_CRC_TABLE[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function zipU16(view,offset,value){view.setUint16(offset,value,true)}
function zipU32(view,offset,value){view.setUint32(offset,value>>>0,true)}
async function createZip(files){
  const encoder=new TextEncoder(),entries=[];let localOffset=0;
  for(const file of files){const name=encoder.encode(file.name),data=file.blob instanceof Blob?new Uint8Array(await file.blob.arrayBuffer()):encoder.encode(String(file.blob)),crc=zipCrc32(data),local=new Uint8Array(30+name.length+data.length),view=new DataView(local.buffer);zipU32(view,0,0x04034b50);zipU16(view,4,20);zipU16(view,6,0x0800);zipU16(view,8,0);zipU16(view,10,0);zipU16(view,12,0);zipU32(view,14,crc);zipU32(view,18,data.length);zipU32(view,22,data.length);zipU16(view,26,name.length);zipU16(view,28,0);local.set(name,30);local.set(data,30+name.length);entries.push({name,data,crc,local,offset:localOffset});localOffset+=local.length}
  const centralParts=[];let centralSize=0;
  for(const entry of entries){const central=new Uint8Array(46+entry.name.length),view=new DataView(central.buffer);zipU32(view,0,0x02014b50);zipU16(view,4,20);zipU16(view,6,20);zipU16(view,8,0x0800);zipU16(view,10,0);zipU16(view,12,0);zipU16(view,14,0);zipU32(view,16,entry.crc);zipU32(view,20,entry.data.length);zipU32(view,24,entry.data.length);zipU16(view,28,entry.name.length);zipU16(view,30,0);zipU16(view,32,0);zipU16(view,34,0);zipU16(view,36,0);zipU32(view,38,0);zipU32(view,42,entry.offset);central.set(entry.name,46);centralParts.push(central);centralSize+=central.length}
  const end=new Uint8Array(22),endView=new DataView(end.buffer);zipU32(endView,0,0x06054b50);zipU16(endView,4,0);zipU16(endView,6,0);zipU16(endView,8,entries.length);zipU16(endView,10,entries.length);zipU32(endView,12,centralSize);zipU32(endView,16,localOffset);zipU16(endView,20,0);
  return new Blob([...entries.map(e=>e.local),...centralParts,end],{type:'application/zip'})
}
