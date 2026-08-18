#target illustrator

(function () {
  if (!app.documents.length) { alert('Open the matching original Illustrator document first.'); return; }
  var doc = app.activeDocument;
  var resultFile = File.openDialog('Choose a ChartLingoV2 result', 'ChartLingo result:*.chartlingo-result;*.json');
  if (!resultFile) return;
  resultFile.encoding = 'UTF-8'; resultFile.open('r'); var raw = resultFile.read(); resultFile.close();
  var result;
  function jsonParse(value) {
    if (!/^[\],:{}\s]*$/.test(value.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) throw new Error('Unsafe JSON');
    return eval('(' + value + ')');
  }
  try { result = jsonParse(raw); } catch (_) { alert('The result file is not valid JSON.'); return; }
  if (!result || result.schema !== 'https://chartlingo.local/schemas/result-v2.json') { alert('This is not a ChartLingoV2 result.'); return; }
  var expected = 'cl-doc-' + doc.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase();
  if (result.sourceDocument.id !== expected && !confirm('The result document ID does not match this Illustrator file. Continue anyway?')) return;
  var output = File.saveDialog('Save editable English Illustrator file', 'Adobe Illustrator:*.ai');
  if (!output) return;
  if (!/\.ai$/i.test(output.name)) output = new File(output.fsName + '.ai');

  function sourceFrameId(id) { var match = /^(cl-tf-\d+-\d+)(?:-r\d+-c\d+)?$/.exec(id); return match ? match[1] : id; }
  function framesOnArtboard(index) {
    var rect = doc.artboards[index].artboardRect, list = [];
    for (var i = 0; i < doc.textFrames.length; i++) {
      var b = doc.textFrames[i].visibleBounds, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (cx >= rect[0] && cx <= rect[2] && cy <= rect[1] && cy >= rect[3] && doc.textFrames[i].editable && !doc.textFrames[i].hidden) list.push(doc.textFrames[i]);
    }
    return list;
  }
  var sourceById = {}, a, i;
  for (a = 0; a < doc.artboards.length; a++) {
    var list = framesOnArtboard(a);
    for (i = 0; i < list.length; i++) sourceById['cl-tf-' + (a + 1) + '-' + (i + 1)] = list[i];
  }
  var englishLayer;
  try { englishLayer = doc.layers.getByName('English - ChartLingoV2'); } catch (_) { englishLayer = doc.layers.add(); englishLayer.name = 'English - ChartLingoV2'; }
  englishLayer.visible = true; englishLayer.locked = false;
  var applied = 0, missing = 0, missingRoboto = 0;
  for (a = 0; a < result.artboards.length; a++) {
    var board = result.artboards[a], artboardIndex = a, rect = doc.artboards[artboardIndex].artboardRect;
    for (i = 0; i < board.textFrames.length; i++) {
      var change = board.textFrames[i], source = sourceById[sourceFrameId(change.id)];
      if (!source) { missing++; continue; }
      var target = source.duplicate(englishLayer, ElementPlacement.PLACEATEND), layout = change.layout;
      target.contents = change.english;
      target.name = 'EN ' + (source.name || change.id);
      try { target.textRange.characterAttributes.size = layout.fontSize; } catch (_) {}
      try { target.textRange.characterAttributes.leading = layout.lineHeight; } catch (_) {}
      try { target.textRange.characterAttributes.textFont = app.textFonts.getByName(change.style.fontPostScriptName || 'Roboto-Regular'); } catch (_) { missingRoboto++; }
      var scale = board.outputCanvas && (board.outputCanvas.scale || board.outputCanvas.scaleX) ? (board.outputCanvas.scale || board.outputCanvas.scaleX) : 1;
      try { target.textRange.characterAttributes.size = layout.fontSize / scale; target.textRange.characterAttributes.leading = layout.lineHeight / scale; } catch (_) {}
      try { target.left = rect[0] + layout.x / scale; target.top = rect[1] - layout.y / scale; } catch (_) {}
      try { if (target.kind === TextType.AREATEXT) { target.width = layout.width / scale; target.height = layout.height / scale; } } catch (_) {}
      applied++;
    }
  }
  var options = new IllustratorSaveOptions(); options.pdfCompatible = true; doc.saveAs(output, options);
  alert('English result applied and saved:\n' + output.fsName + '\n\nApplied: ' + applied + '\nMissing source frames: ' + missing + '\nRoboto substitutions: ' + missingRoboto + '\n\nReview overflow and fonts before publishing.');
})();
