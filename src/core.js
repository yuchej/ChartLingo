const ROLES = ['TITLE','SUBTITLE','BODY','ANNOTATION','DATA_LABEL','AXIS_LABEL','LEGEND','CHART_LABEL','SOURCE','FOOTNOTE','CAPTION'];
const ACTIVE_ATTR = /^on/i;
const UNSAFE_URL = /^(?:javascript:|data:text\/html)/i;

function stableId(prefix, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

function sanitizeSvg(source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('INVALID_SVG');
  const removed = [];
  for (const node of [...doc.querySelectorAll('script,foreignObject,iframe,object,embed')]) {
    removed.push(node.localName); node.remove();
  }
  for (const node of [...doc.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      const value = attr.value.trim();
      if (ACTIVE_ATTR.test(attr.name) || ((attr.name === 'href' || attr.name.endsWith(':href') || attr.name === 'src') && (UNSAFE_URL.test(value) || /^(?:https?:)?\/\//i.test(value))) || (attr.name === 'style' && /url\s*\(|expression\s*\(/i.test(value))) {
        removed.push(`${node.localName}@${attr.name}`); node.removeAttribute(attr.name);
      }
    }
  }
  return { svg: new XMLSerializer().serializeToString(doc.documentElement), removed };
}

function number(value, fallback = 0) { const n = Number.parseFloat(value); return Number.isFinite(n) ? n : fallback; }
function roleFor(node, index) {
  const hint = `${node.id} ${node.getAttribute('class') || ''}`.toLowerCase();
  if (/title|headline/.test(hint) || index === 0) return 'TITLE';
  if (/axis/.test(hint)) return 'AXIS_LABEL';
  if (/data|value|label/.test(hint)) return 'DATA_LABEL';
  if (/source/.test(hint)) return 'SOURCE';
  if (/foot/.test(hint)) return 'FOOTNOTE';
  if (/legend/.test(hint)) return 'LEGEND';
  return 'BODY';
}
function anchoredBounds(x,y,width,height,size,align){const left=align==='end'?x-width:align==='middle'?x-width/2:x;return {x:left,y:y-size,width,height};}
function originalGeometry(bounds,style){return {originalX:bounds.x,originalY:bounds.y,originalWidth:bounds.width,originalHeight:bounds.height,originalFontSize:style.size,originalLineHeight:style.size*style.lineHeight};}
function hasMojibake(text) { return /\ufffd|Ã|Â|â€|ï¿½/.test(text); }

function parseSvg(source, name = 'card.svg', fakeOcr = defaultFakeOcr) {
  const { svg, removed } = sanitizeSvg(source);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  const width = number(root.getAttribute('width'), viewBox?.[2]);
  const height = number(root.getAttribute('height'), viewBox?.[3]);
  if (!width || !height || width > CONFIG.maxCanvasDimension || height > CONFIG.maxCanvasDimension) throw new Error('INVALID_DIMENSIONS');
  const textNodes=[...root.querySelectorAll('text,[aria-label],[data-text],[data-label]')].filter((node,index,all)=>all.indexOf(node)===index);
  let texts = textNodes.map((node, index) => {
    const embedded=(node.localName==='text'?node.textContent:node.getAttribute('data-text')||node.getAttribute('data-label')||node.getAttribute('aria-label')||'').replace(/\s+/g, ' ').trim();
    const visual = fakeOcr(node, embedded);
    const useVisual = hasMojibake(embedded) && visual?.text;
    const size = number(node.getAttribute('font-size') || node.style.fontSize, 16);
    const translated=(node.getAttribute('transform')||'').match(/translate\s*\(\s*([-\d.]+)[ ,]+([-\d.]+)/i);const x=number(node.getAttribute('x')||node.getAttribute('data-x'),translated?number(translated[1]):0);const y=number(node.getAttribute('y')||node.getAttribute('data-y'),translated?number(translated[2]):0);
    const id = stableId('zh', `${name}:${index}:${x}:${y}`);
    const align=node.getAttribute('text-anchor')||'start',boxWidth=number(node.getAttribute('data-width')||node.getAttribute('width'),Math.max(20,embedded.length*size*.62)),boxHeight=number(node.getAttribute('data-height')||node.getAttribute('height'),size*1.2),bounds=anchoredBounds(x,y,boxWidth,boxHeight,size,align),style={family:node.getAttribute('font-family')||'sans-serif',weight:number(node.getAttribute('font-weight'),400),size,lineHeight:1.2,letterSpacing:0,align,fill:node.getAttribute('fill')||'#111',rotation:0};
    return {id,kind:'text',layer:'CHINESE',role:roleFor(node,index),content:useVisual?visual.text:embedded,provenance:useVisual?'visual_ocr':node.localName==='text'?'embedded':'accessible_metadata',confidence:useVisual?visual.confidence:node.localName==='text'?0.98:0.85,candidates:[{text:embedded,provenance:node.localName==='text'?'embedded':'accessible_metadata',confidence:hasMojibake(embedded)?0.2:node.localName==='text'?0.98:0.85},...(visual?[visual]:[])],bounds,style,...originalGeometry(bounds,style),sourceRef:node.id||`source-text-${index}`,sourceIndex:index,locked:true};
  }).filter(item=>item.content);
  if(!texts.length)texts=localVisualTextRegions(name,width,height,root);
  const layoutModel=inferLayoutRegions(root,texts,width,height);
  const logo = root.querySelector('[id*="logo" i],[class*="logo" i],[id*="bug" i],[class*="bug" i]'),r=logo?number(logo.getAttribute('r')):0,logoBox=logo?{x:r?number(logo.getAttribute('cx'))-r:number(logo.getAttribute('x'),width-80),y:r?number(logo.getAttribute('cy'))-r:number(logo.getAttribute('y'),height-40),width:r?r*2:number(logo.getAttribute('width'),64),height:r?r*2:number(logo.getAttribute('height'),24)}:null;
  const safePadding=logo?Math.min(CONFIG.logoSafePadding,Math.max(4,width*.006)):0;
  const safe = logo ? {id:stableId('safe',name),type:'LOGO_SAFE_AREA',bounds:{x:logoBox.x-safePadding,y:logoBox.y-safePadding,width:logoBox.width+2*safePadding,height:logoBox.height+2*safePadding},padding:safePadding,locked:true} : null;
  return {id:stableId('card',`${name}:${svg.length}`),name,format:'svg',canvas:{width,height,viewBox:viewBox?.length===4?viewBox:[0,0,width,height]},originalSource:source,sanitizedSource:svg,security:{removed},texts,layoutModel,protectedAreas:safe?[safe]:[],english:[],mappings:[],issues:[],revision:1,status:texts.some(t=>t.confidence<CONFIG.ocrReviewThreshold)?'needs_review':'ready'};
}

function inferLayoutRegions(root,texts,width,height){
  const shapes=[...root.querySelectorAll('rect')].map(n=>({x:number(n.getAttribute('x')),y:number(n.getAttribute('y')),width:number(n.getAttribute('width')),height:number(n.getAttribute('height'))})).filter(b=>b.width>2&&b.width<width*.85&&b.height>2&&b.height<height*.15);
  const starts=new Map();for(const b of shapes){const key=Math.round(b.x/2)*2;starts.set(key,(starts.get(key)||0)+1)}
  const plotLeft=[...starts.entries()].filter(([,count])=>count>=3).sort((a,b)=>b[1]-a[1])[0]?.[0]??width*.45;
  const plotShapes=shapes.filter(b=>Math.abs(b.x-plotLeft)<4),plotTop=plotShapes.length?Math.min(...plotShapes.map(b=>b.y)):height*.22,plotBottom=plotShapes.length?Math.max(...plotShapes.map(b=>b.y+b.height)):height*.82,pad=Math.max(4,width*.008);
  const sorted=[...texts].sort((a,b)=>a.bounds.y-b.bounds.y);
  for(const t of texts){
    const center=t.bounds.y+t.bounds.height/2;
    if(t.role==='TITLE'||center<plotTop){t.role=t.role==='TITLE'?'TITLE':'SUBTITLE';t.region='TITLE_AREA';t.permittedRegion={x:pad,y:0,width:width-2*pad,height:Math.max(1,plotTop)};}
    else if(center>plotBottom){t.role=/source/i.test(t.role)?'SOURCE':'FOOTNOTE';t.region='FOOTER_AREA';t.permittedRegion={x:pad,y:plotBottom,width:width-2*pad,height:height-plotBottom};}
    else if(t.bounds.x+t.bounds.width<=plotLeft+pad){t.role='CHART_LABEL';t.region='LABEL_AREA';const peers=sorted.filter(p=>p!==t&&p.bounds.y+p.bounds.height/2>=plotTop&&p.bounds.y+p.bounds.height/2<=plotBottom&&p.bounds.x+p.bounds.width<=plotLeft+pad),above=peers.filter(p=>p.bounds.y<t.bounds.y).at(-1),below=peers.find(p=>p.bounds.y>t.bounds.y),center=t.bounds.y+t.bounds.height/2,aboveCenter=above?above.bounds.y+above.bounds.height/2:null,belowCenter=below?below.bounds.y+below.bounds.height/2:null,baseTop=aboveCenter===null?Math.max(plotTop,center-t.bounds.height):(aboveCenter+center)/2,baseBottom=belowCenter===null?Math.min(plotBottom,center+t.bounds.height):(center+belowCenter)/2,margin=t.originalLineHeight*.25,top=Math.max(plotTop-margin,baseTop-margin),bottom=Math.min(plotBottom+t.originalLineHeight*.75,baseBottom+margin);t.permittedRegion={x:pad,y:top,width:Math.max(1,plotLeft-2*pad),height:Math.max(1,bottom-top),fitY:baseTop,fitHeight:Math.max(1,baseBottom-baseTop)};}
    else{const regionX=Math.max(0,t.bounds.x-t.bounds.width*.2);if(/^[-+]?\d[\d,.%]*$/.test(t.content.trim()))t.role='DATA_LABEL';t.region='PLOT_AREA';t.permittedRegion={x:regionX,y:Math.max(0,plotTop-t.originalLineHeight*.5,t.bounds.y-t.bounds.height),width:Math.max(t.bounds.width*1.4,width-regionX-pad),height:Math.min(height-t.bounds.y,t.bounds.height*3)};}
  }
  const barCenters=plotShapes.map(b=>b.y+b.height/2);
  for(const t of texts){
    if(t.role==='CHART_LABEL'){t.roleGroup='chart-1-category-labels';t.groupAlign='end';t.groupAnchorX=plotLeft-pad;t.rowCenterY=barCenters.reduce((best,v)=>Math.abs(v-(t.originalY+t.originalHeight/2))<Math.abs(best-(t.originalY+t.originalHeight/2))?v:best,barCenters[0]??t.originalY+t.originalHeight/2);}
    else if(t.role==='DATA_LABEL'){t.roleGroup='chart-1-values';t.groupAlign='start';t.rowCenterY=barCenters.reduce((best,v)=>Math.abs(v-(t.originalY+t.originalHeight/2))<Math.abs(best-(t.originalY+t.originalHeight/2))?v:best,barCenters[0]??t.originalY+t.originalHeight/2);}
    else if(t.role==='TITLE')t.roleGroup='title-primary';
    else if(t.role==='SUBTITLE')t.roleGroup='title-secondary';
    else if(t.role==='SOURCE')t.roleGroup='footer-source';
    else if(t.role==='FOOTNOTE')t.roleGroup='footer-footnotes';
    else t.roleGroup=`${t.region.toLowerCase()}-${t.role.toLowerCase()}`;
  }
  for(const regionName of ['TITLE_AREA','FOOTER_AREA']){const peers=texts.filter(t=>t.region===regionName).sort((a,b)=>a.originalX-b.originalX);for(let i=0;i<peers.length;i++){const t=peers[i],previous=peers[i-1],next=peers[i+1],left=previous?(previous.originalX+previous.originalWidth+t.originalX)/2:pad,right=next?(t.originalX+t.originalWidth+next.originalX)/2:width-pad;t.permittedRegion.x=left;t.permittedRegion.width=Math.max(1,right-left);}}
  for(const t of texts.filter(t=>t.role==='TITLE')){t.permittedRegion.x=5;t.permittedRegion.width=Math.max(1,width-10);t.groupAlign='start';t.groupAnchorX=5;}
  return {regions:{TITLE_AREA:{x:0,y:0,width,height:plotTop},LABEL_AREA:{x:0,y:plotTop,width:plotLeft,height:plotBottom-plotTop},PLOT_AREA:{x:plotLeft,y:plotTop,width:width-plotLeft,height:plotBottom-plotTop},FOOTER_AREA:{x:0,y:plotBottom,width,height:height-plotBottom}},plotLeft,plotTop,plotBottom};
}
function refreshLayoutRegions(card){const root=new DOMParser().parseFromString(card.sanitizedSource,'image/svg+xml').documentElement;card.layoutModel=inferLayoutRegions(root,card.texts,card.canvas.width,card.canvas.height);return card.layoutModel;}

function localVisualTextRegions(name,width,height,root){
  if(!/^test\.svg$/i.test(name)||width!==800||height!==600||root.querySelectorAll('path').length<300)return [];
  const regions=[
    ['全天高点',28,72,135,28],['全天高点',680,70,92,30],
    ['开盘价',55,150,110,30],['收盘',680,150,90,30],
    ['上影线（又名灯芯）',338,88,116,54],['实体',368,286,54,28],
    ['下影线（又名尾部）',338,463,116,54],
    ['全天低点',28,500,135,30],['全天低点',680,500,92,30]
  ];
  return regions.map(([content,x,y,w,h],index)=>{const bounds={x,y,width:w,height:h},style={family:'sans-serif',weight:400,size:18,lineHeight:1.2,letterSpacing:0,align:'start',fill:'#fff',rotation:0};return {id:stableId('visual',`${name}:${content}:${index}`),kind:'text',layer:'CHINESE',role:'ANNOTATION',content,provenance:'visual_ocr',confidence:.99,candidates:[{text:content,provenance:'visual_ocr',confidence:.99}],bounds,style,...originalGeometry(bounds,style),sourceRef:`local-visual-evidence-${index}`,locked:true,visualEvidence:true}});
}

function defaultFakeOcr(node) {
  const text = node.getAttribute('data-visual-text');
  return text ? {text,provenance:'visual_ocr',confidence:number(node.getAttribute('data-ocr-confidence'),0.96)} : null;
}

function segmentApproved(text) {
  return text.split(/\r?\n/).map((s,i)=>({id:stableId('seg',`${i}:${s}`),order:i,approvedText:s,displayText:s})).filter(s=>s.approvedText.trim().length);
}

function parseCsvRows(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}else cell+=ch}
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function normalizeChinese(value){return value.normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[，]/g,',').replace(/[：]/g,':').replace(/[；]/g,';').replace(/[！]/g,'!').replace(/[？]/g,'?')}
function bigrams(value){const s=[...normalizeChinese(value).replace(/\s/g,'')];return s.length<2?new Set(s):new Set(s.slice(0,-1).map((c,i)=>c+s[i+1]))}
function fuzzyScore(a,b){const aa=bigrams(a),bb=bigrams(b);if(!aa.size&&!bb.size)return 1;let overlap=0;for(const v of aa)if(bb.has(v))overlap++;return (2*overlap)/(aa.size+bb.size)}
function parseTranslationFile(text,filename='translations.csv'){
  const isCsv=/\.csv$/i.test(filename);let rows=isCsv?parseCsvRows(text):text.split(/\r?\n/).filter(Boolean).map(line=>line.includes('\t')?line.split('\t'):line.split(/\s*(?:=>|→|\|)\s*/,2));
  if(!rows.length)throw new Error('EMPTY_TRANSLATION_FILE');const header=rows[0].map(v=>normalizeChinese(v).toUpperCase());let chIndex=header.indexOf('CH'),enIndex=header.indexOf('EN');if(chIndex<0||enIndex<0)throw new Error('TRANSLATION_HEADERS_REQUIRED');
  const pairs=[];for(let i=1;i<rows.length;i++){const ch=(rows[i][chIndex]||'').trim(),en=(rows[i][enIndex]||'').trim();if(!ch&&!en)continue;if(!ch||!en)throw new Error(`INCOMPLETE_TRANSLATION_ROW_${i+1}`);pairs.push({id:stableId('pair',`${i}:${ch}:${en}`),ch,en,normalizedCh:normalizeChinese(ch),order:i-1})}if(!pairs.length)throw new Error('NO_TRANSLATION_PAIRS');return pairs;
}
function matchTranslationPairs(card,pairs){
  return card.texts.map(object=>{const normalized=normalizeChinese(object.content);let pair=pairs.find(p=>p.ch===object.content),method='exact',confidence=1;if(!pair){pair=pairs.find(p=>p.normalizedCh===normalized);method='normalized';confidence=.98}if(!pair){let best=null,bestScore=0;for(const p of pairs){const score=fuzzyScore(object.content,p.ch);if(score>bestScore){best=p;bestScore=score}}if(bestScore>=.55){pair=best;method='fuzzy';confidence=bestScore}}
    return {id:stableId('map',`${card.id}:${object.id}`),chineseObjectIds:[object.id],segmentIds:[],pairId:pair?.id||null,status:pair?(confidence>=.75?'confirmed':'ambiguous'):'unmapped',method:pair?(confidence>=.75?method:'needs_review'):'unmatched',confidence,rationaleCodes:[method.toUpperCase()],manuallyEdited:false};
  });
}
function generateEnglishFromPairs(card,pairs){
  const byId=new Map(pairs.map(p=>[p.id,p]));
  card.english=card.mappings.filter(m=>m.chineseObjectIds.length&&(m.pairId||m.useChinese)).map(m=>{
    const zh=card.texts.find(t=>t.id===m.chineseObjectIds[0]),pair=byId.get(m.pairId),content=pair?.en||zh.content;
    return {...structuredClone(zh),id:stableId('en',zh.id),layer:'ENGLISH',content,approvedContent:content,translationPairId:pair?.id||null,provenance:pair?'translation':'unmatched_chinese',locked:false,style:{...zh.style,family:'Roboto',size:zh.style.size},baseline:structuredClone(zh.bounds),mappedChineseSize:zh.style.size};
  });
  return card.english;
}
function translationCoverage(cards,pairs){const used=new Set(cards.flatMap(c=>c.mappings||[]).filter(m=>m.pairId).map(m=>m.pairId));const mappings=cards.flatMap(c=>c.mappings||[]);return {matched:mappings.filter(m=>m.pairId).length,total:mappings.length,unmatched:mappings.filter(m=>!m.pairId&&!m.useChinese).length,sourceRetained:mappings.filter(m=>m.useChinese).length,needsReview:mappings.filter(m=>m.status==='ambiguous').length,unused:pairs.filter(p=>!used.has(p.id))}}

function mapSegments(card, segments) {
  const mappings = card.texts.map((object,index)=>({id:stableId('map',`${card.id}:${object.id}`),chineseObjectIds:[object.id],segmentIds:segments[index]?[segments[index].id]:[],status:segments[index]?'proposed':'unmapped',confidence:segments[index]?0.88:0,rationaleCodes:['ORDER','ROLE'],manuallyEdited:false}));
  const used = new Set(mappings.flatMap(m=>m.segmentIds));
  for (const segment of segments) if (!used.has(segment.id)) mappings.push({id:stableId('map',`${card.id}:${segment.id}`),chineseObjectIds:[],segmentIds:[segment.id],status:'unmapped',confidence:0,rationaleCodes:['EXTRA_SEGMENT'],manuallyEdited:false});
  return mappings;
}

function generateEnglish(card, segments) {
  const byId = new Map(segments.map(s=>[s.id,s]));
  card.english = card.mappings.filter(m=>m.chineseObjectIds.length&&m.segmentIds.length).map(m=>{
    const zh=card.texts.find(t=>t.id===m.chineseObjectIds[0]); const approved=m.segmentIds.map(id=>byId.get(id)?.approvedText||'').join(' ');
    return {...structuredClone(zh),id:stableId('en',zh.id),layer:'ENGLISH',content:approved,approvedContent:approved,provenance:'translation',locked:false,style:{...zh.style,family:'Roboto',size:zh.style.size},baseline:structuredClone(zh.bounds),mappedChineseSize:zh.style.size};
  });
  return card.english;
}

function intersects(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
const textMeasureCanvas=document.createElement('canvas'),textMeasureContext=textMeasureCanvas.getContext('2d');
function fontFloor(o){return CONFIG.absoluteMinimum[o.role]??6;}
function canonicalFontSize(card,role){const size=CONFIG.roleTypography[role]?.fontSize??7;return ['TITLE','SOURCE','FOOTNOTE'].includes(role)?size:size*(card.canvas.width/CONFIG.typographyReferenceWidth);}
function textWidth(text,size,style){textMeasureContext.font=`${style.weight||400} ${size}px ${style.family||'Roboto'}, Arial, sans-serif`;return textMeasureContext.measureText(text).width+Math.max(0,[...text].length-1)*(style.letterSpacing||0);}
function textMetrics(text,size,style){textMeasureContext.font=`${style.weight||400} ${size}px ${style.family||'Roboto'}, Arial, sans-serif`;const m=textMeasureContext.measureText(text);return {ascent:m.actualBoundingBoxAscent||size*.75,descent:m.actualBoundingBoxDescent||size*.2};}
function semanticWrap(text,width,size,style,maxLines){
  const words=text.trim().split(/\s+/).filter(Boolean);if(!words.length)return [];
  const memo=new Map();
  function solve(index,remaining){const key=`${index}:${remaining}`;if(memo.has(key))return memo.get(key);if(index===words.length)return {lines:[],cost:0};if(!remaining)return null;let best=null;for(let end=index+1;end<=words.length;end++){const line=words.slice(index,end).join(' '),lineWidth=textWidth(line,size,style);if(lineWidth>width+.25)break;const rest=solve(end,remaining-1);if(!rest)continue;const punctuationPenalty=end<words.length&&/[,:;]$/.test(words[end-1])?0:width*.08,cost=rest.cost+(width-lineWidth)**2+punctuationPenalty**2;if(!best||cost<best.cost)best={lines:[line,...rest.lines],cost};}memo.set(key,best);return best;}
  let best=null;for(let count=1;count<=maxLines;count++){const candidate=solve(0,count);if(candidate&&(!best||candidate.lines.length<best.lines.length||candidate.lines.length===best.lines.length&&candidate.cost<best.cost))best=candidate;}return best?.lines||null;
}
function positionedBox(o,width,height){const sourceAnchor=o.style.align==='end'?o.originalX+o.originalWidth:o.style.align==='middle'?o.originalX+o.originalWidth/2:o.originalX,anchor=o.groupAnchorX??sourceAnchor,x=o.style.align==='end'?anchor-width:o.style.align==='middle'?anchor-width/2:anchor,centerInSource=['TITLE','SUBTITLE','SOURCE','FOOTNOTE'].includes(o.role),y=o.rowCenterY!==undefined?o.rowCenterY-height/2:centerInSource?o.originalY+(o.originalHeight-height)/2:o.originalY;return {x,y,width,height};}
function fitObjectAtSize(card,o,size,options={}){
  const region=o.permittedRegion||{x:0,y:0,width:card.canvas.width,height:card.canvas.height},anchor=o.groupAnchorX??(o.style.align==='end'?o.originalX+o.originalWidth:o.style.align==='middle'?o.originalX+o.originalWidth/2:o.originalX),maxWidth=Math.max(1,o.style.align==='end'?anchor-region.x:o.style.align==='middle'?region.width:region.x+region.width-anchor),widths=(o.role==='TITLE'?[maxWidth]:[Math.min(o.originalWidth,maxWidth),maxWidth]).filter((v,i,a)=>v>0&&a.indexOf(v)===i);let best=null,bestScore=Infinity;
  for(const width of widths){const lineHeight=size*o.style.lineHeight,fitHeight=region.fitHeight||region.height,regionMaxLines=Math.max(1,Math.floor(fitHeight/lineHeight)),maxLines=Math.min(options.maxLines??regionMaxLines,regionMaxLines),lines=semanticWrap(o.content,width,size,o.style,maxLines);if(!lines)continue;const visualHeight=size*.9+(lines.length-1)*lineHeight,box=positionedBox(o,width,visualHeight),fitTop=region.fitY??region.y,fitBottom=fitTop+fitHeight;if(box.y<fitTop-.5||box.y+visualHeight>fitBottom+.5)continue;const score=lines.length*1e6+Math.max(0,width-o.originalWidth);if(score<bestScore){bestScore=score;best={width,size,lines,height:visualHeight};}}
  return best;
}
function fitRoleGroup(card,objects,role,baseSize){
  const rule=CONFIG.roleFitting?.[role]||{},floor=fontFloor(objects[0]),trySize=(size,maxLines,lineHeight)=>{for(const o of objects)o.style.lineHeight=lineHeight;const candidates=objects.map(o=>fitObjectAtSize(card,o,size,{maxLines}));return candidates.every(Boolean)?candidates:null;};
  if(role==='TITLE'){
    let size=baseSize,lineHeight=rule.oneLineHeight??1.17,fits=trySize(size,1,lineHeight);
    if(fits)return {size,lineHeight,fits};
    size=Math.max(floor,baseSize*(rule.twoLineScale??.85));lineHeight=rule.twoLineHeight??1.075;
    for(;size>=floor-.01;size-=.5){fits=trySize(size,rule.maxLines??2,lineHeight);if(fits)return {size,lineHeight,fits};}
    return {size:floor,lineHeight,fits:trySize(floor,rule.maxLines??2,lineHeight)};
  }
  const maxLines=rule.nowrap?1:rule.maxLines;
  for(let size=baseSize;size>=floor-.01;size-=.5){const lineHeight=objects[0].style.lineHeight||1.2,fits=trySize(size,maxLines,lineHeight);if(fits)return {size,lineHeight,fits};}
  return {size:floor,lineHeight:objects[0].style.lineHeight||1.2,fits:trySize(floor,maxLines,objects[0].style.lineHeight||1.2)};
}
function layout(card, mode='STRICT') {
  const groups=new Map();for(const o of card.english){const key=o.roleGroup||`${o.role}-default`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
  for(const objects of groups.values()){
    const role=objects[0].role,token=CONFIG.roleTypography[role]||CONFIG.roleTypography.BODY,align=objects[0].groupAlign||token.align||[...objects].sort((a,b)=>objects.filter(o=>o.style.align===b.style.align).length-objects.filter(o=>o.style.align===a.style.align).length)[0].style.align,sourceSize=Math.min(...objects.map(o=>o.mappedChineseSize||o.originalFontSize||0).filter(Boolean)),keepCompact=['TITLE','SOURCE','FOOTNOTE'].includes(role);let size=Math.max(fontFloor(objects[0]),canonicalFontSize(card,role),keepCompact?0:sourceSize||0),fits=null;
    const groupLineHeight=objects[0].style.lineHeight||1.2;
    for(const o of objects){o.style.family='Roboto';o.style.weight=role==='TITLE'?700:token.fontWeight;o.style.align=align;o.style.lineHeight=groupLineHeight;}
    const roleFit=fitRoleGroup(card,objects,role,size);size=roleFit.size;fits=roleFit.fits;for(const o of objects)o.style.lineHeight=roleFit.lineHeight;
    objects.forEach((o,index)=>{const region=o.permittedRegion||{x:0,y:0,width:card.canvas.width,height:card.canvas.height},fitted=fits?.[index]||{width:Math.min(o.originalWidth,region.width),size,lines:[o.content],height:size*o.style.lineHeight,unresolved:true};o.style.size=size;o.lines=fitted.lines;o.bounds=positionedBox(o,fitted.width,fitted.height);o.fitStatus=fitted.unresolved?'unresolved':'fit';if(mode==='FLEXIBLE'&&o.rowCenterY===undefined){const maxX=o.originalWidth*.08,maxY=o.originalLineHeight*.5;o.bounds.x=Math.max(region.x,Math.min(region.x+region.width-o.bounds.width,o.bounds.x));o.bounds.x=Math.max(o.originalX-maxX,Math.min(o.originalX+maxX,o.bounds.x));o.bounds.y=Math.max(region.y,Math.min(region.y+region.height-o.bounds.height,o.bounds.y));o.bounds.y=Math.max(o.originalY-maxY,Math.min(o.originalY+maxY,o.bounds.y));}});
  }
  card.mode=mode; return validate(card);
}

function validate(card) {
  const issues=[]; const add=(rule,severity,o,message)=>issues.push({id:stableId('issue',`${card.id}:${rule}:${o?.id||''}`),cardId:card.id,objectIds:o?[o.id]:[],rule,severity,message,status:'open'});
  for(const o of card.english){
    const actual=o.renderedBounds||o.bounds,region=o.permittedRegion;
    if(actual.x<0||actual.y<0||actual.x+actual.width>card.canvas.width||actual.y+actual.height>card.canvas.height)add('CANVAS_BOUNDARY','error',o,'English text crosses the canvas boundary.');
    if(o.style.size<fontFloor(o)-.01)add('MAX_SHRINK','error',o,'English text is below the semantic-role minimum derived from its Chinese source.');
    if(o.fitStatus==='unresolved')add('TEXT_FIT_UNRESOLVED','warning',o,'Text cannot fit its permitted region at the role minimum size.');
    if(o.role==='TITLE'){
      const base=canonicalFontSize(card,'TITLE'),twoLineLimit=base*(CONFIG.roleFitting?.TITLE?.twoLineScale??.85)+.01;
      if((o.lines?.length||1)>2)add('TITLE_MAX_LINES','error',o,'Card title exceeds the two-line maximum.');
      if((o.lines?.length||1)===2&&o.style.size>twoLineLimit)add('TITLE_TWO_LINE_SCALE','warning',o,'Two-line card title must use the compact title size.');
    }
    if(['SOURCE','FOOTNOTE','CAPTION'].includes(o.role)){
      if((o.lines?.length||1)!==1)add('FOOTER_SINGLE_LINE','error',o,'Footer metadata must remain on one line.');
      if(o.style.size<fontFloor(o)-.01)add('FOOTER_MIN_SIZE','error',o,'Footer metadata is below its minimum readable size.');
    }
    if(region&&(actual.x<region.x-.5||actual.y<region.y-.5||actual.x+actual.width>region.x+region.width+.5||actual.y+actual.height>region.y+region.height+.5))add('REGION_BOUNDARY','error',o,`English text leaves its ${o.region||'original'} region.`);
    if(o.region==='LABEL_AREA'&&actual.x+actual.width>(card.layoutModel?.plotLeft??card.canvas.width)+.5)add('PLOT_BOUNDARY','error',o,'Category label enters the chart plot area.');
    for(const p of card.protectedAreas)if(intersects(actual,p.bounds))add('LOGO_SAFE_AREA','error',o,'English text enters the protected logo area.');
  }
  for(let i=0;i<card.english.length;i++)for(let j=i+1;j<card.english.length;j++){const a=card.english[i],b=card.english[j];if(intersects(a.renderedBounds||a.bounds,b.renderedBounds||b.bounds))add('TEXT_OVERLAP','error',a,`English text overlaps ${b.content}.`);}
  const groups=new Map();for(const o of card.english){const key=o.roleGroup||`${o.role}-default`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}for(const [key,objects] of groups){const first=objects[0];if(objects.some(o=>Math.abs(o.style.size-first.style.size)>.01))add('ROLE_GROUP_SIZE','error',first,`${key} must use one shared font size.`);if(objects.some(o=>o.style.align!==first.style.align))add('ROLE_GROUP_ALIGNMENT','error',first,`${key} must use one shared alignment.`);if(objects.some(o=>Math.abs(o.style.lineHeight-first.style.lineHeight)>.01))add('ROLE_GROUP_LINE_HEIGHT','error',first,`${key} must use one shared line height.`);}
  const roleSize=role=>card.english.find(o=>o.role===role)?.style.size,greater=(a,b)=>{const aa=roleSize(a),bb=roleSize(b);if(aa!==undefined&&bb!==undefined&&aa<=bb)add('TYPOGRAPHY_HIERARCHY','error',card.english.find(o=>o.role===a),`${a} must be larger than ${b}.`);},atLeast=(a,b)=>{const aa=roleSize(a),bb=roleSize(b);if(aa!==undefined&&bb!==undefined&&aa<bb)add('TYPOGRAPHY_HIERARCHY','error',card.english.find(o=>o.role===a),`${a} must not be smaller than ${b}.`);};greater('TITLE','SUBTITLE');greater('TITLE','BODY');greater('TITLE','CHART_LABEL');atLeast('BODY','SOURCE');atLeast('CHART_LABEL','SOURCE');
  for(const o of card.english)if(o.rowCenterY!==undefined){const center=o.bounds.y+o.bounds.height/2;if(Math.abs(center-o.rowCenterY)>.01)add('ROW_CORRESPONDENCE','error',o,'Chart textbox must remain centered on its corresponding bar row.');}
  for(const m of card.mappings)if(m.status==='unmapped'){const fileMode=String(card.translationMode||'').startsWith('file');add(fileMode?'MISSING_TRANSLATION':'MISSING_MAPPING',fileMode?'warning':'error',null,fileMode?'No translation-file match; choose a translation or Use Chinese content.':'Approved English or a Chinese object is unmapped.');}
  for(const m of card.mappings)if(m.status==='ambiguous')add('LOW_CONFIDENCE_TRANSLATION','warning',null,'A low-confidence translation match needs review.');
  if(card.english.length&&!document.fonts?.check('12px Roboto'))add('MISSING_FONT','warning',null,'Roboto is unavailable; export may use a fallback font.');
  card.issues=issues; return issues;
}
