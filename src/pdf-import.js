let pdfJsLoader;

function loadPdfJs() {
  if (!pdfJsLoader) {
    pdfJsLoader = import('/src/vendor/pdf.min.mjs?v=20260812-1').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('/src/vendor/pdf.worker.min.mjs?v=20260812-1', window.location.origin).href;
      return pdfjs;
    }).catch(error => {
      console.error('ChartLingo PDF engine failed to load', error);
      throw new Error('PDF_ENGINE_LOAD_FAILED');
    });
  }
  return pdfJsLoader;
}

function pdfSvgEscape(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]));
}

function pdfBackgroundColor(context, bounds, scale) {
  const canvas=context.canvas,x=Math.max(0,Math.round(bounds.x*scale)),y=Math.max(0,Math.round(bounds.y*scale)),w=Math.max(1,Math.round(bounds.width*scale)),h=Math.max(1,Math.round(bounds.height*scale));
  const gap=Math.max(4,Math.round(4*scale)),fractions=[.1,.5,.9],points=[...fractions.flatMap(f=>[[x+w*f,y-gap],[x+w*f,y+h+gap]]),...fractions.flatMap(f=>[[x-gap,y+h*f],[x+w+gap,y+h*f]])].map(([px,py])=>[Math.max(0,Math.min(canvas.width-1,Math.round(px))),Math.max(0,Math.min(canvas.height-1,Math.round(py)))]);
  const pixels=points.map(([px,py])=>context.getImageData(px,py,1,1).data),rgb=[0,1,2].map(channel=>pixels.map(pixel=>pixel[channel]).sort((a,b)=>a-b)[Math.floor(pixels.length/2)]);
  return `rgb(${rgb.join(',')})`;
}

function pdfLineJoin(left,right){return /[A-Za-z0-9]$/.test(left)&&/^[A-Za-z0-9]/.test(right)?' ':'';}

function mergePdfTextLines(items) {
  const merged=[];
  for(const item of items){
    const previous=merged.at(-1),sameFont=previous&&previous.fontName===item.fontName,sizeRatio=previous?Math.max(previous.style.size,item.style.size)/Math.max(1,Math.min(previous.style.size,item.style.size)):Infinity,xAligned=previous&&Math.abs(previous.bounds.x-item.bounds.x)<=Math.max(8,Math.min(previous.style.size,item.style.size)*.75),verticalGap=previous?item.bounds.y-(previous.bounds.y+previous.bounds.height):Infinity,consecutiveLine=previous?.hasEOL&&sameFont&&sizeRatio<=1.2&&xAligned&&verticalGap>=-previous.style.size*.35&&verticalGap<=Math.max(previous.style.size,item.style.size)*1.15;
    if(!consecutiveLine){merged.push({...item,sourceLines:[item.content]});continue;}
    const right=Math.max(previous.bounds.x+previous.bounds.width,item.bounds.x+item.bounds.width),bottom=Math.max(previous.bounds.y+previous.bounds.height,item.bounds.y+item.bounds.height);
    previous.content+=pdfLineJoin(previous.content,item.content)+item.content;previous.sourceLines.push(item.content);previous.bounds.width=right-previous.bounds.x;previous.bounds.height=bottom-previous.bounds.y;previous.originalWidth=previous.bounds.width;previous.originalHeight=previous.bounds.height;previous.hasEOL=item.hasEOL;previous.maskFill=item.maskFill===previous.maskFill?previous.maskFill:previous.maskFill;
  }
  return merged;
}

function pdfTextObjects(pdfjs, textContent, viewport, context, renderScale, name, pageNumber) {
  const items=textContent.items.map((item,index)=>{
    const content=(item.str||'').replace(/\s+/g,' ').trim();
    if(!content)return null;
    const transform=pdfjs.Util.transform(viewport.transform,item.transform),size=Math.max(1,Math.hypot(transform[2],transform[3])),width=Math.max(1,Math.abs(item.width*viewport.scale)),bounds={x:transform[4],y:transform[5]-size,width,height:Math.max(size,Math.abs(item.height*viewport.scale)||size)};
    const style={family:textContent.styles?.[item.fontName]?.fontFamily||'sans-serif',weight:400,size,lineHeight:1.2,letterSpacing:0,align:'start',fill:'#111',rotation:Math.atan2(transform[1],transform[0])*180/Math.PI};
    return {id:stableId('pdf-text',`${name}:${pageNumber}:${index}:${content}`),kind:'text',layer:'CHINESE',role:index===0?'TITLE':'BODY',content,provenance:'pdf_text',confidence:.98,candidates:[{text:content,provenance:'pdf_text',confidence:.98}],bounds,style,...originalGeometry(bounds,style),sourceRef:`pdf-page-${pageNumber}-text-${index}`,sourceIndex:index,locked:true,maskFill:pdfBackgroundColor(context,bounds,renderScale),fontName:item.fontName,hasEOL:item.hasEOL};
  }).filter(Boolean);
  return mergePdfTextLines(items).map((item,index)=>({...item,id:stableId('pdf-text',`${name}:${pageNumber}:merged:${index}:${item.content}`),sourceRef:`pdf-page-${pageNumber}-text-${index}`,sourceIndex:index,candidates:[{text:item.content,provenance:'pdf_text',confidence:.98}]}));
}

async function parsePdfFile(file) {
  const pdfjs=await loadPdfJs();
  const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer),header=new TextDecoder('latin1').decode(bytes.slice(0,1024));
  if(!header.includes('%PDF-'))throw new Error('PDF_MISSING_HEADER');
  let pdf,openError;
  try { pdf=await pdfjs.getDocument({data:new Uint8Array(buffer.slice(0)),isEvalSupported:false,stopAtErrors:false}).promise; }
  catch(error) { openError=error; }
  if(!pdf){
    try { pdf=await pdfjs.getDocument({data:new Uint8Array(buffer.slice(0)),disableRange:true,disableStream:true,disableAutoFetch:true,isEvalSupported:false,stopAtErrors:false}).promise; }
    catch(error) { openError=error; }
  }
  if(!pdf){
    console.error('ChartLingo could not open PDF',{name:file.name,size:file.size,errorName:openError?.name,errorMessage:openError?.message,code:openError?.code});
    const passwordError=openError?.name==='PasswordException'||/password/i.test(openError?.message||'');
    throw new Error(passwordError?'PDF_PASSWORD_PROTECTED':`INVALID_PDF_DETAIL:${openError?.message||'Unsupported PDF structure'}`);
  }
  if(pdf.numPages>CONFIG.maxPdfPages)throw new Error('PDF_TOO_MANY_PAGES');
  const cards=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1}),maxDimension=Math.max(viewport.width,viewport.height),renderScale=Math.min(2,2400/maxDimension),renderViewport=page.getViewport({scale:renderScale}),canvas=document.createElement('canvas');
    canvas.width=Math.ceil(renderViewport.width);canvas.height=Math.ceil(renderViewport.height);
    const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('INVALID_PDF');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:context,viewport:renderViewport}).promise;
    const textContent=await page.getTextContent(),pageName=pdf.numPages===1?file.name:`${file.name} - page ${pageNumber}`,texts=pdfTextObjects(pdfjs,textContent,viewport,context,renderScale,file.name,pageNumber);
    if(!texts.length)throw new Error('PDF_NO_SELECTABLE_TEXT');
    const image=canvas.toDataURL('image/png'),masks=texts.map(text=>{const verticalPad=Math.max(2,text.style.size*.25);return `<rect class="pdf-text-mask" x="${text.bounds.x-3}" y="${text.bounds.y-verticalPad}" width="${text.bounds.width+6}" height="${text.bounds.height+verticalPad*2}" fill="${pdfSvgEscape(text.maskFill)}"/>`}).join(''),source=`<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}"><image width="${viewport.width}" height="${viewport.height}" href="${pdfSvgEscape(image)}"/>${masks}</svg>`,layoutModel=inferLayoutRegions(new DOMParser().parseFromString(source,'image/svg+xml').documentElement,texts,viewport.width,viewport.height);
    cards.push({id:stableId('pdf-card',`${file.name}:${file.size}:${pageNumber}`),name:pageName,format:'pdf',pageNumber,canvas:{width:viewport.width,height:viewport.height,viewBox:[0,0,viewport.width,viewport.height]},originalSource:null,sanitizedSource:source,security:{removed:[]},texts,layoutModel,protectedAreas:[],english:[],mappings:[],issues:[],revision:1,status:'ready'});
    page.cleanup();
  }
  await pdf.destroy();
  return cards;
}
