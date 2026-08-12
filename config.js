const CONFIG = Object.freeze({
  maxFiles: 20,
  maxPdfPages: 20,
  maxUploadBytes: 5 * 1024 * 1024,
  maxCanvasDimension: 12000,
  logoSafePadding: 16,
  ocrReviewThreshold: 0.8,
  mappingReviewThreshold: 0.75,
  exportWarningPolicy: 'acknowledge',
  typographyReferenceWidth: 670,
  roleTypography: Object.freeze({
    TITLE:{fontSize:13.5,fontWeight:700,align:'start'},SUBTITLE:{fontSize:9,fontWeight:500,align:'start'},BODY:{fontSize:8,fontWeight:400,align:'start'},ANNOTATION:{fontSize:7,fontWeight:400,align:'start'},DATA_LABEL:{fontSize:7,fontWeight:400},AXIS_LABEL:{fontSize:7,fontWeight:400},LEGEND:{fontSize:7,fontWeight:400,align:'start'},CHART_LABEL:{fontSize:8,fontWeight:400},SOURCE:{fontSize:9,fontWeight:400,align:'start'},FOOTNOTE:{fontSize:9,fontWeight:400,align:'start'},CAPTION:{fontSize:7,fontWeight:400,align:'start'}
  }),
  roleFitting: Object.freeze({
    TITLE:Object.freeze({oneLineScale:1,twoLineScale:.85,maxLines:2,oneLineHeight:1.17,twoLineHeight:1.075}),
    SOURCE:Object.freeze({maxLines:1,nowrap:true}),
    FOOTNOTE:Object.freeze({maxLines:1,nowrap:true}),
    CAPTION:Object.freeze({maxLines:1,nowrap:true})
  }),
  absoluteMinimum: Object.freeze({TITLE:10,SUBTITLE:8,BODY:7,ANNOTATION:6,DATA_LABEL:6,AXIS_LABEL:6,LEGEND:6,CHART_LABEL:6,SOURCE:5,FOOTNOTE:5,CAPTION:6}),
  flexibleDisplacement: Object.freeze({TITLE:32,SUBTITLE:32,BODY:32,ANNOTATION:16,DATA_LABEL:8,AXIS_LABEL:8,LEGEND:12,SOURCE:16,FOOTNOTE:16,CAPTION:16})
});
