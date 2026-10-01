const path=require('path');
const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();
  await page.goto('file://'+path.resolve(__dirname,'../index.html'));
  const result=await page.evaluate(()=>{
    const frame=(id,sourceText,prefixGlyph,prefixFill,y)=>({
      id,name:id,sourceText,visibleLines:[sourceText],kind:'point-text',role:'BODY',
      bounds:{x:20,y,width:220,height:30},permittedRegion:{x:20,y,width:220,height:40},
      style:{fontFamily:'Noto Sans SC',fontSize:18,fontWeight:400,lineHeight:1.2,alignment:'left',fill:'#111111'},
      preservePrefixGlyph:true,prefixGlyph,prefixStyle:{fill:prefixFill}
    });
    const frames=[
      frame('gray','2025年6月','■','#777777',20),
      frame('red','2026年6月','■','#e90044',60),
      frame('up','1.59%','▲','#111111',100),
      frame('down','5.59%','▼','#111111',140),
      {...frame('suffix','目标','',null,170),preservePrefixGlyph:false,prefixGlyph:'',prefixStyle:{},preserveSuffixGlyph:true,suffixGlyph:'◆',suffixStyle:{fill:'#336699'}},
      {id:'legacy',name:'legacy',sourceText:'旧文字',visibleLines:['旧文字'],kind:'point-text',role:'BODY',bounds:{x:20,y:205,width:220,height:30},permittedRegion:{x:20,y:205,width:220,height:35},style:{fontFamily:'Noto Sans SC',fontSize:18,fontWeight:400,lineHeight:1.2,alignment:'left',fill:'#111111'}}
    ];
    const preview='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 240"><rect id="preview-marker" width="300" height="240" fill="#fff"/></svg>';
    const pkg=CLV2.validatePackage({schema:'https://chartlingo.local/schemas/package-v2.json',schemaVersion:'2.0.0',generator:{name:'test',version:'1'},document:{id:'glyph-test',name:'glyph-test',sourceApp:'test',artboards:[{id:'board',name:'Board',bounds:{x:0,y:0,width:300,height:240},previewSvg:preview,artworkSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 240"></svg>',textFrames:frames,graphicElements:[],imageObjects:[]}]}});
    const board=pkg.document.artboards[0],pairs=CLV2.parseTxt('2025年6月\tJun 2025\n2026年6月\tJun 2026\n1.59%\t1.59%\n5.59%\t5.59%\n目标\tTarget\n旧文字\tLegacy text'),matches=CLV2.match(board.textFrames,pairs);
    state.pkg=pkg;state.active=0;state.objects.clear();state.cropWindows.clear();state.outputModes.clear();
    const scale=outputSpec(board).scale,translations={gray:'Jun 2025',red:'Jun 2026',up:'1.59%',down:'5.59%',suffix:'Target',legacy:'Legacy text'};
    const objects=board.textFrames.map(source=>{const output={...source,bounds:mappedBounds(source.bounds,outputSpec(board)),permittedRegion:mappedBounds(source.permittedRegion,outputSpec(board)),style:{...source.style,fontSize:source.style.fontSize*scale}},english=translations[source.id],object={frameId:source.id,pairId:source.id,english,sourceText:source.sourceText,method:'exact',confidence:1,confirmed:true,sourceRetained:false,numericLocked:false,source:output,originalSource:source,lineBreakMode:'auto',manualLines:[],translationLayout:{mode:'auto',manualLines:[]},layout:{...output.bounds,fontSize:output.style.fontSize,lineHeight:output.style.fontSize*1.2,lines:[english],overflow:false}};return object});
    state.objects.set(board.id,objects);
    const rendered=englishSvg(board,true),doc=new DOMParser().parseFromString(rendered,'image/svg+xml'),text=id=>doc.querySelector(`[data-id="${id}"] text`)?.textContent,fill=id=>doc.querySelector(`[data-id="${id}"] [data-chartlingo-preserved-glyph="prefix"]`)?.getAttribute('fill'),legacyGlyphs=doc.querySelectorAll('[data-id="legacy"] [data-chartlingo-preserved-glyph]').length;
    const decorated=decorateExportTextObjects(rendered,board,objects),exported=illustratorCompatibleSvg(decorated),exportDoc=new DOMParser().parseFromString(exported,'image/svg+xml');
    const longObject={...objects[0],english:'Proportion of population aged 65 and above',layout:{...objects[0].layout,width:180,lines:['Proportion of population','aged 65 and above']}};
    const wrapped=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><text>${longObject.layout.lines.map((line,index)=>partialColorLineMarkup(longObject,line,index,0,longObject.layout.lineHeight)).join('')}</text></svg>`,'image/svg+xml');
    return {
      metadataPreserved:board.textFrames[0].prefixGlyph==='■'&&board.textFrames[0].prefixStyle.fill==='#777777',
      exactMatches:matches.every(match=>match.method==='exact'&&match.pairId),
      gray:text('gray'),red:text('red'),up:text('up'),down:text('down'),suffix:text('suffix'),legacy:text('legacy'),
      grayFill:fill('gray'),redFill:fill('red'),legacyGlyphs,
      sourceUsesPreview:sourceSvg(board).includes('preview-marker'),
      exportGlyph:exportDoc.querySelector('[data-chartlingo-text-id="gray"] [data-chartlingo-preserved-glyph="prefix"]')?.textContent,
      exportEditable:exportDoc.querySelector('[data-chartlingo-text-id="gray"]')?.tagName.toLowerCase()==='text',
      wrappedFirst:wrapped.querySelector('text > tspan:first-child')?.textContent,
      wrappedSecond:wrapped.querySelector('text > tspan:nth-child(2)')?.textContent
    };
  });
  console.log(JSON.stringify(result,null,2));
  if(!result.metadataPreserved||!result.exactMatches)throw new Error('Optional metadata preservation or matching regressed');
  if(result.gray!=='■ Jun 2025'||result.red!=='■ Jun 2026'||result.up!=='▲ 1.59%'||result.down!=='▼ 5.59%'||result.suffix!=='Target ◆')throw new Error('Preserved glyph content is missing or incorrectly spaced');
  if(result.grayFill!=='#777777'||result.redFill!=='#e90044'||result.grayFill===result.redFill)throw new Error('Preserved glyph colors were not retained independently');
  if(result.legacy!=='Legacy text'||result.legacyGlyphs!==0)throw new Error('Legacy rendering changed');
  if(!result.sourceUsesPreview)throw new Error('Chinese Source no longer uses previewSvg');
  if(result.exportGlyph!=='■ '||!result.exportEditable)throw new Error('Editable SVG export lost the glyph');
  if(!result.wrappedFirst.startsWith('■ ')||result.wrappedSecond.startsWith('■'))throw new Error('Prefix glyph did not stay on the first translated line');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
