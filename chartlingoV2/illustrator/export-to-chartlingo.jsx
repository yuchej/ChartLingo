#target illustrator

(function () {
  if (!app.documents.length) { alert('Open an Illustrator document first.'); return; }
  var doc = app.activeDocument;
  var destination = File.saveDialog('Export ChartLingoV2 package', 'ChartLingo package:*.chartlingo');
  if (!destination) return;
  if (!/\.chartlingo$/i.test(destination.name)) destination = new File(destination.fsName + '.chartlingo');

  function jsonQuote(value) {
    var escapes = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
    return '"' + String(value).replace(/["\\\x00-\x1f\x7f-\x9f]/g, function (character) {
      if (escapes[character]) return escapes[character];
      var code = character.charCodeAt(0).toString(16);
      return '\\u' + ('0000' + code).slice(-4);
    }) + '"';
  }
  function jsonStringify(value, indent, level) {
    indent = indent || ''; level = level || 0;
    if (value === null) return 'null';
    var type = typeof value;
    if (type === 'string') return jsonQuote(value);
    if (type === 'number') return isFinite(value) ? String(value) : 'null';
    if (type === 'boolean') return value ? 'true' : 'false';
    var current = '', next = '', parts = [], i, key;
    for (i = 0; i < level; i++) current += indent;
    next = current + indent;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) parts.push(next + jsonStringify(value[i], indent, level + 1));
      return parts.length ? '[\n' + parts.join(',\n') + '\n' + current + ']' : '[]';
    }
    if (type === 'object') {
      for (key in value) if (value.hasOwnProperty(key) && typeof value[key] !== 'undefined' && typeof value[key] !== 'function') parts.push(next + jsonQuote(key) + ': ' + jsonStringify(value[key], indent, level + 1));
      return parts.length ? '{\n' + parts.join(',\n') + '\n' + current + '}' : '{}';
    }
    return 'null';
  }

  function clean(value) { return String(value || '').replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function frameId(artboardIndex, frameIndex) { return 'cl-tf-' + (artboardIndex + 1) + '-' + (frameIndex + 1); }
  function artboardFor(bounds) {
    var cx = (bounds[0] + bounds[2]) / 2, cy = (bounds[1] + bounds[3]) / 2;
    for (var i = 0; i < doc.artboards.length; i++) {
      var r = doc.artboards[i].artboardRect;
      if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) return i;
    }
    return 0;
  }
  function localBounds(bounds, rect) {
    return {x: bounds[0] - rect[0], y: rect[1] - bounds[1], width: bounds[2] - bounds[0], height: bounds[1] - bounds[3]};
  }
  function visibleLines(frame) {
    var values = [];
    try { for (var i = 0; i < frame.lines.length; i++) values.push(clean(frame.lines[i].contents)); } catch (_) {}
    return values.length ? values : [clean(frame.contents)];
  }
  function role(frame, index) {
    var hint = (frame.name + ' ' + frame.layer.name).toLowerCase();
    if (/title|headline/.test(hint) || index === 0) return 'TITLE';
    if (/sub|deck/.test(hint)) return 'SUBTITLE';
    if (/source/.test(hint)) return 'SOURCE';
    if (/foot/.test(hint)) return 'FOOTNOTE';
    if (/axis/.test(hint)) return 'AXIS_LABEL';
    if (/label|value/.test(hint)) return 'DATA_LABEL';
    return 'BODY';
  }
  function alignment(value) {
    try {
      if (value === Justification.CENTER) return 'center';
      if (value === Justification.RIGHT) return 'right';
    } catch (_) {}
    return 'left';
  }
  function colorHex(color) {
    try {
      if (color.typename === 'RGBColor') {
        function h(v) { var s = Math.round(v).toString(16); return s.length < 2 ? '0' + s : s; }
        return '#' + h(color.red) + h(color.green) + h(color.blue);
      }
    } catch (_) {}
    return '#14283f';
  }
  function readSvg() {
    var temporary = new File(Folder.temp.fsName + '/chartlingo-v2-preview-' + new Date().getTime() + '.svg');
    var options = new ExportOptionsSVG();
    options.embedRasterImages = true;
    options.fontSubsetting = SVGFontSubsetting.None;
    options.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
    options.coordinatePrecision = 3;
    doc.exportFile(temporary, ExportType.SVG, options);
    temporary.encoding = 'UTF-8'; temporary.open('r'); var value = temporary.read(); temporary.close();
    try { temporary.remove(); } catch (_) {}
    return value;
  }
  function readArtworkWithoutLiveText() {
    var states = [], value = '', i;
    for (i = 0; i < doc.textFrames.length; i++) {
      states.push({hidden: doc.textFrames[i].hidden, opacity: doc.textFrames[i].opacity});
      try { doc.textFrames[i].opacity = 0; } catch (_) {}
      try { doc.textFrames[i].hidden = true; } catch (_) {}
    }
    try { value = readSvg(); }
    finally {
      for (i = 0; i < doc.textFrames.length; i++) {
        try { doc.textFrames[i].opacity = states[i].opacity; } catch (_) {}
        try { doc.textFrames[i].hidden = states[i].hidden; } catch (_) {}
      }
    }
    return value;
  }

  var artboards = [], i;
  for (i = 0; i < doc.artboards.length; i++) {
    var rect = doc.artboards[i].artboardRect;
    artboards.push({id: 'artboard-' + (i + 1), name: doc.artboards[i].name || ('Artboard ' + (i + 1)), bounds: {x: 0, y: 0, width: rect[2] - rect[0], height: rect[1] - rect[3]}, textFrames: []});
  }
  var counters = [];
  for (i = 0; i < artboards.length; i++) counters[i] = 0;
  var outlinedCount = 0;
  for (i = 0; i < doc.textFrames.length; i++) {
    var frame = doc.textFrames[i];
    if (frame.hidden || !frame.editable || !clean(frame.contents)) continue;
    var bounds = frame.visibleBounds, boardIndex = artboardFor(bounds), boardRect = doc.artboards[boardIndex].artboardRect, box = localBounds(bounds, boardRect), textIndex = counters[boardIndex]++;
    var size = 14, leading = 0, family = 'sans-serif', fill = '#14283f', justify = 'left';
    try { size = frame.textRange.characterAttributes.size || size; } catch (_) {}
    try { leading = frame.textRange.characterAttributes.leading || size * 1.2; } catch (_) { leading = size * 1.2; }
    try { family = frame.textRange.characterAttributes.textFont.family || frame.textRange.characterAttributes.textFont.name; } catch (_) {}
    try { fill = colorHex(frame.textRange.characterAttributes.fillColor); } catch (_) {}
    try { justify = alignment(frame.paragraphs[0].paragraphAttributes.justification); } catch (_) {}
    artboards[boardIndex].textFrames.push({id: frameId(boardIndex, textIndex), name: frame.name || ('Text ' + (textIndex + 1)), sourceText: clean(frame.contents), visibleLines: visibleLines(frame), kind: frame.kind === TextType.AREATEXT ? 'area' : frame.kind === TextType.PATHTEXT ? 'path' : 'point', role: role(frame, textIndex), bounds: box, permittedRegion: {x: Math.max(0, box.x), y: Math.max(0, box.y - size * 0.5), width: Math.max(box.width, artboards[boardIndex].bounds.width - Math.max(0, box.x) - 12), height: Math.max(box.height, size * 4)}, style: {fontFamily: family, fontSize: size, lineHeight: leading / size, alignment: justify, fill: fill}, illustrator: {textFrameIndex: i, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
  }
  try { for (i = 0; i < doc.groupItems.length; i++) if (/outline|outlined/i.test(doc.groupItems[i].name)) outlinedCount++; } catch (_) {}
  var packageData = {schema: 'https://chartlingo.local/schemas/package-v2.json', schemaVersion: '2.0.0', generator: {name: 'ChartLingo Illustrator Prototype', version: '0.3.0'}, document: {id: 'cl-doc-' + clean(doc.name).replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase(), revision: String(doc.fullName && doc.fullName.exists ? doc.fullName.modified.getTime() : new Date().getTime()), name: doc.name.replace(/\.[^.]+$/, ''), sourceApp: 'Adobe Illustrator', sourceVersion: app.version, previewSvg: readSvg(), artworkSvg: readArtworkWithoutLiveText(), artboards: artboards}, warnings: outlinedCount ? [{code: 'POSSIBLE_OUTLINED_TEXT', message: outlinedCount + ' named outline group(s) require manual review.'}] : []};
  destination.encoding = 'UTF-8'; destination.open('w'); destination.write(jsonStringify(packageData, '  ', 0)); destination.close();
  alert('ChartLingoV2 package exported:\n' + destination.fsName + '\n\nLive text frames: ' + doc.textFrames.length + '\nArtboards: ' + doc.artboards.length);
})();
