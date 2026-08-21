#target illustrator

(function () {
  if (!app.documents.length) { alert('Open an Illustrator document first.'); return; }
  var doc = app.activeDocument;

  function artboardLabel(index) {
    var rect = doc.artboards[index].artboardRect, width = Math.round(rect[2] - rect[0]), height = Math.round(rect[1] - rect[3]);
    return (index + 1) + '. ' + (doc.artboards[index].name || ('Artboard ' + (index + 1))) + ' — ' + width + ' × ' + height;
  }
  function chooseArtboards() {
    var dialog = new Window('dialog', 'ChartLingoV2 — Artboards'), group, mode, range, list, preflight, buttons, i, layerNames = [];
    dialog.orientation = 'column'; dialog.alignChildren = ['fill', 'top'];
    dialog.add('statictext', undefined, 'Choose how Illustrator artboards should be exported.');
    group = dialog.add('group'); group.add('statictext', undefined, 'Mode:');
    mode = group.add('dropdownlist', undefined, ['Selected artboard', 'All artboards in one package', 'Specific range in one package', 'Each artboard as a separate package']);
    mode.selection = 0;
    group = dialog.add('group'); group.add('statictext', undefined, 'Range:');
    range = group.add('edittext', undefined, '1-' + doc.artboards.length); range.characters = 12; range.enabled = false;
    list = dialog.add('edittext', undefined, '', {multiline: true, readonly: true, scrolling: true}); list.preferredSize = [520, Math.min(260, 54 + doc.artboards.length * 18)];
    for (i = 0; i < doc.artboards.length; i++) list.text += artboardLabel(i) + (i + 1 < doc.artboards.length ? '\n' : '');
    for (i = 0; i < doc.layers.length; i++) layerNames.push(doc.layers[i].name);
    preflight = dialog.add('statictext', undefined, 'Preflight: ' + doc.pageItems.length + ' page items · ' + doc.textFrames.length + ' text frames · ' + doc.pathItems.length + ' paths · ' + doc.groupItems.length + ' groups · ' + doc.placedItems.length + ' linked/placed items\nLayers: ' + layerNames.join(', '), {multiline: true});
    preflight.preferredSize = [520, 48];
    if (doc.pageItems.length > 5000 || doc.groupItems.length > 1000 || doc.placedItems.length > 20) {
      var warning = dialog.add('statictext', undefined, 'Large/complex document detected. Export one selected artboard first; all-artboard export may take longer.', {multiline: true}); warning.graphics.foregroundColor = warning.graphics.newPen(warning.graphics.PenType.SOLID_COLOR, [0.75, 0.25, 0.05], 1);
    }
    mode.onChange = function () { range.enabled = mode.selection.index === 2; };
    buttons = dialog.add('group'); buttons.alignment = 'right'; buttons.add('button', undefined, 'Cancel', {name: 'cancel'}); buttons.add('button', undefined, 'Continue', {name: 'ok'});
    if (dialog.show() !== 1) return null;
    var indices = [], seen = {}, token, parts, start, end, n, text;
    if (mode.selection.index === 0) indices.push(doc.artboards.getActiveArtboardIndex());
    else if (mode.selection.index === 2) {
      text = String(range.text || '').replace(/\s+/g, '');
      var tokens = text.split(',');
      for (i = 0; i < tokens.length; i++) {
        token = tokens[i]; if (!token) continue; parts = token.split('-'); start = Number(parts[0]); end = parts.length > 1 ? Number(parts[1]) : start;
        if (!isFinite(start) || !isFinite(end)) continue; if (start > end) { n = start; start = end; end = n; }
        for (n = start; n <= end; n++) if (n >= 1 && n <= doc.artboards.length && !seen[n - 1]) { seen[n - 1] = true; indices.push(n - 1); }
      }
      indices.sort(function (a, b) { return a - b; });
      if (!indices.length) { alert('Enter a valid artboard range, for example 1-3 or 1,3,5.'); return null; }
    } else for (i = 0; i < doc.artboards.length; i++) indices.push(i);
    return {indices: indices, separate: mode.selection.index === 3, mode: mode.selection.index};
  }
  var exportChoice = chooseArtboards();
  if (!exportChoice) return;
  var destination = exportChoice.separate ? Folder.selectDialog('Choose a folder for separate ChartLingo packages') : File.saveDialog('Export ChartLingoV2 package', 'ChartLingo package:*.chartlingo');
  if (!destination) return;
  if (!exportChoice.separate && !/\.chartlingo$/i.test(destination.name)) destination = new File(destination.fsName + '.chartlingo');
  var selectedLookup = {}, selectedIndices = exportChoice.indices, selectionIndex;
  for (selectionIndex = 0; selectionIndex < selectedIndices.length; selectionIndex++) selectedLookup[selectedIndices[selectionIndex]] = true;
  var cancelled = false, progressWindow = new Window('palette', 'ChartLingoV2 Export'), progressText, progressBar, cancelButton;
  progressWindow.orientation = 'column'; progressWindow.alignChildren = ['fill', 'top']; progressText = progressWindow.add('statictext', undefined, 'Preparing selected artboard…');
  progressBar = progressWindow.add('progressbar', undefined, 0, 100); progressBar.preferredSize = [420, 16];
  cancelButton = progressWindow.add('button', undefined, 'Cancel export'); cancelButton.onClick = function () { cancelled = true; progressText.text = 'Cancelling safely…'; progressWindow.update(); };
  progressWindow.show();
  function progress(stage, current, total, artboardName) {
    if (cancelled) throw new Error('__CHARTLINGO_CANCELLED__');
    var safeTotal = Math.max(1, total), percent = Math.max(0, Math.min(100, Math.round(current / safeTotal * 100)));
    progressText.text = stage + (artboardName ? ' — ' + artboardName : '') + ' · ' + current + '/' + total; progressBar.value = percent;
    if (current === 0 || current === total || current % 40 === 0) { progressWindow.update(); app.redraw(); $.sleep(1); }
    if (cancelled) throw new Error('__CHARTLINGO_CANCELLED__');
  }
  var initialActiveArtboard = doc.artboards.getActiveArtboardIndex();
  try {

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
    var cx = (bounds[0] + bounds[2]) / 2, cy = (bounds[1] + bounds[3]) / 2, best = -1, bestArea = 0, i, r, left, right, top, bottom, area;
    for (i = 0; i < selectedIndices.length; i++) {
      var index = selectedIndices[i]; r = doc.artboards[index].artboardRect;
      if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) return index;
      left = Math.max(bounds[0], r[0]); right = Math.min(bounds[2], r[2]); top = Math.min(bounds[1], r[1]); bottom = Math.max(bounds[3], r[3]);
      area = Math.max(0, right - left) * Math.max(0, top - bottom);
      if (area > bestArea) { bestArea = area; best = index; }
    }
    return best;
  }
  function localBounds(bounds, rect) {
    return {x: bounds[0] - rect[0], y: rect[1] - bounds[1], width: bounds[2] - bounds[0], height: bounds[1] - bounds[3]};
  }
  function addLayer(record, name) { for (var i = 0; i < record.layerNames.length; i++) if (record.layerNames[i] === name) return; record.layerNames.push(name); }
  function visibleLines(frame) {
    var values = [];
    try { for (var i = 0; i < frame.lines.length; i++) values.push(clean(frame.lines[i].contents)); } catch (_) {}
    return values.length ? values : [clean(frame.contents)];
  }
  function lineWords(line) {
    var values = [], i, value;
    try {
      for (i = 0; i < line.words.length; i++) {
        value = clean(line.words[i].contents);
        if (value) values.push(value);
      }
    } catch (_) {}
    if (values.length === 1 && /[\t ]/.test(values[0])) values = values[0].split(/[\t ]+/);
    if (!values.length) {
      value = clean(line.contents);
      if (value) values = value.split(/[\t ]+/);
    }
    return values;
  }
  function pairedAxisLabels(frame) {
    var lines = [], first, second, result = [], i;
    try { for (i = 0; i < frame.lines.length; i++) if (clean(frame.lines[i].contents)) lines.push(frame.lines[i]); } catch (_) {}
    if (lines.length !== 2) return null;
    first = lineWords(lines[0]); second = lineWords(lines[1]);
    if (first.length < 2 || first.length !== second.length) return null;
    for (i = 0; i < first.length; i++) if (!/^\d{4}$/.test(first[i]) || !second[i]) return null;
    for (i = 0; i < first.length; i++) result.push({year: first[i], period: second[i]});
    return result;
  }
  function periodFieldType(value) {
    if (/季|quarter|^q\d+$/i.test(value)) return 'quarter';
    if (/月|month|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value)) return 'month';
    return 'period';
  }
  function creditLines(frame) {
    var lines = visibleLines(frame), result = [], i;
    if (lines.length < 2) return null;
    for (i = 0; i < lines.length; i++) {
      if (!/^(?:早报图表|联合早报图表|图表|圖表|资料来源|資料來源|数据来源|數據來源|来源|來源)\s*[：:]/.test(lines[i])) return null;
      result.push(lines[i]);
    }
    return result;
  }
  function tableRows(frame) {
    var raw = String(frame.contents || ''), rows = raw.split(/[\r\n]+/), result = [], numbered = [], plain = [], i, cells, j, useful, match;
    if (raw.indexOf('\t') < 0) {
      for (i = 0; i < rows.length; i++) {
        if (!clean(rows[i])) continue;
        match = rows[i].match(/^\s*(\d+)[\.\)\u3001]?\s*(\D.+?)\s*$/);
        if (match) numbered.push([clean(match[1]), clean(match[2])]);
        plain.push([clean(rows[i])]);
      }
      if (numbered.length === plain.length && numbered.length >= 2) {
        numbered.numberedList = true;
        return numbered;
      }
      if (plain.length >= 3) {
        plain.plainList = true;
        return plain;
      }
      return null;
    }
    for (i = 0; i < rows.length; i++) {
      cells = rows[i].split('\t'); useful = false;
      for (j = 0; j < cells.length; j++) { cells[j] = clean(cells[j]); if (cells[j]) useful = true; }
      if (useful) result.push(cells);
    }
    return result.length ? result : null;
  }
  function tabAlignment(stop) {
    try {
      if (stop.alignment === TabStopAlignment.CENTER) return 'center';
      if (stop.alignment === TabStopAlignment.RIGHT || stop.alignment === TabStopAlignment.DECIMAL) return 'right';
    } catch (_) {}
    return 'left';
  }
  function tableColumns(frame, count, width, numberedList) {
    var anchors = [0], aligns = ['left'], stops = null, i, step, next, columns = [];
    try { stops = frame.paragraphs[0].paragraphAttributes.tabStops; } catch (_) {}
    for (i = 1; i < count; i++) {
      if (stops && stops.length >= i) { anchors.push(Math.max(0, Math.min(width, Number(stops[i - 1].position)))); aligns.push(tabAlignment(stops[i - 1])); }
      else { step = numberedList && count === 2 ? width * 0.28 : width / count; anchors.push(i === 1 && numberedList && count === 2 ? step : width / count * i); aligns.push('left'); }
    }
    /* A tab stop is the text anchor, not the boundary between two columns. Using
       midpoint boundaries shifts every cell after the first one to the left. */
    for (i = 0; i < count; i++) {
      next = i + 1 < anchors.length ? anchors[i + 1] : width;
      columns.push({x: anchors[i], width: Math.max(1, next - anchors[i]), alignment: aligns[i]});
    }
    return columns;
  }
  function role(frame, index) {
    var hint = (frame.name + ' ' + frame.layer.name + ' ' + clean(frame.contents)).toLowerCase();
    if (/title|headline/.test(hint)) return 'TITLE';
    if (/sub|deck/.test(hint)) return 'SUBTITLE';
    if (/source|资料来源|數據來源|数据来源/.test(hint)) return 'SOURCE';
    if (/foot|credit|graphic|图表|圖表/.test(hint)) return 'FOOTNOTE';
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
    function h(v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }
    try {
      if (color.typename === 'RGBColor') {
        return '#' + h(color.red) + h(color.green) + h(color.blue);
      }
      if (color.typename === 'CMYKColor') {
        var c = color.cyan / 100, m = color.magenta / 100, y = color.yellow / 100, k = color.black / 100;
        return '#' + h(255 * (1 - c) * (1 - k)) + h(255 * (1 - m) * (1 - k)) + h(255 * (1 - y) * (1 - k));
      }
      if (color.typename === 'GrayColor') {
        var gray = 255 * (1 - color.gray / 100);
        return '#' + h(gray) + h(gray) + h(gray);
      }
    } catch (_) {}
    return '#14283f';
  }
  function graphicTextType(value, frame) {
    var text = clean(value), hint = String(frame.name || '') + ' ' + String(frame.layer ? frame.layer.name : '');
    if (/^[+-]?\d+(?:[.,]\d+)?\s*%$/.test(text)) return 'graphic-percentage';
    if (/^[¥￥$€£]?\s*[+-]?\d+(?:[.,]\d+)?(?:\s*(?:亿|万|千|百|million|billion|m|bn))?(?:元|美元|人民币)?$/i.test(text)) return 'graphic-value';
    if (/label|caption|名称|標籤|标签/i.test(hint)) return 'graphic-label';
    return 'chart';
  }
  function graphicDirection(name, bounds, points) {
    var hint = String(name || '').toLowerCase();
    if (/down|decrease|decline|下降|下跌|向下/.test(hint)) return 'down';
    if (/up|increase|growth|上升|上涨|向上/.test(hint)) return 'up';
    if (!points || points.length < 3) return null;
    var top = points[0], bottom = points[0], i;
    for (i = 1; i < points.length; i++) { if (points[i][1] < top[1]) top = points[i]; if (points[i][1] > bottom[1]) bottom = points[i]; }
    if (bounds.height > bounds.width * 0.75) {
      if (bottom[0] > bounds.x + bounds.width * 0.2 && bottom[0] < bounds.x + bounds.width * 0.8) return 'down';
      if (top[0] > bounds.x + bounds.width * 0.2 && top[0] < bounds.x + bounds.width * 0.8) return 'up';
    }
    return null;
  }
  function pathGeometry(path, rect) {
    var result = [], i, point;
    try { for (i = 0; i < path.pathPoints.length; i++) { point = path.pathPoints[i].anchor; result.push([point[0] - rect[0], rect[1] - point[1]]); } } catch (_) {}
    return result;
  }
  function indicatorGroup(item) {
    var parent = item;
    while (parent) {
      try { if (parent.typename === 'GroupItem' && /arrow|indicator|trend|up|down|箭头|箭頭|升|降/i.test(String(parent.name || ''))) return parent; } catch (_) {}
      try { parent = parent.parent; } catch (_) { parent = null; }
      if (parent === doc) return null;
    }
    return null;
  }
  function graphicStyle(item) {
    var fill = null, stroke = null, opacity = 100;
    try { if (item.filled) fill = colorHex(item.fillColor); } catch (_) {}
    try { if (item.stroked) stroke = colorHex(item.strokeColor); } catch (_) {}
    try { opacity = Number(item.opacity); } catch (_) {}
    if (!fill && !stroke) {
      try {
        if (item.pathItems && item.pathItems.length) {
          var childStyle = graphicStyle(item.pathItems[0]);
          fill = childStyle.fill; stroke = childStyle.stroke;
        }
      } catch (_) {}
    }
    return {fill: fill, sourceColor: fill, stroke: stroke, opacity: opacity / 100, preserveOriginalColor: true};
  }
  function sourceGroupKey(item, rect) {
    var parent = item, bounds, name, layer;
    while (parent) {
      try {
        if (parent.typename === 'GroupItem') {
          bounds = parent.visibleBounds; name = String(parent.name || 'group'); layer = String(parent.layer ? parent.layer.name : '');
          return layer + '|' + name + '|' + Math.round(bounds[0] - rect[0]) + '|' + Math.round(rect[1] - bounds[1]) + '|' + Math.round(bounds[2] - bounds[0]) + '|' + Math.round(bounds[1] - bounds[3]);
        }
      } catch (_) {}
      try { parent = parent.parent; } catch (_) { parent = null; }
      if (parent === doc) break;
    }
    return null;
  }
  function metricSlot(contentType) {
    if (contentType === 'graphic-label') return 'label';
    if (contentType === 'graphic-value') return 'value';
    if (contentType === 'graphic-percentage') return 'change-row';
    if (contentType === 'indicator') return 'change-row';
    return null;
  }
  function readSvg(artboardIndex) {
    var stem = 'chartlingo-v2-preview-' + new Date().getTime() + '-' + artboardIndex, temporary = new File(Folder.temp.fsName + '/' + stem + '.svg');
    var options = new ExportOptionsSVG();
    options.embedRasterImages = true;
    options.fontSubsetting = SVGFontSubsetting.None;
    options.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
    options.coordinatePrecision = 3;
    options.saveMultipleArtboards = true;
    options.artboardRange = String(artboardIndex + 1);
    doc.artboards.setActiveArtboardIndex(artboardIndex);
    doc.exportFile(temporary, ExportType.SVG, options);
    var generated = temporary, matches = [];
    if (!generated.exists) { try { matches = Folder.temp.getFiles(stem + '*.svg'); } catch (_) {} if (matches.length) generated = matches[0]; }
    if (!generated.exists) throw new Error('Illustrator did not create the cropped SVG for artboard ' + (artboardIndex + 1) + '.');
    generated.encoding = 'UTF-8'; generated.open('r'); var value = generated.read(); generated.close();
    try { generated.remove(); } catch (_) {}
    try { for (var cleanupIndex = 0; cleanupIndex < matches.length; cleanupIndex++) if (matches[cleanupIndex].exists) matches[cleanupIndex].remove(); } catch (_) {}
    return value;
  }
  function readArtworkWithoutLiveText(artboardIndex, artboardRecord) {
    var states = [], value = '', i, frameIndex, seen = {};
    for (i = 0; i < artboardRecord.textFrames.length; i++) {
      frameIndex = artboardRecord.textFrames[i].illustrator.textFrameIndex;
      if (seen[frameIndex]) continue; seen[frameIndex] = true;
      states.push({index: frameIndex, hidden: doc.textFrames[frameIndex].hidden, opacity: doc.textFrames[frameIndex].opacity});
      try { doc.textFrames[frameIndex].opacity = 0; } catch (_) {}
      try { doc.textFrames[frameIndex].hidden = true; } catch (_) {}
    }
    try { value = readSvg(artboardIndex); }
    finally {
      for (i = 0; i < states.length; i++) {
        try { doc.textFrames[states[i].index].opacity = states[i].opacity; } catch (_) {}
        try { doc.textFrames[states[i].index].hidden = states[i].hidden; } catch (_) {}
      }
    }
    return value;
  }

  function logoBoundsForArtboard(artboardIndex) {
    var rect = doc.artboards[artboardIndex].artboardRect, boardWidth = rect[2] - rect[0], boardHeight = rect[1] - rect[3];
    var collections = [], best = null, bestScore = -1, c, i, item, bounds, box, centerX, centerY, aspect, hint, named, score;
    try { collections.push(doc.groupItems); } catch (_) {}
    try { collections.push(doc.placedItems); } catch (_) {}
    try { collections.push(doc.rasterItems); } catch (_) {}
    try { collections.push(doc.symbolItems); } catch (_) {}
    for (c = 0; c < collections.length; c++) {
      for (i = 0; i < collections[c].length; i++) {
        progress('Preflight logo scan', i, collections[c].length, doc.artboards[artboardIndex].name);
        item = collections[c][i];
        try {
          if (item.hidden || item.locked) continue;
          bounds = item.visibleBounds;
          box = localBounds(bounds, rect);
          centerX = box.x + box.width / 2; centerY = box.y + box.height / 2;
          if (centerX < 0 || centerX > boardWidth || centerY < 0 || centerY > boardHeight) continue;
          if (box.width < boardWidth * 0.015 || box.height < boardHeight * 0.015 || box.width > boardWidth * 0.25 || box.height > boardHeight * 0.25) continue;
          aspect = box.width / box.height;
          if (aspect < 0.4 || aspect > 2.5) continue;
          hint = String(item.name || '') + ' ' + String(item.layer ? item.layer.name : '');
          named = /logo|brand|masthead|zaobao|早报|早報|联合早报|聯合早報/i.test(hint);
          if (!named && (centerX < boardWidth * 0.58 || centerY < boardHeight * 0.58)) continue;
          score = (named ? 10000 : 0) + centerX / boardWidth * 100 + centerY / boardHeight * 120 + Math.min(box.width, box.height);
          if (score > bestScore) { bestScore = score; best = box; }
        } catch (_) {}
      }
    }
    return best;
  }

  var artboards = [], artboardsByIndex = {}, i;
  for (selectionIndex = 0; selectionIndex < selectedIndices.length; selectionIndex++) {
    i = selectedIndices[selectionIndex];
    var rect = doc.artboards[i].artboardRect, width = rect[2] - rect[0], height = rect[1] - rect[3];
    var artboardRecord = {id: 'artboard-' + (i + 1), name: doc.artboards[i].name || ('Artboard ' + (i + 1)), index: i, order: selectionIndex, position: {x: rect[0], y: rect[1]}, bounds: {x: 0, y: 0, width: width, height: height}, orientation: width >= height ? 'landscape' : 'portrait', background: {transparent: true}, objectCount: 0, layerNames: [], logoBounds: logoBoundsForArtboard(i), previewSvg: null, artworkSvg: null, textFrames: [], graphicElements: []};
    artboards.push(artboardRecord); artboardsByIndex[i] = artboardRecord;
  }
  var selectedArtboards = artboards.slice(0);
  artboards = [];
  for (selectionIndex = 0; selectionIndex < selectedArtboards.length; selectionIndex++) artboards[selectedArtboards[selectionIndex].index] = selectedArtboards[selectionIndex];
  var counters = [], exportedBlocks = 0, splitCells = 0;
  for (i = 0; i < doc.artboards.length; i++) counters[i] = 0;
  var outlinedCount = 0;
  for (i = 0; i < doc.textFrames.length; i++) {
    progress('Scanning text', i, doc.textFrames.length, selectedIndices.length === 1 ? doc.artboards[selectedIndices[0]].name : 'selected artboards');
    var frame = doc.textFrames[i];
    if (frame.hidden || !frame.editable || !clean(frame.contents)) continue;
    var bounds = frame.visibleBounds, boardIndex = artboardFor(bounds);
    if (boardIndex < 0 || !artboardsByIndex[boardIndex]) continue;
    var boardRecord = artboardsByIndex[boardIndex], boardRect = doc.artboards[boardIndex].artboardRect, box = localBounds(bounds, boardRect), textIndex = counters[boardIndex]++, baseId = frameId(boardIndex, textIndex);
    boardRecord.objectCount++;
    try { addLayer(boardRecord, frame.layer.name); } catch (_) {}
    var size = 14, leading = 0, family = 'sans-serif', fill = '#14283f', justify = 'left', fontWeight = 400, fontStyleName = '';
    try { size = frame.textRange.characterAttributes.size || size; } catch (_) {}
    try { leading = frame.textRange.characterAttributes.leading || size * 1.2; } catch (_) { leading = size * 1.2; }
    try { family = frame.textRange.characterAttributes.textFont.family || frame.textRange.characterAttributes.textFont.name; } catch (_) {}
    try { fontStyleName = frame.textRange.characterAttributes.textFont.style || ''; if (/bold|black|heavy|semibold|demi/i.test(fontStyleName)) fontWeight = 700; } catch (_) {}
    try { fill = colorHex(frame.textRange.characterAttributes.fillColor); } catch (_) {}
    try { justify = alignment(frame.paragraphs[0].paragraphAttributes.justification); } catch (_) {}
    var axisLabels = pairedAxisLabels(frame), credits = creditLines(frame), rows = tableRows(frame), rowIndex, columnIndex, maxColumns = 0, columns, rowHeight, cell, cellBox, groupId, fieldType, itemId;
    if (axisLabels) {
      rowHeight = box.height / 2;
      for (columnIndex = 0; columnIndex < axisLabels.length; columnIndex++) {
        cell = axisLabels[columnIndex]; groupId = baseId + '-x-' + (columnIndex + 1);
        cellBox = {x: box.x + box.width / axisLabels.length * columnIndex, y: box.y, width: box.width / axisLabels.length, height: rowHeight};
        artboards[boardIndex].textFrames.push({id: baseId + '-x' + (columnIndex + 1) + '-year', name: (frame.name || ('Text ' + (textIndex + 1))) + ' - Year ' + (columnIndex + 1), sourceText: cell.year, visibleLines: [cell.year], groupId: groupId, fieldType: 'year', kind: 'axis-year', role: 'AXIS_LABEL', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: Math.max(cellBox.height, size * 1.5)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: 'center', fill: fill}, illustrator: {textFrameIndex: i, virtualCell: true, axisField: 'year', row: 0, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        cellBox = {x: cellBox.x, y: box.y + rowHeight, width: cellBox.width, height: rowHeight};
        fieldType = periodFieldType(cell.period);
        artboards[boardIndex].textFrames.push({id: baseId + '-x' + (columnIndex + 1) + '-period', name: (frame.name || ('Text ' + (textIndex + 1))) + ' - Period ' + (columnIndex + 1), sourceText: cell.period, visibleLines: [cell.period], groupId: groupId, fieldType: fieldType, kind: 'axis-period', role: 'AXIS_LABEL', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: Math.max(cellBox.height, size * 1.5)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: 'center', fill: fill}, illustrator: {textFrameIndex: i, virtualCell: true, axisField: fieldType, row: 1, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        exportedBlocks += 2; splitCells += 2;
      }
    } else if (credits) {
      rowHeight = box.height / credits.length;
      for (rowIndex = 0; rowIndex < credits.length; rowIndex++) {
        cell = credits[rowIndex]; fieldType = /来源|來源/.test(cell) ? 'source' : 'credit'; itemId = baseId + '-' + fieldType; groupId = baseId + '-credits';
        cellBox = {x: box.x, y: box.y + rowHeight * rowIndex, width: box.width, height: rowHeight};
        artboards[boardIndex].textFrames.push({id: itemId, name: (frame.name || ('Text ' + (textIndex + 1))) + ' - ' + (fieldType === 'source' ? 'Source' : 'Credit'), sourceText: cell, visibleLines: [cell], groupId: groupId, fieldType: fieldType, kind: 'credit-line', role: fieldType === 'source' ? 'SOURCE' : 'FOOTNOTE', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: Math.max(cellBox.width, artboards[boardIndex].bounds.width - cellBox.x - 12), height: Math.max(cellBox.height, size * 1.5)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: justify, fill: fill}, illustrator: {textFrameIndex: i, virtualCell: true, creditLine: true, row: rowIndex, column: 0, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        exportedBlocks++; splitCells++;
      }
    } else if (rows) {
      for (rowIndex = 0; rowIndex < rows.length; rowIndex++) if (rows[rowIndex].length > maxColumns) maxColumns = rows[rowIndex].length;
      columns = tableColumns(frame, maxColumns, box.width, rows.numberedList); rowHeight = box.height / rows.length;
      for (rowIndex = 0; rowIndex < rows.length; rowIndex++) for (columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex++) {
        cell = rows[rowIndex][columnIndex]; if (!cell) continue;
        cellBox = {x: box.x + columns[columnIndex].x, y: box.y + rowHeight * rowIndex, width: columns[columnIndex].width, height: rowHeight};
        artboards[boardIndex].textFrames.push({id: baseId + '-r' + (rowIndex + 1) + '-c' + (columnIndex + 1), name: (frame.name || ('Text ' + (textIndex + 1))) + ' R' + (rowIndex + 1) + ' C' + (columnIndex + 1), sourceText: cell, visibleLines: [cell], kind: rows.plainList ? 'list-item' : 'table-cell', role: 'DATA_LABEL', contentType: graphicTextType(cell, frame), bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: Math.max(cellBox.height, size * 1.5)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: columns[columnIndex].alignment, fill: fill}, illustrator: {textFrameIndex: i, virtualCell: true, row: rowIndex, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        exportedBlocks++; splitCells++;
      }
    } else {
      artboards[boardIndex].textFrames.push({id: baseId, name: frame.name || ('Text ' + (textIndex + 1)), sourceText: clean(frame.contents), visibleLines: visibleLines(frame), kind: frame.kind === TextType.AREATEXT ? 'area' : frame.kind === TextType.PATHTEXT ? 'path' : 'point', role: role(frame, textIndex), contentType: graphicTextType(frame.contents, frame), bounds: box, permittedRegion: {x: Math.max(0, box.x), y: Math.max(0, box.y - size * 0.5), width: Math.max(box.width, artboards[boardIndex].bounds.width - Math.max(0, box.x) - 12), height: Math.max(box.height, size * 4)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: justify, fill: fill}, illustrator: {textFrameIndex: i, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
      exportedBlocks++;
    }
  }
  var graphicCount = 0, graphicSeenElements = {}, graphicKey, graphicIndex, graphicItem, graphicBounds, graphicBoard, graphicRect, graphicBox, graphicPoints, graphicName, graphicGroup, graphicRecord, childIndex, child;
  for (graphicIndex = 0; graphicIndex < doc.pathItems.length; graphicIndex++) {
    progress('Scanning graphics', graphicIndex, doc.pathItems.length, selectedIndices.length === 1 ? doc.artboards[selectedIndices[0]].name : 'selected artboards');
    graphicItem = doc.pathItems[graphicIndex];
    try { if (graphicItem.hidden || graphicItem.guides || graphicItem.clipping) continue; } catch (_) {}
    graphicGroup = indicatorGroup(graphicItem);
    if (graphicGroup) {
      graphicName = String(graphicGroup.name || ('Indicator ' + (graphicIndex + 1)));
      graphicItem = graphicGroup;
    } else {
      try { if (graphicItem.parent && graphicItem.parent.typename === 'CompoundPathItem') graphicItem = graphicItem.parent; } catch (_) {}
    }
    try { graphicBounds = graphicItem.visibleBounds; } catch (_) { continue; }
    graphicKey = String(graphicItem.typename) + '|' + String(graphicItem.name || '') + '|' + graphicBounds.join(',');
    if (graphicSeenElements[graphicKey]) continue;
    graphicSeenElements[graphicKey] = true;
    graphicBoard = artboardFor(graphicBounds);
    if (graphicBoard < 0 || !artboardsByIndex[graphicBoard]) continue;
    graphicRect = doc.artboards[graphicBoard].artboardRect; graphicBox = localBounds(graphicBounds, graphicRect); graphicPoints = [];
    artboardsByIndex[graphicBoard].objectCount++;
    try { addLayer(artboardsByIndex[graphicBoard], graphicItem.layer.name); } catch (_) {}
    if (graphicItem.typename === 'PathItem') graphicPoints = pathGeometry(graphicItem, graphicRect);
    else {
      try { for (childIndex = 0; childIndex < graphicItem.pathItems.length; childIndex++) { child = pathGeometry(graphicItem.pathItems[childIndex], graphicRect); graphicPoints = graphicPoints.concat(child); } } catch (_) {}
    }
    graphicName = String(graphicItem.name || ('Graphic ' + (graphicIndex + 1)));
    graphicRecord = {id: 'cl-ge-' + (graphicBoard + 1) + '-' + (++graphicCount), name: graphicName, contentType: graphicDirection(graphicName, graphicBox, graphicPoints) ? 'indicator' : 'vector', direction: graphicDirection(graphicName, graphicBox, graphicPoints), bounds: graphicBox, points: graphicPoints, style: graphicStyle(graphicItem), layerName: String(graphicItem.layer ? graphicItem.layer.name : ''), zOrder: graphicIndex, sourceGroupKey: sourceGroupKey(graphicItem, graphicRect), illustrator: {typename: graphicItem.typename, pathItemIndex: graphicIndex, editable: !graphicItem.locked}};
    artboards[graphicBoard].graphicElements.push(graphicRecord);
  }
  artboards = selectedArtboards;
  for (i = 0; i < artboards.length; i++) {
    progress('Structuring artboard', i, artboards.length, artboards[i].name);
    var titleCandidate = null, titleSize = -1, j;
    for (j = 0; j < artboards[i].textFrames.length; j++) {
      var candidate = artboards[i].textFrames[j];
      if (candidate.kind === 'table-cell' || candidate.kind === 'list-item' || candidate.bounds.y > artboards[i].bounds.height * 0.25) continue;
      if (candidate.role === 'TITLE' || candidate.style.fontSize > titleSize) { titleCandidate = candidate; titleSize = candidate.style.fontSize; }
    }
    for (j = 0; j < artboards[i].textFrames.length; j++) if (artboards[i].textFrames[j].role === 'TITLE') artboards[i].textFrames[j].role = 'BODY';
    if (titleCandidate) { titleCandidate.role = 'TITLE'; titleCandidate.style.fontWeight = 700; }
    for (j = 0; j < artboards[i].textFrames.length; j++) {
      var contentFrame = artboards[i].textFrames[j];
      try {
        var originalFrame = doc.textFrames[contentFrame.illustrator.textFrameIndex], tracking = originalFrame.textRange.characterAttributes.tracking || 0;
        contentFrame.sourceGroupKey = sourceGroupKey(originalFrame, doc.artboards[artboards[i].index].artboardRect);
        contentFrame.style.letterSpacing = tracking / 1000 * contentFrame.style.fontSize;
        contentFrame.style.verticalAlignment = 'top';
      } catch (_) { contentFrame.style.letterSpacing = 0; contentFrame.style.verticalAlignment = 'top'; }
      if (contentFrame.role !== 'TITLE' && contentFrame.role !== 'SUBTITLE' && contentFrame.role !== 'SOURCE' && contentFrame.role !== 'FOOTNOTE' && contentFrame.fieldType !== 'source' && contentFrame.fieldType !== 'credit') {
        if (!contentFrame.contentType) contentFrame.contentType = 'chart';
        contentFrame.lineBreakMode = 'auto';
        contentFrame.translationLayout = {mode: 'auto', width: null, inheritSourceWidth: false, manualLines: []};
      }
    }
    var metricGroups = {}, metricKey, metricGroup, metricIndex = 0, graphicElement;
    for (j = 0; j < artboards[i].textFrames.length; j++) {
      contentFrame = artboards[i].textFrames[j]; metricKey = contentFrame.sourceGroupKey;
      if (!metricKey) continue;
      if (!metricGroups[metricKey]) metricGroups[metricKey] = {texts: [], graphics: []};
      metricGroups[metricKey].texts.push(contentFrame);
    }
    for (j = 0; j < artboards[i].graphicElements.length; j++) {
      graphicElement = artboards[i].graphicElements[j]; metricKey = graphicElement.sourceGroupKey;
      if (!metricKey) continue;
      if (!metricGroups[metricKey]) metricGroups[metricKey] = {texts: [], graphics: []};
      metricGroups[metricKey].graphics.push(graphicElement);
    }
    for (metricKey in metricGroups) if (metricGroups.hasOwnProperty(metricKey)) {
      metricGroup = metricGroups[metricKey];
      var hasValue = false, hasChange = false;
      for (j = 0; j < metricGroup.texts.length; j++) { if (metricGroup.texts[j].contentType === 'graphic-value') hasValue = true; if (metricGroup.texts[j].contentType === 'graphic-percentage') hasChange = true; }
      for (j = 0; j < metricGroup.graphics.length; j++) if (metricGroup.graphics[j].contentType === 'indicator') hasChange = true;
      if (!hasValue || !hasChange) continue;
      metricIndex++; metricKey = 'metric-' + (i + 1) + '-' + metricIndex;
      for (j = 0; j < metricGroup.texts.length; j++) {
        contentFrame = metricGroup.texts[j];
        if (contentFrame.contentType === 'chart' && !/^\s*[\d.,%+\-]+\s*$/.test(contentFrame.sourceText)) contentFrame.contentType = 'graphic-label';
        contentFrame.metricGroupId = metricKey; contentFrame.slot = metricSlot(contentFrame.contentType);
        if (contentFrame.slot === 'label') contentFrame.layoutRole = 'metric-label';
        else if (contentFrame.slot === 'value') contentFrame.layoutRole = 'metric-value';
        else if (contentFrame.slot === 'change-row') contentFrame.layoutRole = 'metric-change';
      }
      for (j = 0; j < metricGroup.graphics.length; j++) { graphicElement = metricGroup.graphics[j]; graphicElement.metricGroupId = metricKey; graphicElement.slot = metricSlot(graphicElement.contentType); graphicElement.layoutRole = graphicElement.contentType === 'indicator' ? 'indicator' : 'graphic'; }
    }
  }
  try { for (i = 0; i < doc.groupItems.length; i++) if (/outline|outlined/i.test(doc.groupItems[i].name)) outlinedCount++; } catch (_) {}
  var previousActiveArtboard = doc.artboards.getActiveArtboardIndex();
  for (i = 0; i < artboards.length; i++) {
    progress('Rendering preview', i, artboards.length * 2, artboards[i].name);
    artboards[i].previewSvg = readSvg(artboards[i].index);
    progress('Rendering artwork', artboards.length + i, artboards.length * 2, artboards[i].name);
    artboards[i].artworkSvg = readArtworkWithoutLiveText(artboards[i].index, artboards[i]);
  }
  try { doc.artboards.setActiveArtboardIndex(previousActiveArtboard); } catch (_) {}
  function packageFor(records, suffix) {
    return {schema: 'https://chartlingo.local/schemas/package-v2.json', schemaVersion: '2.0.0', generator: {name: 'ChartLingo Illustrator Prototype', version: '0.6.1'}, document: {id: 'cl-doc-' + clean(doc.name).replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase() + (suffix || ''), revision: String(doc.fullName && doc.fullName.exists ? doc.fullName.modified.getTime() : new Date().getTime()), name: doc.name.replace(/\.[^.]+$/, '') + (suffix || ''), sourceApp: 'Adobe Illustrator', sourceVersion: app.version, exportMode: exportChoice.separate ? 'separate' : exportChoice.mode === 0 ? 'selected' : exportChoice.mode === 2 ? 'range' : 'all', artboards: records}, warnings: outlinedCount ? [{code: 'POSSIBLE_OUTLINED_TEXT', message: outlinedCount + ' named outline group(s) require manual review.'}] : []};
  }
  function safeName(value) { return clean(value).replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-'); }
  function writePackage(file, data) { file.encoding = 'UTF-8'; file.open('w'); file.write(jsonStringify(data, '  ', 0)); file.close(); }
  var outputCount = 0, outputPath = '';
  if (exportChoice.separate) {
    for (i = 0; i < artboards.length; i++) {
      var separateFile = new File(destination.fsName + '/' + safeName(doc.name.replace(/\.[^.]+$/, '')) + '-' + (artboards[i].index + 1) + '-' + safeName(artboards[i].name) + '.chartlingo');
      writePackage(separateFile, packageFor([artboards[i]], '-artboard-' + (artboards[i].index + 1))); outputCount++; outputPath = destination.fsName;
    }
  } else { writePackage(destination, packageFor(artboards, '')); outputCount = 1; outputPath = destination.fsName; }
  try { progressWindow.close(); } catch (_) {}
  alert('ChartLingoV2 export complete:\n' + outputPath + '\n\nExporter: 0.6.1\nMode: ' + (exportChoice.separate ? 'separate packages' : 'one package') + '\nFiles: ' + outputCount + '\nArtboards: ' + artboards.length + '\nPackage text blocks: ' + exportedBlocks + '\nIndependent vector elements: ' + graphicCount + '\nTable/list/axis/credit items split: ' + splitCells);
  } catch (exportError) {
    try { doc.artboards.setActiveArtboardIndex(initialActiveArtboard); } catch (_) {}
    try { progressWindow.close(); } catch (_) {}
    if (String(exportError.message || exportError) === '__CHARTLINGO_CANCELLED__') alert('ChartLingoV2 export cancelled. The Illustrator document was restored.');
    else alert('ChartLingoV2 could not export this artboard:\n' + (exportError.message || exportError) + '\n\nThe Illustrator document was left unchanged. You can run the exporter again and choose another artboard.');
  }
})();
