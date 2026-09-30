const path=require('path');
const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();
  await page.goto('file://'+path.resolve(__dirname,'../index.html'));
  const result=await page.evaluate(()=>{
    const pair={id:'field-1',ch:'对AI环境成本或效益了解不足',en:'Insufficient understanding of AI costs or benefits'};
    const artboard={id:'board',name:'Board',bounds:{x:0,y:0,width:600,height:500},previewSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500"></svg>',artworkSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500"></svg>',textFrames:[],graphicElements:[],imageObjects:[]};
    const fragment=(id,text,x,y)=>{const bounds={x,y,width:150,height:24},style={fontFamily:'Noto Sans SC',fontSize:16,fontWeight:400,lineHeight:1.2,alignment:'left',fill:'#132b45'},source={id,sourceText:text,bounds:{...bounds},permittedRegion:{...bounds},visibleLines:[text],style:{...style}},originalSource={...source,bounds:{...bounds},style:{...style}};return {frameId:id,sourceText:text,english:text,sourceRetained:true,source,originalSource,layout:{...bounds,fontSize:16,lineHeight:19.2,lines:[text],overflow:false},multiFieldMatches:[],mergedInto:null,separatedInto:null};};
    const list=[
      fragment('a1','对AI环境成本或',30,30),fragment('a2','效益了解不足',30,60),
      fragment('b1','对AI',340,220),fragment('b2','环境成本或效益',340,250),fragment('b3','了解不足',340,280)
    ];
    state.pkg={document:{artboards:[artboard]}};state.active=0;state.pairs=[pair,{...pair,id:'field-duplicate'}];state.objects=new Map([[artboard.id,list]]);state.issues=projectMismatchIssues();
    const rows=mismatchChecklistEntries(),markup=fragmentedReplacementMarkup(rows[0].issue,0,pair),markupDoc=new DOMParser().parseFromString(`<body>${markup}</body>`,'text/html'),groups=fragmentGroupsForPair(pair);
    const replacements=groups.map(group=>replaceFragmentGroup(pair,group)).filter(Boolean),rendered=new DOMParser().parseFromString(englishSvg(artboard,true),'image/svg+xml'),renderedIds=[...rendered.querySelectorAll('.english-object')].map(node=>node.getAttribute('data-id')),postApplyIssueCount=projectMismatchIssues().length;
    return {issueCount:state.issues.length,rowCount:rows.length,groupCount:groups.length,currentLineCount:markupDoc.querySelectorAll('.format-choice-lines span').length,scopeText:markupDoc.querySelector('.fragmented-copy > strong')?.textContent,replacementIds:replacements.map(item=>item.frameId),replacementPositions:replacements.map(item=>[item.layout.x,item.layout.y]),renderedIds,postApplyIssueCount};
  });
  console.log(JSON.stringify(result,null,2));
  if(result.issueCount!==2||result.rowCount!==1||result.groupCount!==2)throw new Error('Repeated source text was not consolidated into one mismatch action');
  if(result.currentLineCount!==2||!result.scopeText.includes('2 separate items'))throw new Error('Mismatch UI did not show one representative structure and the correct scope');
  if(new Set(result.replacementIds).size!==2||new Set(result.renderedIds).size!==2)throw new Error('Repeated replacements do not have independent editor identities');
  if(result.replacementPositions[0][0]===result.replacementPositions[1][0]&&result.replacementPositions[0][1]===result.replacementPositions[1][1])throw new Error('Repeated replacements lost their independent positions');
  if(result.postApplyIssueCount!==0)throw new Error('A duplicate CSV row reopened the mismatch after the selected match was applied');
  await page.evaluate(()=>{
    const artboard=state.pkg.document.artboards[0],bounds={x:40,y:40,width:180,height:30},style={fontFamily:'Noto Sans SC',fontSize:16,fontWeight:400,lineHeight:1.2,alignment:'left',fill:'#132b45'},source={id:'regular',sourceText:'明显不利',bounds:{...bounds},permittedRegion:{...bounds},visibleLines:['明显不利'],style:{...style}},object={frameId:'regular',pairId:null,english:'明显不利',sourceText:'明显不利',sourceRetained:true,source,originalSource:structuredClone(source),layout:{...bounds,fontSize:16,lineHeight:19.2,lines:['明显不利'],overflow:false},multiFieldMatches:[],mergedInto:null,separatedInto:null};
    state.pairs=[{id:'choice-a',ch:'明显不利',en:'Clearly unfavorable'},{id:'choice-b',ch:'明显不利',en:'Significantly detrimental'}];state.objects=new Map([[artboard.id,[object]]]);state.issues=[{severity:'warning',rule:'UNMATCHED_GRAPHIC_TEXT',status:'mapping_missing',message:'Choose a CSV field.',objectId:object.frameId,dataMismatch:true,artboardId:artboard.id,artboardName:artboard.name}];openMismatchChecklist();
  });
  await page.locator('.mismatch-checklist-row select').selectOption('choice-b');
  await page.evaluate(()=>openMismatchChecklist());
  const autoChecked=await page.locator('.mismatch-checklist-row .mismatch-check input').isChecked(),selectedSource=await page.locator('.mismatch-checklist-row .mismatch-row-copy strong').textContent();
  await page.locator('#confirmSeparation').click();
  const panelClosed=await page.locator('#dataMismatchPanel').isHidden(),applied=await page.evaluate(()=>state.objects.get('board')[0].pairId==='choice-b'),remainingRows=await page.locator('.mismatch-checklist-row').count();
  if(!autoChecked||selectedSource!=='明显不利'||!applied||!panelClosed||remainingRows!==0)throw new Error('Selecting a CSV field did not update the source, auto-select, apply once, and remove the final mismatch');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
