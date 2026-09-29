const path=require('path');
const fs=require('fs');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();
  await page.goto('file://'+path.resolve(__dirname,'../index.html'));
  const source=fs.readFileSync(path.resolve(__dirname,'../fixtures/svg-generic.svg'),'utf8');
  const result=await page.evaluate(source=>{
    const pkg=CLV2SVG.importSvg(source,'generic.svg'),board=pkg.document.artboards[0],before=new DOMParser().parseFromString(board.svgSource,'image/svg+xml'),noOp=CLV2SVG.writeBack(board,[],{scaleX:1,scaleY:1,offsetX:0,offsetY:0}),after=new DOMParser().parseFromString(noOp,'image/svg+xml'),pairs=CLV2.parseTxt('住房需求持续增长\tHousing demand continues to grow'),matches=CLV2.match(board.textFrames,pairs),frame=board.textFrames.find(item=>item.sourceText==='住房需求持续增长'),mapping=matches.find(item=>item.frameId===frame.id),object={...mapping,source:frame,originalSource:frame,english:mapping.english,sourceRetained:false,layout:{...frame.bounds,fontSize:frame.style.fontSize,lineHeight:frame.style.fontSize*1.2,lines:['Housing demand','continues to grow']}};
    const translated=CLV2SVG.writeBack(board,[object],{scaleX:1,scaleY:1,offsetX:0,offsetY:0}),translatedDoc=new DOMParser().parseFromString(translated,'image/svg+xml');
    const noText=CLV2SVG.importSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0h20v20z"/></svg>','outlined.svg').document.artboards[0];
    const paths=Array.from({length:2000},(_,index)=>`<path d="M${index%100} ${index%100}h1"/>`).join('');
    const started=performance.now(),large=CLV2SVG.importSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(1 1)">${paths}<text x="5" y="10">Fast</text></g></svg>`,'many-paths.svg').document.artboards[0],largeMs=performance.now()-started;
    return {sourceType:pkg.document.sourceType,frames:board.textFrames.map(item=>item.sourceText),scripts:before.querySelectorAll('script').length,onload:before.documentElement.hasAttribute('onload'),pathBefore:before.querySelector('path')?.getAttribute('d'),pathAfter:after.querySelector('path')?.getAttribute('d'),translatedPath:translatedDoc.querySelector('path')?.getAttribute('d'),clipAfter:!!after.querySelector('clipPath'),gradientAfter:!!after.querySelector('linearGradient'),maskAfter:!!after.querySelector('mask'),imageAfter:after.querySelector('image')?.getAttribute('href'),translatedImage:translatedDoc.querySelector('image')?.getAttribute('href'),translatedText:[...translatedDoc.querySelectorAll('text,tspan')].map(node=>node.textContent).join('|'),unrelatedText:[...translatedDoc.querySelectorAll('text,tspan')].some(node=>node.textContent.includes('旋转标签')),editable:translatedDoc.querySelectorAll('text').length>0,matched:mapping.english,noTextFrames:noText.textFrames.length,noTextWarning:noText.warnings[0]?.code,largeFrames:large.textFrames.length,largeGraphics:large.graphicElements.length,largeMs};
  },source);
  console.log(JSON.stringify(result,null,2));
  if(result.sourceType!=='svg'||result.scripts||result.onload)throw new Error('SVG routing or sanitization failed');
  if(result.pathBefore!==result.pathAfter||!result.clipAfter||!result.gradientAfter||!result.maskAfter||!result.imageAfter?.startsWith('data:image/png'))throw new Error('No-op artwork preservation failed');
  if(!result.frames.includes('住房需求持续增长')||!result.frames.includes('第一行说明文字，第二行属于同一句。')||!result.frames.includes('2024')||!result.frames.includes('2025'))throw new Error('Generic text extraction/grouping failed');
  if(result.matched!=='Housing demand continues to grow'||!result.editable||!result.translatedText.includes('Housing demand')||!result.unrelatedText||result.translatedPath!==result.pathBefore||result.translatedImage!==result.imageAfter)throw new Error('TXT matching or editable write-back failed');
  if(result.noTextFrames!==0||result.noTextWarning!=='NO_EDITABLE_SVG_TEXT')throw new Error('Outlined/no-text fallback failed');
  if(result.largeFrames!==1||result.largeGraphics!==0||result.largeMs>2500)throw new Error('Large vector artwork was parsed semantically or imported too slowly');
  await page.locator('#packageInput').setInputFiles(path.resolve(__dirname,'../fixtures/svg-generic.svg'));
  await page.waitForFunction(()=>document.querySelector('#projectName')?.textContent==='generic');
  await page.locator('#csvInput').setInputFiles({name:'translations.txt',mimeType:'text/plain',buffer:Buffer.from('住房需求持续增长\tHousing demand continues to grow')});
  await page.waitForFunction(()=>document.querySelector('#outputCanvas')?.textContent.includes('Housing demand continues to grow'));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
