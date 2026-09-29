#target illustrator

(function () {
  if (!app.documents.length) { alert('Open an Illustrator document first.'); return; }
  var doc = app.activeDocument;

  function artboardLabel(index) {
    var rect = doc.artboards[index].artboardRect, width = Math.round(rect[2] - rect[0]), height = Math.round(rect[1] - rect[3]);
    return (index + 1) + '. ' + (doc.artboards[index].name || ('Artboard ' + (index + 1))) + ' — ' + width + ' × ' + height;
  }
  function chooseArtboards() {
    var dialog = new Window('dialog', 'ChartLingo — Export'), group, mode, list, imageMode, imageHelp, preflight, buttons, i, layerNames = [], activeIndex = doc.artboards.getActiveArtboardIndex(), multipleAvailable = doc.artboards.length > 1;
    dialog.orientation = 'column'; dialog.alignChildren = ['fill', 'top'];
    dialog.add('statictext', undefined, 'Choose the artboard(s) to export.');
    group = dialog.add('group'); group.add('statictext', undefined, 'Mode:');
    mode = group.add('dropdownlist', undefined, multipleAvailable ? ['Single artboard', 'Multiple artboards'] : ['Single artboard']);
    mode.selection = 0;
    list = dialog.add('listbox', undefined, [], {multiselect: true}); list.preferredSize = [520, Math.min(280, Math.max(70, 28 + doc.artboards.length * 24))];
    for (i = 0; i < doc.artboards.length; i++) list.add('item', artboardLabel(i));
    list.selection = list.items[activeIndex]; list.enabled = false;
    group = dialog.add('group'); group.add('statictext', undefined, 'Photo handling:');
    imageMode = group.add('dropdownlist', undefined, ['Editable vectors + embedded photo (recommended)', 'High quality']); imageMode.selection = 0;
    imageHelp = dialog.add('statictext', undefined, 'Rasterizes only each photo and its visible crop directly in memory. Photo pixels follow their displayed size in a normalized 1200 px graphic; surrounding vectors remain editable.', {multiline: true}); imageHelp.preferredSize = [520, 42];
    for (i = 0; i < doc.layers.length; i++) layerNames.push(doc.layers[i].name);
    preflight = dialog.add('statictext', undefined, 'Fast export scans editable text and preserves the remaining artwork directly as SVG.\nLayers: ' + layerNames.join(', '), {multiline: true});
    preflight.preferredSize = [520, 48];
    mode.onChange = function () { list.enabled = multipleAvailable && mode.selection.index === 1; if (!list.enabled) list.selection = list.items[activeIndex]; };
    imageMode.onChange = function () { imageHelp.text = imageMode.selection.index === 0 ? 'Rasterizes only each photo and its visible crop directly in memory. Photo pixels follow their displayed size in a normalized 1200 px graphic; surrounding vectors remain editable.' : 'High quality also stores a complete Chinese SVG preview. Original-resolution photos stay embedded and vectors remain editable, but the package is larger.'; };
    buttons = dialog.add('group'); buttons.alignment = 'right'; buttons.add('button', undefined, 'Cancel', {name: 'cancel'}); buttons.add('button', undefined, 'Continue', {name: 'ok'});
    if (dialog.show() !== 1) return null;
    var indices = [], selectedItems = list.selection instanceof Array ? list.selection : (list.selection ? [list.selection] : []);
    if (mode.selection.index === 0) indices.push(activeIndex);
    else for (i = 0; i < selectedItems.length; i++) indices.push(selectedItems[i].index);
    indices.sort(function (a, b) { return a - b; });
    if (!indices.length) { alert('Select at least one artboard from the list.'); return null; }
    return {indices: indices, separate: false, mode: mode.selection.index, imageMode: imageMode.selection.index === 0 ? 'optimized' : 'high-quality'};
  }
  var exportChoice = chooseArtboards();
  if (!exportChoice) return;
  var destinationFolder = Folder.selectDialog('Choose any writable folder for the ChartLingo package');
  if (!destinationFolder) return;
  var selectedDestinationFolder = destinationFolder;
  var destination = null;
  var exportDiagnostics = {destinationFolder: '', resolvedDestinationFolder: '', destinationExists: false, destinationReadable: false, destinationWritable: false, writeTestPassed: false, expectedFiles: [], actualFiles: [], verifiedFiles: [], missingFiles: [], fileSizes: {}, fileErrors: [], exportMode: exportChoice.mode === 0 ? 'single artboard' : 'multiple artboards', imageMode: exportChoice.imageMode, artboardsRequested: exportChoice.indices.length, artboardsCompleted: 0, filesWritten: 0, filesVerified: 0, exportSucceeded: false};
  try { $.global.__chartLingoExportDiagnostics = exportDiagnostics; } catch (_) {}
  var selectedLookup = {}, selectedIndices = exportChoice.indices, selectionIndex;
  for (selectionIndex = 0; selectionIndex < selectedIndices.length; selectionIndex++) selectedLookup[selectedIndices[selectionIndex]] = true;
  var cancelled = false, progressWindow = new Window('palette', 'ChartLingo Export'), progressText, progressBar, cancelButton;
  progressWindow.orientation = 'column'; progressWindow.alignChildren = ['fill', 'top']; progressText = progressWindow.add('statictext', undefined, 'Preparing selected artboard…');
  progressBar = progressWindow.add('progressbar', undefined, 0, 100); progressBar.preferredSize = [420, 16];
  cancelButton = progressWindow.add('button', undefined, 'Cancel export'); cancelButton.onClick = function () { cancelled = true; progressText.text = 'Cancelling safely…'; progressWindow.update(); };
  progressWindow.show();
  function progress(stage, current, total, artboardName) {
    if (cancelled) throw new Error('__CHARTLINGO_CANCELLED__');
    var safeTotal = Math.max(1, total), percent = Math.max(0, Math.min(100, Math.round(current / safeTotal * 100)));
    progressText.text = stage + (artboardName ? ' — ' + artboardName : '') + ' · ' + current + '/' + total; progressBar.value = percent;
    if (current === 0 || current === total || current % 10 === 0) progressWindow.update();
    if (cancelled) throw new Error('__CHARTLINGO_CANCELLED__');
  }
  var initialActiveArtboard = doc.artboards.getActiveArtboardIndex();
  try {

  var NORMALIZED_OUTPUT_WIDTH = 1200;
  var MAX_OPTIMIZED_IMAGE_DIMENSION = 1200;
  var OPTIMIZED_JPEG_QUALITY = 80;
  var DEFAULT_EXPORT_FONT_FAMILY = 'Noto Sans SC';
  var DEFAULT_EXPORT_FONT_STYLE = 'Regular';
  var DEFAULT_EXPORT_FONT_WEIGHT = 400;
  var imageOptimizationStats = {};

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
      for (i = 0; i < value.length; i++) parts.push((indent ? next : '') + jsonStringify(value[i], indent, level + 1));
      if (!parts.length) return '[]';
      return indent ? '[\n' + parts.join(',\n') + '\n' + current + ']' : '[' + parts.join(',') + ']';
    }
    if (type === 'object') {
      for (key in value) if (value.hasOwnProperty(key) && typeof value[key] !== 'undefined' && typeof value[key] !== 'function') parts.push((indent ? next : '') + jsonQuote(key) + (indent ? ': ' : ':') + jsonStringify(value[key], indent, level + 1));
      if (!parts.length) return '{}';
      return indent ? '{\n' + parts.join(',\n') + '\n' + current + '}' : '{' + parts.join(',') + '}';
    }
    return 'null';
  }

  function filesystemError(type, operation, message, file, underlying) {
    var error = new Error(message);
    error.chartLingoType = type;
    error.chartLingoOperation = operation;
    error.chartLingoFile = file ? displayPath(file) : '';
    error.chartLingoUnderlying = String(underlying || 'Unknown filesystem error');
    return error;
  }
  function displayPath(entry) {
    if (!entry) return '';
    try { if (entry.fsName) return String(entry.fsName); } catch (_) {}
    try { if (entry.fullName) return File.decode(String(entry.fullName)); } catch (_) {}
    return String(entry);
  }
  function normalizePath(value) {
    var path = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
    return $.os && /windows/i.test($.os) ? path.toLowerCase() : path;
  }
  function resolveDestinationFolder(folder) {
    var resolved = folder;
    if (!folder) throw filesystemError('destination_folder_missing', 'select destination folder', 'No destination folder was selected.', null, 'Folder.selectDialog returned no folder.');
    try {
      if (folder.alias) {
        resolved = folder.resolve();
        if (!resolved) throw new Error('The selected alias could not be resolved.');
      }
    } catch (aliasError) {
      throw filesystemError('invalid_destination_path', 'resolve destination folder', 'The selected destination folder is an unresolved alias.', folder, aliasError.message || aliasError);
    }
    if (!(resolved instanceof Folder)) resolved = new Folder(resolved);
    if (!resolved.exists) throw filesystemError('destination_folder_missing', 'validate destination folder', 'The selected destination folder does not exist.', resolved, resolved.error);
    return resolved;
  }
  function safeFileName(value, fallback) {
    var name = clean(value).replace(/[\\\/:*?"<>|]+/g, '-').replace(/[.\s]+$/g, '').replace(/^\s+|\s+$/g, '');
    return name || fallback || 'chartlingo-export';
  }
  function fileInFolder(folder, filename) {
    var base = String(folder.absoluteURI || folder.fullName || '');
    if (!base) throw filesystemError('invalid_destination_path', 'build output path', 'Illustrator could not resolve the selected destination path.', folder, folder.error);
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return new File(base + encodeURIComponent(filename));
  }
  function uniqueFile(folder, filename) {
    var dot = filename.toLowerCase().lastIndexOf('.chartlingo'), stem = dot >= 0 ? filename.substring(0, dot) : filename, extension = dot >= 0 ? filename.substring(dot) : '.chartlingo';
    var candidate = fileInFolder(folder, stem + extension), number = 2;
    while (candidate.exists) { candidate = fileInFolder(folder, stem + '-' + number + extension); number++; }
    return candidate;
  }
  function testDestinationFolder(folder) {
    var testFile = null, opened = false, closed = false, testText = 'ChartLingo write test ' + new Date().getTime();
    exportDiagnostics.destinationFolder = displayPath(selectedDestinationFolder);
    exportDiagnostics.resolvedDestinationFolder = displayPath(folder);
    exportDiagnostics.destinationExists = !!folder.exists;
    try { folder.getFiles(); exportDiagnostics.destinationReadable = true; }
    catch (readError) { throw filesystemError('invalid_destination_path', 'read selected folder', 'Illustrator cannot read the selected destination folder.', folder, readError.message || readError); }
    try {
      testFile = fileInFolder(folder, '.chartlingo-write-test-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000) + '.tmp');
      testFile.encoding = 'UTF-8';
      opened = testFile.open('w');
      if (!opened) throw filesystemError(/denied|permission/i.test(String(testFile.error)) ? 'permission_denied' : 'destination_folder_not_writable', 'open write-test file', 'The selected folder is not writable by Adobe Illustrator.', testFile, testFile.error);
      if (!testFile.write(testText)) throw filesystemError('file_write_failed', 'write test data', 'The selected folder is not writable by Adobe Illustrator.', testFile, testFile.error);
      closed = testFile.close(); opened = false;
      if (closed === false) throw filesystemError('file_close_failed', 'close write-test file', 'Illustrator could not finish the destination-folder write test.', testFile, testFile.error);
      testFile = new File(testFile.absoluteURI);
      if (!testFile.exists || testFile.length <= 0) throw filesystemError('destination_folder_not_writable', 'verify write-test file', 'The selected folder did not preserve the write-test file.', testFile, testFile.error);
      exportDiagnostics.destinationWritable = true; exportDiagnostics.writeTestPassed = true;
    } catch (writeTestError) {
      if (opened && testFile) try { testFile.close(); } catch (_) {}
      if (testFile && testFile.exists) try { testFile.remove(); } catch (_) {}
      if (writeTestError.chartLingoType) throw writeTestError;
      throw filesystemError(/denied|permission/i.test(String(writeTestError.message || writeTestError)) ? 'permission_denied' : 'destination_folder_not_writable', 'test write permission', 'The selected folder is not writable by Adobe Illustrator.', testFile || folder, writeTestError.message || writeTestError);
    }
    if (testFile && testFile.exists) try { testFile.remove(); } catch (_) {}
  }
  function parseJson(text) {
    if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(text);
    return eval('(' + text + ')');
  }

  function clean(value) { return String(value || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  destinationFolder = resolveDestinationFolder(destinationFolder);
  testDestinationFolder(destinationFolder);
  if (!exportChoice.separate) {
    destination = uniqueFile(destinationFolder, safeFileName(doc.name.replace(/\.[^.]+$/, ''), 'chartlingo-export') + '.chartlingo');
    exportDiagnostics.expectedFiles.push(displayPath(destination));
  }
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
  function joinedNumericAxisLines(values) {
    var parts = [], lines = [], i, value;
    for (i = 0; i < values.length; i++) { value = clean(values[i]); if (value) parts.push(value); }
    if (parts.length < 6 || parts.length % 2 !== 0) return parts;
    for (i = 0; i < parts.length; i += 2) {
      if (!/^[+\-−]?\d+$/.test(parts[i]) || !/^[.,]\d+%?$/.test(parts[i + 1])) return parts;
      lines.push(parts[i] + parts[i + 1]);
    }
    return lines;
  }
  function rawFrameLines(frame) {
    var raw = '', parts = [], values = [], i, value;
    try { raw = String(frame.contents || ''); } catch (_) { raw = ''; }
    parts = raw.split(/[\r\n]+/);
    for (i = 0; i < parts.length; i++) { value = clean(parts[i]); if (value) values.push(value); }
    return values;
  }
  function fastTextBounds(frame) {
    try { return frame.geometricBounds; } catch (_) {}
    return frame.visibleBounds;
  }
  function visibleLines(frame) {
    var values = rawFrameLines(frame);
    return joinedNumericAxisLines(values.length ? values : [clean(frame.contents)]);
  }
  function hasUniformLineFontSize(frame) {
    return rawFrameLines(frame).length > 0;
  }
  function estimatedTextSize(box, contents, artboardWidth) {
    var lineCount = Math.max(1, String(contents || '').split(/[\r\n]+/).length), height = Math.max(1, Number(box && box.height) || 0), estimate = height / lineCount / 1.2, safeMaximum = Math.max(14, Number(artboardWidth || 0) * 0.1);
    if (!isFinite(estimate) || estimate <= 0) estimate = 14;
    return Math.max(6, Math.min(safeMaximum, estimate));
  }

  // Virtual cells inherit the source frame's typography, but their physical row
  // can be much smaller than the source TextFrame. Clamp only virtual text so
  // table/list/axis/credit records cannot receive a font larger than their row.
  function virtualTextSize(sourceSize, cellHeight) {
    var source = Math.max(6, Number(sourceSize) || 14), height = Math.max(1, Number(cellHeight) || 0);
    return Math.max(6, Math.min(source, height * 0.72));
  }

  function virtualPermittedHeight(cellHeight, fontSize) {
    return Math.max(Math.max(1, Number(cellHeight) || 0), Math.max(6, Number(fontSize) || 6) * 1.35);
  }
  function lineWords(line) {
    var values = [], parts = clean(String(line || '')).split(/[\t ]+/), i;
    for (i = 0; i < parts.length; i++) if (parts[i]) values.push(parts[i]);
    return values;
  }
  function pairedAxisLabels(frame) {
    var lines = rawFrameLines(frame), first, second, result = [], i;
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
    var lines = visibleLines(frame), result = [], normalized, i;
    if (lines.length < 2) return null;
    for (i = 0; i < lines.length; i++) {
      normalized = clean(lines[i]).replace(/\uFF0F/g, '/').replace(/\uFF1A/g, ':');
      if (!/^(?:早报图表|联合早报图表|早报地图|早報地圖|图表|圖表|地图|地圖|资料来源|資料來源|数据来源|數據來源|来源|來源)\s*[:\/]/.test(normalized)) return null;
      result.push(lines[i]);
    }
    return result;
  }
  function tableRows(frame) {
    var raw = String(frame.contents || ''), rows = raw.split(/[\r\n]+/), result = [], numbered = [], plain = [], i, cells, j, useful, match, numericScale = true, splitColumns = false;
    if (raw.indexOf('\t') < 0) {
      for (i = 0; i < rows.length; i++) {
        if (!clean(rows[i])) continue;
        match = rows[i].match(/^\s*(\d+)[\.\)\u3001]?\s*(\D.+?)\s*$/);
        if (match) numbered.push([clean(match[1]), clean(match[2])]);
        plain.push([clean(rows[i])]);
        cells = rows[i].split(/ {2,}|\u3000+|\s+(?=[^\s]{1,12}[\uFF1A:])/); useful = false;
        for (j = 0; j < cells.length; j++) { cells[j] = clean(cells[j]); if (cells[j]) useful = true; }
        if (cells.length > 1) splitColumns = true;
        if (useful) result.push(cells);
        if (!/^[+\-−]?(?:\d+(?:[.,]\d+)?|[.,]\d+)%?$/.test(clean(rows[i]))) numericScale = false;
      }
      if (numbered.length === plain.length && numbered.length >= 2) {
        numbered.numberedList = true;
        return numbered;
      }
      /* Illustrator often stores several independent labels in one line and
         separates them with repeated or full-width spaces rather than tabs.
         Export those labels as independent virtual cells so each can match a
         CH/EN row without modifying the Illustrator document. */
      if (splitColumns) { result.spacedColumns = true; return result; }
      /* Multi-line chart scales (1.2, 1.0, 0.8...) are one Illustrator
         text frame, not a list. Keep the frame intact so decimals and their
         shared alignment/leading cannot be reconstructed incorrectly. The
         importer also repairs Illustrator line collections that expose a
         decimal as adjacent fragments such as "1" and ".2". */
      if (plain.length >= 3 && numericScale) return null;
      if (plain.length >= 2) {
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
  /* Read Illustrator paragraph tab stops once per source TextFrame.  A tabbed
     table should keep Illustrator's own horizontal anchors instead of being
     reconstructed as equal-width columns.  The function is deliberately
     conservative: if Illustrator does not expose enough sane tab positions,
     the existing dynamic-grid fallback is used unchanged. */
  function illustratorTabLayout(frame, count, width, availableWidth) {
    var limit = Math.max(1, Number(availableWidth) || width), bestStops = null, bestCount = 0;
    var p, stops, i, pos, candidate, seen, last, needed = Math.max(0, count - 1);
    if (count < 2 || needed < 1) return null;
    try {
      for (p = 0; p < frame.paragraphs.length; p++) {
        stops = frame.paragraphs[p].paragraphAttributes.tabStops;
        if (!stops || !stops.length) continue;
        candidate = []; seen = {};
        for (i = 0; i < stops.length; i++) {
          try { pos = Number(stops[i].position); } catch (_) { pos = NaN; }
          if (!isFinite(pos) || pos <= 0 || pos >= limit) continue;
          pos = Math.round(pos * 1000) / 1000;
          if (seen[String(pos)]) continue;
          seen[String(pos)] = true;
          candidate.push({position: pos, alignment: tabAlignment(stops[i])});
        }
        candidate.sort(function (a, b) { return a.position - b.position; });
        if (candidate.length > bestCount) { bestStops = candidate; bestCount = candidate.length; }
        if (candidate.length >= needed) break;
      }
    } catch (_) { bestStops = null; }
    if (!bestStops || bestStops.length < needed) return null;

    var anchors = [0], aligns = ['left'], columns = [], next, resolvedWidth, step;
    for (i = 0; i < needed; i++) {
      if (bestStops[i].position <= anchors[anchors.length - 1]) return null;
      anchors.push(bestStops[i].position);
      aligns.push(bestStops[i].alignment || 'left');
    }
    last = anchors[anchors.length - 1];
    step = anchors.length > 1 ? Math.max(1, last - anchors[anchors.length - 2]) : width;
    resolvedWidth = Math.min(limit, Math.max(width, last + step));
    for (i = 0; i < count; i++) {
      next = i + 1 < anchors.length ? anchors[i + 1] : resolvedWidth;
      if (next <= anchors[i]) return null;
      columns.push({x: anchors[i], width: Math.max(1, next - anchors[i]), alignment: aligns[i] || 'left', layoutSource: 'illustrator-tab', tabAnchor: anchors[i]});
    }
    return columns;
  }

  function tableColumns(frame, count, width, numberedList, availableWidth) {
    var strict = illustratorTabLayout(frame, count, width, availableWidth);
    if (strict) return strict;
    var anchors = [0], aligns = ['left'], i, step, next, columns = [], limit, resolvedWidth;
    limit = Math.max(1, Number(availableWidth) || width);
    for (i = 1; i < count; i++) {
      step = numberedList && count === 2 ? width * 0.28 : width / count; anchors.push(i === 1 && numberedList && count === 2 ? step : width / count * i); aligns.push('left');
    }
    step = count > 1 ? Math.max(1, anchors[count - 1] - anchors[count - 2]) : width;
    resolvedWidth = Math.min(limit, Math.max(width, anchors[count - 1] + step));
    for (i = 0; i < count; i++) {
      next = i + 1 < anchors.length ? anchors[i + 1] : resolvedWidth;
      columns.push({x: anchors[i], width: Math.max(1, next - anchors[i]), alignment: aligns[i], layoutSource: 'reconstructed-grid', tabAnchor: anchors[i]});
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
    function tinted(hex, tint) {
      var amount = Math.max(0, Math.min(100, Number(tint))) / 100;
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
      return '#' + h(255 - (255 - parseInt(hex.substring(1, 3), 16)) * amount) + h(255 - (255 - parseInt(hex.substring(3, 5), 16)) * amount) + h(255 - (255 - parseInt(hex.substring(5, 7), 16)) * amount);
    }
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
      if (color.typename === 'SpotColor' && color.spot && color.spot.color) {
        return tinted(colorHex(color.spot.color), color.tint == null ? 100 : color.tint);
      }
    } catch (_) {}
    return '#14283f';
  }
  function leadingLegendGlyph(value) {
    var match = /^\s*([■□▪▫●○◆◇▲△▼▽])\s*/.exec(String(value || ''));
    return match ? match[1] : null;
  }
  function legendInfo(frame, value) {
    var glyph = leadingLegendGlyph(value), result = null, color = null, size = null;
    if (!glyph) return null;
    try { color = colorHex(frame.characters[0].characterAttributes.fillColor); } catch (_) {}
    try { size = Number(frame.characters[0].characterAttributes.size); } catch (_) { size = null; }
    result = {glyph: glyph, fill: color || '#14283f', fontSize: isFinite(size) && size > 0 ? size : null};
    return result;
  }
  function withoutLegendGlyph(value) {
    return clean(String(value || '').replace(/^\s*[■□▪▫●○◆◇▲△▼▽]\s*/, ''));
  }
  function attachLegendMetadata(record, frame, rawValue) {
    var legend = legendInfo(frame, rawValue);
    if (!legend) return record;
    record.sourceText = withoutLegendGlyph(rawValue);
    record.visibleLines = [record.sourceText];
    record.prefixGlyph = legend.glyph;
    record.prefixStyle = {fill: legend.fill, fontSize: legend.fontSize || record.style.fontSize, preserveOriginalColor: true};
    record.preservePrefixGlyph = true;
    record.matchText = record.sourceText;
    return record;
  }
  function graphicTextType(value, frameName, layerName) {
    var text = clean(value), hint = String(frameName || '') + ' ' + String(layerName || ''), probe = text, lower;
    function simpleNumber(candidate) { return /^[+\-]?\d+(?:[.,]\d+)?$/.test(clean(candidate)); }
    if (/%$/.test(probe)) { probe = clean(probe.substring(0, probe.length - 1)); if (simpleNumber(probe)) return 'graphic-percentage'; probe = text; }
    if (/^[¥￥$€£]/.test(probe)) probe = clean(probe.substring(1));
    if (/人民币$/.test(probe)) probe = clean(probe.substring(0, probe.length - 3));
    else if (/美元$/.test(probe)) probe = clean(probe.substring(0, probe.length - 2));
    else if (/元$/.test(probe)) probe = clean(probe.substring(0, probe.length - 1));
    lower = probe.toLowerCase();
    if (/billion$/.test(lower)) probe = clean(probe.substring(0, probe.length - 7));
    else if (/million$/.test(lower)) probe = clean(probe.substring(0, probe.length - 7));
    else if (/bn$/.test(lower)) probe = clean(probe.substring(0, probe.length - 2));
    else if (/m$/.test(lower)) probe = clean(probe.substring(0, probe.length - 1));
    else if (/[亿万千百]$/.test(probe)) probe = clean(probe.substring(0, probe.length - 1));
    if (simpleNumber(probe)) return 'graphic-value';
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
  var sourceGroupCacheItems = [], sourceGroupCacheValues = [];
  function sourceGroupKey(item, rect) {
    var parent = item, bounds, name, layer, cacheIndex;
    while (parent) {
      try {
        if (parent.typename === 'GroupItem') {
          for (cacheIndex = 0; cacheIndex < sourceGroupCacheItems.length; cacheIndex++) if (sourceGroupCacheItems[cacheIndex] === parent) return sourceGroupCacheValues[cacheIndex];
          bounds = parent.visibleBounds; name = String(parent.name || 'group'); layer = String(parent.layer ? parent.layer.name : '');
          var groupKey = layer + '|' + name + '|' + Math.round(bounds[0] - rect[0]) + '|' + Math.round(rect[1] - bounds[1]) + '|' + Math.round(bounds[2] - bounds[0]) + '|' + Math.round(bounds[1] - bounds[3]);
          sourceGroupCacheItems.push(parent); sourceGroupCacheValues.push(groupKey);
          return groupKey;
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
  function normalizeAdobeSvgNamespaces(value) {
    return String(value || '').replace(/&ns_extend;/g, 'http://ns.adobe.com/Extensibility/1.0/').replace(/&ns_ai;/g, 'http://ns.adobe.com/AdobeIllustrator/10.0/').replace(/&ns_graphs;/g, 'http://ns.adobe.com/Graphs/1.0/');
  }
  function stripInvalidXmlCharacters(value) {
    return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  }
  function readBinaryFile(file) {
    var value = '', opened = false;
    try {
      file.encoding = 'BINARY'; opened = file.open('r');
      if (!opened) throw new Error(file.error || 'Could not open raster file.');
      value = file.read(); file.close(); opened = false;
      return value;
    } finally { if (opened) try { file.close(); } catch (_) {} }
  }
  function writeBinaryFile(file, value) {
    var opened = false;
    try {
      file.encoding = 'BINARY'; opened = file.open('w');
      if (!opened) throw new Error(file.error || 'Could not create temporary raster file.');
      if (!file.write(value)) throw new Error(file.error || 'Could not write temporary raster file.');
      file.close(); opened = false;
    } finally { if (opened) try { file.close(); } catch (_) {} }
  }
  function base64Decode(value) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', cleanValue = String(value || '').replace(/[^A-Za-z0-9+\/=]/g, ''), output = [], i, a, b, c, d, triplet;
    for (i = 0; i < cleanValue.length; i += 4) {
      a = alphabet.indexOf(cleanValue.charAt(i)); b = alphabet.indexOf(cleanValue.charAt(i + 1));
      c = cleanValue.charAt(i + 2) === '=' ? -1 : alphabet.indexOf(cleanValue.charAt(i + 2));
      d = cleanValue.charAt(i + 3) === '=' ? -1 : alphabet.indexOf(cleanValue.charAt(i + 3));
      if (a < 0 || b < 0) continue;
      triplet = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
      output.push(String.fromCharCode((triplet >> 16) & 255));
      if (c >= 0) output.push(String.fromCharCode((triplet >> 8) & 255));
      if (d >= 0) output.push(String.fromCharCode(triplet & 255));
    }
    return output.join('');
  }
  function base64Encode(value) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', output = [], i, a, b, c, triplet;
    for (i = 0; i < value.length; i += 3) {
      a = value.charCodeAt(i) & 255; b = i + 1 < value.length ? value.charCodeAt(i + 1) & 255 : -1; c = i + 2 < value.length ? value.charCodeAt(i + 2) & 255 : -1;
      triplet = (a << 16) | ((b < 0 ? 0 : b) << 8) | (c < 0 ? 0 : c);
      output.push(alphabet.charAt((triplet >> 18) & 63), alphabet.charAt((triplet >> 12) & 63), b < 0 ? '=' : alphabet.charAt((triplet >> 6) & 63), c < 0 ? '=' : alphabet.charAt(triplet & 63));
    }
    return output.join('');
  }
  function pngNeedsTransparency(binary) {
    var colorType;
    if (!binary || binary.length < 29 || binary.substring(1, 4) !== 'PNG') return false;
    colorType = binary.charCodeAt(25) & 255;
    return colorType === 4 || colorType === 6 || binary.indexOf('tRNS') >= 0;
  }
  function svgNumberAttribute(tag, name) {
    var pattern = new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']+)[\"']", 'i'), match = pattern.exec(tag), value;
    if (!match) return 0;
    value = parseFloat(String(match[1]).replace(/[^0-9eE+\-.]/g, ''));
    return isFinite(value) ? Math.abs(value) : 0;
  }
  function svgImageScale(tag) {
    var match = /\btransform\s*=\s*["'][^"']*matrix\s*\(\s*([+\-0-9.eE]+)[ ,]+([+\-0-9.eE]+)[ ,]+([+\-0-9.eE]+)[ ,]+([+\-0-9.eE]+)/i.exec(tag), scaleX = 1, scaleY = 1;
    if (match) {
      scaleX = Math.sqrt(Number(match[1]) * Number(match[1]) + Number(match[2]) * Number(match[2])) || 1;
      scaleY = Math.sqrt(Number(match[3]) * Number(match[3]) + Number(match[4]) * Number(match[4])) || 1;
    }
    return {x: scaleX, y: scaleY};
  }
  function svgImageHref(tag) {
    var pattern = /(^|\s)(xlink:href|href)\s*=\s*(["'])([^"']*)\3/ig, match, value, fallback = null, rejected = null;
    while ((match = pattern.exec(tag))) {
      value = String(match[4] || '').replace(/^\s+|\s+$/g, '');
      if (!value || /^(?:visible|hidden|inherit|auto|none)$/i.test(value)) { if (!rejected) rejected = {index: match.index, length: match[0].length, leading: match[1], name: match[2], quote: match[3], value: value, invalid: true}; continue; }
      if (!fallback) fallback = {index: match.index, length: match[0].length, leading: match[1], name: match[2], quote: match[3], value: value};
      if (/^data:image\//i.test(value) || /^file:/i.test(value) || /[\/.](?:jpe?g|png|gif|tiff?|psd|bmp|webp)(?:[?#].*)?$/i.test(value)) return {index: match.index, length: match[0].length, leading: match[1], name: match[2], quote: match[3], value: value};
    }
    return fallback || rejected;
  }
  function temporaryRasterFiles(folder, output) {
    var entries = [], i, name;
    output = output || [];
    try { entries = folder.getFiles(); } catch (_) { entries = []; }
    for (i = 0; i < entries.length; i++) {
      if (entries[i] instanceof Folder) temporaryRasterFiles(entries[i], output);
      else {
        name = String(entries[i].name || '').toLowerCase();
        if (/\.(?:jpe?g|png|gif|tiff?|psd|bmp|webp)$/.test(name) && !/^optimized-/.test(name) && !/^embedded-source-/.test(name)) output.push(entries[i]);
      }
    }
    output.sort(function (a, b) { return String(a.fsName).localeCompare(String(b.fsName)); });
    return output;
  }
  function originalPlacedImageFile(artboardIndex, imageNumber) {
    var record, item, file;
    try {
      record = artboardsByIndex[artboardIndex].imageObjects[imageNumber - 1];
      if (!record || record.illustrator.typename !== 'PlacedItem') return null;
      item = doc.placedItems[record.illustrator.itemIndex]; file = item.file;
      return file && file.exists ? file : null;
    } catch (_) { return null; }
  }
  function decodedImageFile(href, temporaryFolder, imageNumber) {
    var dataMatch = /^data:image\/(jpeg|jpg|png);base64,([\s\S]+)$/i.exec(href), extension, file, decoded, path;
    if (dataMatch) {
      extension = /png/i.test(dataMatch[1]) ? 'png' : 'jpg'; file = new File(temporaryFolder.fsName + '/embedded-source-' + imageNumber + '.' + extension);
      decoded = base64Decode(dataMatch[2]); writeBinaryFile(file, decoded);
      return {file: file, binary: decoded, temporary: true, extension: extension};
    }
    path = String(href || '').replace(/&amp;/g, '&').replace(/^file:\/\//i, '');
    try { path = File.decode(path); } catch (_) {}
    file = /^\/?[A-Za-z]:[\/\\]|^\//.test(path) ? new File(path) : new File(temporaryFolder.fsName + '/' + path);
    if (!file.exists) throw new Error('Illustrator created an unreadable temporary raster reference: ' + href);
    extension = String(file.name || '').toLowerCase().replace(/^.*\./, '');
    decoded = readBinaryFile(file);
    return {file: file, binary: decoded, temporary: false, extension: extension};
  }
  function removeTemporaryTree(folder) {
    var entries = [], i;
    if (!folder || !folder.exists) return;
    try { entries = folder.getFiles(); } catch (_) { entries = []; }
    for (i = 0; i < entries.length; i++) {
      try { if (entries[i] instanceof Folder) removeTemporaryTree(entries[i]); else if (entries[i].exists) entries[i].remove(); } catch (_) {}
    }
    try { folder.remove(); } catch (_) {}
  }
  function resampleImage(source, targetWidth, targetHeight, preserveTransparency, temporaryFolder, imageNumber, artboardName) {
    var imageDocument = null, outputFile = null, pageItem = null, bounds, sourceWidth, sourceHeight, scale, outputWidth, outputHeight, jpegOptions, pngOptions, binary, mime;
    try {
      imageDocument = app.open(source.file);
      if (!imageDocument.pageItems.length) throw new Error('The temporary raster document contains no image.');
      pageItem = imageDocument.pageItems[0]; bounds = pageItem.visibleBounds;
      sourceWidth = Math.max(1, Math.abs(Number(bounds[2]) - Number(bounds[0]))); sourceHeight = Math.max(1, Math.abs(Number(bounds[1]) - Number(bounds[3])));
      scale = Math.min(1, targetWidth / sourceWidth, targetHeight / sourceHeight);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      outputWidth = Math.max(1, Math.round(sourceWidth * scale)); outputHeight = Math.max(1, Math.round(sourceHeight * scale));
      if (scale < 0.9999) pageItem.resize(scale * 100, scale * 100, true, true, true, true, scale * 100, Transformation.CENTER);
      bounds = pageItem.visibleBounds; imageDocument.artboards[0].artboardRect = [bounds[0], bounds[1], bounds[2], bounds[3]];
      if (preserveTransparency) {
        outputFile = new File(temporaryFolder.fsName + '/optimized-' + imageNumber + '.png'); pngOptions = new ExportOptionsPNG24();
        pngOptions.antiAliasing = true; pngOptions.artBoardClipping = true; pngOptions.transparency = true; pngOptions.horizontalScale = 100; pngOptions.verticalScale = 100;
        imageDocument.exportFile(outputFile, ExportType.PNG24, pngOptions); mime = 'image/png';
      } else {
        outputFile = new File(temporaryFolder.fsName + '/optimized-' + imageNumber + '.jpg'); jpegOptions = new ExportOptionsJPEG();
        jpegOptions.antiAliasing = true; jpegOptions.artBoardClipping = true; jpegOptions.optimization = true; jpegOptions.qualitySetting = OPTIMIZED_JPEG_QUALITY; jpegOptions.horizontalScale = 100; jpegOptions.verticalScale = 100;
        imageDocument.exportFile(outputFile, ExportType.JPEG, jpegOptions); mime = 'image/jpeg';
      }
      if (!outputFile.exists || outputFile.length <= 0) throw new Error('Illustrator did not create the optimized raster file.');
      binary = readBinaryFile(outputFile);
      return {href: 'data:' + mime + ';base64,' + base64Encode(binary), format: preserveTransparency ? 'png' : 'jpeg', width: outputWidth, height: outputHeight, sourceBytes: source.binary.length, optimizedBytes: binary.length};
    } catch (imageError) {
      throw new Error('Photo optimization failed on ' + artboardName + ', image ' + imageNumber + ' (' + String(source.file.name || 'unnamed image') + '): ' + (imageError.message || imageError));
    } finally {
      if (imageDocument) try { imageDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {}
      if (outputFile && outputFile.exists) try { outputFile.remove(); } catch (_) {}
      if (source.temporary && source.file && source.file.exists) try { source.file.remove(); } catch (_) {}
      try { doc.activate(); } catch (_) {}
    }
  }
  function optimizeSvgImages(value, temporaryFolder, artboardIndex, artboardName) {
    var source = String(value || ''), imagePattern = /<image\b[^>]*>/gi, exportedRasterFiles = temporaryRasterFiles(temporaryFolder), cache = {}, count = 0, optimizedCount = 0, sourceBytes = 0, optimizedBytes = 0, formats = {};
    source = source.replace(imagePattern, function (tag) {
      var hrefMatch = svgImageHref(tag), href, width, height, scale, normalizedScale, targetWidth, targetHeight, sourceImage, preserveTransparency, signature, optimized, replacement;
      if (!hrefMatch) throw new Error('Photo optimization failed on ' + artboardName + ': an SVG image has no href.');
      count++; progress('Optimizing photos', count, Math.max(1, artboardsByIndex[artboardIndex].imageObjects.length), artboardName);
      if (hrefMatch.invalid && exportedRasterFiles[count - 1]) href = exportedRasterFiles[count - 1].fsName;
      else if (hrefMatch.invalid) { var placedFile = originalPlacedImageFile(artboardIndex, count); href = placedFile ? placedFile.fsName : hrefMatch.value; }
      else href = hrefMatch.value;
      if (!href || /^(?:visible|hidden|inherit|auto|none)$/i.test(href)) throw new Error('Photo optimization failed on ' + artboardName + ', image ' + count + ': Illustrator did not provide a readable raster file reference.');
      width = svgNumberAttribute(tag, 'width'); height = svgNumberAttribute(tag, 'height'); scale = svgImageScale(tag);
      normalizedScale = NORMALIZED_OUTPUT_WIDTH / Math.max(1, artboardsByIndex[artboardIndex].bounds.width);
      targetWidth = Math.max(1, Math.ceil(width * scale.x * normalizedScale)); targetHeight = Math.max(1, Math.ceil(height * scale.y * normalizedScale));
      normalizedScale = Math.min(1, MAX_OPTIMIZED_IMAGE_DIMENSION / targetWidth, MAX_OPTIMIZED_IMAGE_DIMENSION / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * normalizedScale)); targetHeight = Math.max(1, Math.round(targetHeight * normalizedScale));
      sourceImage = decodedImageFile(href, temporaryFolder, count); preserveTransparency = sourceImage.extension === 'png' && pngNeedsTransparency(sourceImage.binary);
      signature = sourceImage.binary.length + '|' + sourceImage.binary.substring(0, 48) + '|' + sourceImage.binary.substring(Math.max(0, sourceImage.binary.length - 48)) + '|' + targetWidth + 'x' + targetHeight + '|' + preserveTransparency;
      optimized = cache[signature];
      if (!optimized) { optimized = resampleImage(sourceImage, targetWidth, targetHeight, preserveTransparency, temporaryFolder, count, artboardName); cache[signature] = optimized; optimizedCount++; }
      else if (sourceImage.temporary && sourceImage.file.exists) try { sourceImage.file.remove(); } catch (_) {}
      sourceBytes += sourceImage.binary.length; optimizedBytes += optimized.optimizedBytes; formats[optimized.format] = true;
      replacement = hrefMatch.leading + hrefMatch.name + '=' + hrefMatch.quote + optimized.href + hrefMatch.quote;
      return tag.substring(0, hrefMatch.index) + replacement + tag.substring(hrefMatch.index + hrefMatch.length);
    });
    if (count) progress('Embedding optimized photos', count, count, artboardName);
    imageOptimizationStats[artboardIndex] = {imageCount: count, optimizedImageCount: optimizedCount, targetPpi: null, rasterSizing: 'normalized-output', normalizedOutputWidth: NORMALIZED_OUTPUT_WIDTH, maximumImageDimension: MAX_OPTIMIZED_IMAGE_DIMENSION, jpegQuality: OPTIMIZED_JPEG_QUALITY, imageFormat: formats.jpeg && formats.png ? 'jpeg-and-png' : formats.png ? 'png' : formats.jpeg ? 'jpeg' : 'none', sourceBytes: sourceBytes, optimizedBytes: optimizedBytes};
    return source;
  }
  function photoRasterTarget(item) {
    var parent = null, target = item;
    try { parent = item.parent; } catch (_) { parent = null; }
    while (parent && parent !== doc) {
      try { if (parent.typename === 'GroupItem' && parent.clipped) { target = parent; break; } } catch (_) {}
      try { parent = parent.parent; } catch (_) { parent = null; }
    }
    return target;
  }
  function normalizedRasterScale(artboardBounds, width, height) {
    var artboardWidth = Math.max(1, Number(artboardBounds[2]) - Number(artboardBounds[0])), scale = NORMALIZED_OUTPUT_WIDTH / artboardWidth * 100;
    if (width > 0) scale = Math.min(scale, MAX_OPTIMIZED_IMAGE_DIMENSION / width * 100);
    if (height > 0) scale = Math.min(scale, MAX_OPTIMIZED_IMAGE_DIMENSION / height * 100);
    return Math.max(1, scale);
  }
  function rasterizeDisplayedPhotos(artboardIndex, artboardRecord) {
    var states = [], targets = [], fallbackCount = 0, i, j, record, item, target, duplicate, raster, originalBounds, captureBounds, artboardBounds, options, rasterScale, resolution, seen, temporaryLayer, width, height, hidden, locked, targetLayer, layerLocked;
    for (i = 0; i < artboardRecord.imageObjects.length; i++) {
      record = artboardRecord.imageObjects[i]; item = null;
      try {
        if (record.illustrator.typename === 'PlacedItem') item = doc.placedItems[record.illustrator.itemIndex];
        else if (record.illustrator.typename === 'RasterItem') item = doc.rasterItems[record.illustrator.itemIndex];
      } catch (_) { item = null; }
      if (!item) continue;
      target = photoRasterTarget(item); seen = false;
      for (j = 0; j < targets.length; j++) if (targets[j] === target) { seen = true; break; }
      if (!seen) targets.push(target);
    }
    if (!targets.length) {
      imageOptimizationStats[artboardIndex] = {imageCount: 0, optimizedImageCount: 0, targetPpi: null, rasterSizing: 'normalized-output', normalizedOutputWidth: NORMALIZED_OUTPUT_WIDTH, maximumImageDimension: MAX_OPTIMIZED_IMAGE_DIMENSION, jpegQuality: null, imageFormat: 'none', sourceBytes: 0, optimizedBytes: 0};
      return states;
    }
    try {
      for (i = 0; i < targets.length; i++) {
        progress('Flattening visible photos in memory', i + 1, Math.max(1, targets.length), artboardRecord.name);
        target = targets[i]; duplicate = null; raster = null; temporaryLayer = null; hidden = false; locked = false; targetLayer = null; layerLocked = false;
        try { hidden = target.hidden; } catch (_) {}
        try { locked = target.locked; target.locked = false; } catch (_) {}
        try { targetLayer = target.layer; layerLocked = targetLayer.locked; targetLayer.locked = false; } catch (_) { targetLayer = null; }
        try {
          originalBounds = target.visibleBounds; artboardBounds = doc.artboards[artboardIndex].artboardRect;
          captureBounds = [Math.max(Number(originalBounds[0]), Number(artboardBounds[0])), Math.min(Number(originalBounds[1]), Number(artboardBounds[1])), Math.min(Number(originalBounds[2]), Number(artboardBounds[2])), Math.max(Number(originalBounds[3]), Number(artboardBounds[3]))];
          width = Math.max(1, captureBounds[2] - captureBounds[0]); height = Math.max(1, captureBounds[1] - captureBounds[3]);
          if (captureBounds[2] <= captureBounds[0] || captureBounds[1] <= captureBounds[3]) throw new Error('The photo does not overlap the selected artboard.');
          temporaryLayer = doc.layers.add(); temporaryLayer.name = '__ChartLingo isolated photo'; temporaryLayer.visible = true; temporaryLayer.locked = false;
          duplicate = target.duplicate(temporaryLayer, ElementPlacement.PLACEATBEGINNING);
          try { duplicate.hidden = false; } catch (_) {}
          try { duplicate.locked = false; } catch (_) {}
          rasterScale = normalizedRasterScale(artboardBounds, width, height);
          // Illustrator only accepts rasterization resolutions from 72 to 2400 PPI.
          // Large artboards can produce a normalized scale below 100%; never pass the
          // resulting sub-72 value to rasterize(), or Illustrator reports the vague
          // "Required value is missing" error and aborts the whole package export.
          resolution = Math.max(72, Math.min(2400, 72 * rasterScale / 100));
          options = new RasterizeOptions(); options.resolution = resolution; options.transparency = true; options.clippingMask = true; options.convertTextToOutlines = false;
          try { options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED; } catch (_) {}
          try { options.colorModel = RasterizationColorModel.RGB; } catch (_) {}
          raster = doc.rasterize(duplicate, captureBounds, options); duplicate = null;
          if (!raster) throw new Error('Illustrator did not create the in-memory raster.');
          try { raster.move(target, ElementPlacement.PLACEBEFORE); } catch (moveError) { throw new Error('Could not preserve the photo layer position: ' + (moveError.message || moveError)); }
          target.hidden = true;
          if (temporaryLayer) { try { temporaryLayer.remove(); } catch (_) {} temporaryLayer = null; }
          states.push({target: target, hidden: hidden, locked: locked, layer: targetLayer, layerLocked: layerLocked, raster: raster, duplicate: null});
        } catch (rasterError) {
          if (raster) try { raster.remove(); } catch (_) {}
          try { target.hidden = hidden; } catch (_) {}
          // Some placed artwork, clipping groups, meshes, effects, and legacy image
          // objects cannot be rasterized through Illustrator's scripting API. Keep
          // the original visible image for SVG export instead of aborting the whole
          // ChartLingo package. Other compatible photos are still optimized.
          fallbackCount++;
        } finally {
          if (temporaryLayer) try { temporaryLayer.remove(); } catch (_) {}
          try { target.locked = locked; } catch (_) {}
          if (targetLayer) try { targetLayer.locked = layerLocked; } catch (_) {}
        }
      }
      imageOptimizationStats[artboardIndex] = {imageCount: artboardRecord.imageObjects.length, optimizedImageCount: states.length, fallbackImageCount: fallbackCount, targetPpi: null, rasterSizing: 'normalized-output', normalizedOutputWidth: NORMALIZED_OUTPUT_WIDTH, maximumImageDimension: MAX_OPTIMIZED_IMAGE_DIMENSION, jpegQuality: null, imageFormat: fallbackCount ? 'embedded-raster-with-original-fallback' : 'embedded-raster', sourceBytes: 0, optimizedBytes: 0};
      return states;
    } catch (error) {
      restoreRasterizedPhotos(states);
      throw error;
    }
  }
  function restoreRasterizedPhotos(states) {
    var i, state, folder = null;
    for (i = states.length - 1; i >= 0; i--) {
      state = states[i];
      if (state.layer) try { state.layer.locked = false; } catch (_) {}
      if (state.raster) try { state.raster.locked = false; } catch (_) {}
      if (state.raster) try { state.raster.remove(); } catch (_) {}
      if (state.duplicate) try { state.duplicate.remove(); } catch (_) {}
      if (state.target) try { state.target.hidden = state.hidden; } catch (_) {}
      if (state.target) try { state.target.locked = state.locked; } catch (_) {}
      if (state.layer) try { state.layer.locked = state.layerLocked; } catch (_) {}
      if (state.file && state.file.exists) try { state.file.remove(); } catch (_) {}
      if (state.folder) folder = state.folder;
    }
    if (folder) try { removeTemporaryTree(folder); } catch (_) {}
  }
  function duplicateLogoOnTop(artboardIndex) {
    var logo = logoItemsByArtboard[artboardIndex], layer = null, duplicate = null;
    if (!logo) return null;
    try {
      layer = doc.layers.add(); layer.name = '__ChartLingo temporary top logo';
      duplicate = logo.duplicate(layer, ElementPlacement.PLACEATBEGINNING);
      try { duplicate.hidden = false; } catch (_) {}
      try { duplicate.locked = false; } catch (_) {}
      try { duplicate.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (_) {}
      return {layer: layer, duplicate: duplicate};
    } catch (logoError) {
      if (layer) try { layer.remove(); } catch (_) {}
      throw new Error('Could not place the ZB logo above the optimized photo on ' + doc.artboards[artboardIndex].name + ': ' + (logoError.message || logoError));
    }
  }
  function removeTemporaryTopLogo(state) {
    if (!state) return;
    if (state.layer) try { state.layer.remove(); } catch (_) {}
    else if (state.duplicate) try { state.duplicate.remove(); } catch (_) {}
  }
  function readSvg(artboardIndex, optimizedImages) {
    var stem = 'chartlingo-v2-preview-' + new Date().getTime() + '-' + artboardIndex, temporaryFolder = new Folder(Folder.temp.fsName + '/' + stem), temporary, generated, matches = [], value = '', cleanupIndex;
    if (!temporaryFolder.create() && !temporaryFolder.exists) throw new Error('Could not create the temporary ChartLingo image folder.');
    temporary = new File(temporaryFolder.fsName + '/' + stem + '.svg');
    var options = new ExportOptionsSVG();
    options.embedRasterImages = true;
    options.fontSubsetting = SVGFontSubsetting.None;
    options.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
    options.coordinatePrecision = optimizedImages ? 2 : 3;
    try { options.preserveEditability = false; } catch (_) {}
    try { options.optimizeForSVGViewer = true; } catch (_) {}
    try { options.includeFileInfo = false; } catch (_) {}
    try { options.includeUnusedStyles = false; } catch (_) {}
    options.saveMultipleArtboards = true;
    options.artboardRange = String(artboardIndex + 1);
    doc.artboards.setActiveArtboardIndex(artboardIndex);
    try {
      doc.exportFile(temporary, ExportType.SVG, options);
      generated = temporary;
      if (!generated.exists) { try { matches = temporaryFolder.getFiles(stem + '*.svg'); } catch (_) {} if (matches.length) generated = matches[0]; }
      if (!generated.exists) throw new Error('Illustrator did not create the cropped SVG for artboard ' + (artboardIndex + 1) + '.');
      generated.encoding = 'UTF-8'; generated.open('r'); value = generated.read(); generated.close();
      value = stripInvalidXmlCharacters(normalizeAdobeSvgNamespaces(value));
      return optimizedImages ? value.replace(/>\s+</g, '><') : value;
    } finally {
      try { for (cleanupIndex = 0; cleanupIndex < matches.length; cleanupIndex++) if (matches[cleanupIndex].exists) matches[cleanupIndex].remove(); } catch (_) {}
      removeTemporaryTree(temporaryFolder);
    }
  }
  function invalidSvgImageReason(value, expectedImages) {
    var source = String(value || ''), tagPattern = /<image\b[^>]*>/gi, hrefPattern = /(?:href|xlink:href)\s*=\s*["']([^"']*)["']/i, tag, href, payload, imageCount = 0;
    while ((tag = tagPattern.exec(source))) {
      imageCount++;
      href = hrefPattern.exec(tag[0]); href = href ? String(href[1] || '').replace(/^\s+|\s+$/g, '') : '';
      if (!href || /^(?:undefined|null)$/i.test(href)) return 'Image ' + imageCount + ' has an empty or invalid href.';
      if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(href)) return 'Image ' + imageCount + ' is still linked to an external file instead of embedded.';
      payload = href.substring(href.indexOf(',') + 1).replace(/\s+/g, '');
      if (payload.length < 16 || /[^A-Za-z0-9+\/=]/.test(payload)) return 'Image ' + imageCount + ' has invalid embedded base64 data.';
      if (!/\bwidth\s*=\s*["'][^"']*[1-9][^"']*["']/i.test(tag[0]) || !/\bheight\s*=\s*["'][^"']*[1-9][^"']*["']/i.test(tag[0])) return 'Image ' + imageCount + ' has invalid dimensions.';
    }
    if (Number(expectedImages || 0) > 0 && imageCount === 0) return 'The SVG contains no image element for ' + expectedImages + ' detected raster image(s).';
    return null;
  }
  function readArtworkWithoutLiveText(artboardIndex, artboardRecord, optimizedImages) {
    var states = [], rasterStates = [], logoState = null, value = '', i, frameIndex, seen = {};
    try {
      if (optimizedImages && artboardRecord.imageObjects.length) rasterStates = rasterizeDisplayedPhotos(artboardIndex, artboardRecord);
      if (optimizedImages && rasterStates.length) logoState = duplicateLogoOnTop(artboardIndex);
      for (i = 0; i < artboardRecord.textFrames.length; i++) {
        frameIndex = artboardRecord.textFrames[i].illustrator.textFrameIndex;
        if (seen[frameIndex]) continue; seen[frameIndex] = true;
        states.push({index: frameIndex, hidden: doc.textFrames[frameIndex].hidden, opacity: doc.textFrames[frameIndex].opacity});
        try { doc.textFrames[frameIndex].opacity = 0; } catch (_) {}
        try { doc.textFrames[frameIndex].hidden = true; } catch (_) {}
      }
      value = readSvg(artboardIndex, optimizedImages);
    }
    finally {
      for (i = 0; i < states.length; i++) {
        try { doc.textFrames[states[i].index].opacity = states[i].opacity; } catch (_) {}
        try { doc.textFrames[states[i].index].hidden = states[i].hidden; } catch (_) {}
      }
      if (optimizedImages) removeTemporaryTopLogo(logoState);
      if (optimizedImages) restoreRasterizedPhotos(rasterStates);
    }
    return value;
  }
  var logoItemsByArtboard = {};
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
          if (item.hidden) continue;
          hint = String(item.name || '') + ' ' + String(item.layer ? item.layer.name : '');
          named = /logo|brand|masthead|zaobao|早报|早報|联合早报|聯合早報/i.test(hint);
          // doc.groupItems contains every nested group. Most nested, unnamed
          // groups cannot be the final logo and repeatedly asking Illustrator
          // for their visibleBounds is very expensive on complex artwork.
          if (item.typename === 'GroupItem' && item.parent && item.parent.typename === 'GroupItem' && !named) continue;
          bounds = item.visibleBounds;
          box = localBounds(bounds, rect);
          centerX = box.x + box.width / 2; centerY = box.y + box.height / 2;
          if (centerX < 0 || centerX > boardWidth || centerY < 0 || centerY > boardHeight) continue;
          if (box.width < boardWidth * 0.015 || box.height < boardHeight * 0.015 || box.width > boardWidth * 0.25 || box.height > boardHeight * 0.25) continue;
          aspect = box.width / box.height;
          if (aspect < 0.4 || aspect > 2.5) continue;
          if (!named && (centerX < boardWidth * 0.58 || centerY < boardHeight * 0.58)) continue;
          score = (named ? 10000 : 0) + centerX / boardWidth * 100 + centerY / boardHeight * 120 + Math.min(box.width, box.height);
          if (score > bestScore) { bestScore = score; best = box; logoItemsByArtboard[artboardIndex] = item; }
        } catch (_) {}
      }
    }
    return best;
  }

  var artboards = [], artboardsByIndex = {}, i, documentHasRasterPhotos = false;
  try { documentHasRasterPhotos = doc.placedItems.length > 0 || doc.rasterItems.length > 0; } catch (_) { documentHasRasterPhotos = true; }
  for (selectionIndex = 0; selectionIndex < selectedIndices.length; selectionIndex++) {
    i = selectedIndices[selectionIndex];
    var rect = doc.artboards[i].artboardRect, width = rect[2] - rect[0], height = rect[1] - rect[3];
    // The temporary top-logo duplicate is only needed when a photo may be
    // rasterized beneath it. Pure vector/text charts must not pay for a full
    // nested-group logo scan before export begins.
    var artboardRecord = {id: 'artboard-' + (i + 1), name: doc.artboards[i].name || ('Artboard ' + (i + 1)), index: i, order: selectionIndex, position: {x: rect[0], y: rect[1]}, bounds: {x: 0, y: 0, width: width, height: height}, orientation: width >= height ? 'landscape' : 'portrait', background: {transparent: true}, objectCount: 0, layerNames: [], logoBounds: documentHasRasterPhotos ? logoBoundsForArtboard(i) : null, previewSvg: null, artworkSvg: null, textFrames: [], graphicElements: [], imageObjects: []};
    artboards.push(artboardRecord); artboardsByIndex[i] = artboardRecord;
  }
  var selectedArtboards = artboards.slice(0);
  artboards = [];
  for (selectionIndex = 0; selectionIndex < selectedArtboards.length; selectionIndex++) artboards[selectedArtboards[selectionIndex].index] = selectedArtboards[selectionIndex];
  var counters = [], exportedBlocks = 0, splitCells = 0, topHeaderSizes = [], textScanRecords = [], scanIndex, scanFrame, scanBounds, scanBoard, scanBox, scanSize, scanContents;
  for (i = 0; i < doc.artboards.length; i++) counters[i] = 0;
  /* Find the largest text frame in the top quarter of each artboard before
     splitting anything. A multi-line frame at that size is the headline and
     must remain one object when all of its lines use the same font size. */
  for (scanIndex = 0; scanIndex < doc.textFrames.length; scanIndex++) {
    progress('Indexing text on selected artboard', scanIndex, doc.textFrames.length, selectedIndices.length === 1 ? doc.artboards[selectedIndices[0]].name : 'selected artboards');
    scanFrame = doc.textFrames[scanIndex];
    try { scanContents = clean(scanFrame.contents); if (!scanContents) continue; } catch (_) { continue; }
    try { scanBounds = fastTextBounds(scanFrame); } catch (_) { continue; }
    scanBoard = artboardFor(scanBounds);
    if (scanBoard < 0 || !artboardsByIndex[scanBoard]) continue;
    scanBox = localBounds(scanBounds, doc.artboards[scanBoard].artboardRect);
    scanSize = estimatedTextSize(scanBox, scanContents, artboardsByIndex[scanBoard].bounds.width);
    // Use the same real Illustrator point-size basis during header preflight as
    // during record construction. Previously topHeaderSizes used the geometry
    // estimate (often ~30 pt) while processing used the real size (e.g. 18 pt),
    // so a genuine two-line headline failed isUniformHeader and was split by
    // tableRows() into two list-item records.
    try {
      var scanIllustratorPointSize = Number(scanFrame.textRange.characterAttributes.size);
      if (isFinite(scanIllustratorPointSize) && scanIllustratorPointSize > 0 && scanIllustratorPointSize < 1000) scanSize = scanIllustratorPointSize;
    } catch (_) {}
    textScanRecords.push({index: scanIndex, frame: scanFrame, contents: scanContents, bounds: scanBounds, boardIndex: scanBoard, box: scanBox, size: scanSize});
    if (scanBox.y <= artboardsByIndex[scanBoard].bounds.height * 0.25 && scanSize > (topHeaderSizes[scanBoard] || 0)) topHeaderSizes[scanBoard] = scanSize;
  }
  function numericFontWeight(styleName) {
    var value = String(styleName || '').replace(/[\s_-]+/g, '').toLowerCase();
    if (/thin/.test(value)) return 100;
    if (/extralight|ultralight/.test(value)) return 200;
    if (/light/.test(value)) return 300;
    if (/medium/.test(value)) return 500;
    if (/semibold|demibold/.test(value)) return 600;
    if (/extrabold|ultrabold|heavy/.test(value)) return 800;
    if (/black/.test(value)) return 900;
    if (/bold/.test(value)) return 700;
    return 400;
  }
  var outlinedCount = 0;
  for (i = 0; i < textScanRecords.length; i++) {
    progress('Scanning selected text', i, textScanRecords.length, selectedIndices.length === 1 ? doc.artboards[selectedIndices[0]].name : 'selected artboards');
    var scanRecord = textScanRecords[i], frame = scanRecord.frame, frameDocumentIndex = scanRecord.index, bounds = scanRecord.bounds, boardIndex = scanRecord.boardIndex;
    var boardRecord = artboardsByIndex[boardIndex], boardRect = doc.artboards[boardIndex].artboardRect, box = scanRecord.box, textIndex = counters[boardIndex]++, baseId = frameId(boardIndex, textIndex);
    var cachedFrameName = '', cachedLayerName = '';
    try { cachedFrameName = String(frame.name || ''); } catch (_) {}
    try { cachedLayerName = String(frame.layer ? frame.layer.name : ''); } catch (_) {}
    boardRecord.objectCount++;
    try { addLayer(boardRecord, frame.layer.name); } catch (_) {}
    var size = scanRecord.size || 14, leading = 0, family = DEFAULT_EXPORT_FONT_FAMILY, fill = '#14283f', justify = 'left', fontWeight = DEFAULT_EXPORT_FONT_WEIGHT, fontStyleName = DEFAULT_EXPORT_FONT_STYLE;
    // Preserve the real Illustrator point size when it is available. This is a
    // single scalar read per source TextFrame: unlike font family/name/style
    // resolution, it does not ask Illustrator to resolve a font object. The
    // geometry estimate remains the fallback for unusual/legacy frames.
    try {
      var illustratorPointSize = Number(frame.textRange.characterAttributes.size);
      if (isFinite(illustratorPointSize) && illustratorPointSize > 0 && illustratorPointSize < 1000) size = illustratorPointSize;
    } catch (_) {}
    leading = size * 1.2;
    // Font family/style lookup stays intentionally skipped for performance.
    // ChartLingo uses Noto Sans SC, while the original point size and geometry
    // are preserved. Virtual cells are still clamped to their physical row.
    var axisLabels = pairedAxisLabels(frame), credits = creditLines(frame), rows = tableRows(frame), isUniformHeader = box.y <= boardRecord.bounds.height * 0.25 && size >= (topHeaderSizes[boardIndex] || size) - 0.01 && hasUniformLineFontSize(frame), rowIndex, columnIndex, maxColumns = 0, columns, rowHeight, cell, cellBox, groupId, fieldType, itemId, cellSize, cellLeading;
    if (isUniformHeader) { axisLabels = null; credits = null; rows = null; }
    if (axisLabels) {
      rowHeight = box.height / 2;
      for (columnIndex = 0; columnIndex < axisLabels.length; columnIndex++) {
        cell = axisLabels[columnIndex]; groupId = baseId + '-x-' + (columnIndex + 1);
        cellBox = {x: box.x + box.width / axisLabels.length * columnIndex, y: box.y, width: box.width / axisLabels.length, height: rowHeight};
        cellSize = virtualTextSize(size, cellBox.height); cellLeading = cellSize * 1.2;
        artboards[boardIndex].textFrames.push({id: baseId + '-x' + (columnIndex + 1) + '-year', name: (frame.name || ('Text ' + (textIndex + 1))) + ' - Year ' + (columnIndex + 1), sourceText: cell.year, visibleLines: [cell.year], groupId: groupId, fieldType: 'year', kind: 'axis-year', role: 'AXIS_LABEL', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: virtualPermittedHeight(cellBox.height, cellSize)}, style: {fontFamily: family, fontSize: cellSize, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: cellLeading / cellSize, alignment: 'center', fill: fill}, illustrator: {textFrameIndex: frameDocumentIndex, virtualCell: true, axisField: 'year', row: 0, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        cellBox = {x: cellBox.x, y: box.y + rowHeight, width: cellBox.width, height: rowHeight};
        cellSize = virtualTextSize(size, cellBox.height); cellLeading = cellSize * 1.2;
        fieldType = periodFieldType(cell.period);
        artboards[boardIndex].textFrames.push({id: baseId + '-x' + (columnIndex + 1) + '-period', name: (frame.name || ('Text ' + (textIndex + 1))) + ' - Period ' + (columnIndex + 1), sourceText: cell.period, visibleLines: [cell.period], groupId: groupId, fieldType: fieldType, kind: 'axis-period', role: 'AXIS_LABEL', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: virtualPermittedHeight(cellBox.height, cellSize)}, style: {fontFamily: family, fontSize: cellSize, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: cellLeading / cellSize, alignment: 'center', fill: fill}, illustrator: {textFrameIndex: frameDocumentIndex, virtualCell: true, axisField: fieldType, row: 1, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        exportedBlocks += 2; splitCells += 2;
      }
    } else if (credits) {
      rowHeight = box.height / credits.length;
      for (rowIndex = 0; rowIndex < credits.length; rowIndex++) {
        cell = credits[rowIndex]; fieldType = /来源|來源/.test(cell) ? 'source' : 'credit'; itemId = baseId + '-' + fieldType; groupId = baseId + '-credits';
        cellBox = {x: box.x, y: box.y + rowHeight * rowIndex, width: box.width, height: rowHeight};
        cellSize = virtualTextSize(size, cellBox.height); cellLeading = cellSize * 1.2;
        artboards[boardIndex].textFrames.push({id: itemId, name: (frame.name || ('Text ' + (textIndex + 1))) + ' - ' + (fieldType === 'source' ? 'Source' : 'Credit'), sourceText: cell, visibleLines: [cell], groupId: groupId, fieldType: fieldType, kind: 'credit-line', role: fieldType === 'source' ? 'SOURCE' : 'FOOTNOTE', bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: Math.max(cellBox.width, artboards[boardIndex].bounds.width - cellBox.x - 12), height: virtualPermittedHeight(cellBox.height, cellSize)}, style: {fontFamily: family, fontSize: cellSize, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: cellLeading / cellSize, alignment: justify, fill: fill}, illustrator: {textFrameIndex: frameDocumentIndex, virtualCell: true, creditLine: true, row: rowIndex, column: 0, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}});
        exportedBlocks++; splitCells++;
      }
    } else if (rows) {
      for (rowIndex = 0; rowIndex < rows.length; rowIndex++) if (rows[rowIndex].length > maxColumns) maxColumns = rows[rowIndex].length;
      columns = tableColumns(frame, maxColumns, box.width, rows.numberedList, artboards[boardIndex].bounds.width - box.x); rowHeight = box.height / rows.length;
      for (rowIndex = 0; rowIndex < rows.length; rowIndex++) for (columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex++) {
        cell = rows[rowIndex][columnIndex]; if (!cell) continue;
        cellBox = {x: box.x + columns[columnIndex].x, y: box.y + rowHeight * rowIndex, width: columns[columnIndex].width, height: rowHeight};
        cellSize = virtualTextSize(size, cellBox.height); cellLeading = cellSize * 1.2;
        artboards[boardIndex].textFrames.push(attachLegendMetadata({id: baseId + '-r' + (rowIndex + 1) + '-c' + (columnIndex + 1), name: (frame.name || ('Text ' + (textIndex + 1))) + ' R' + (rowIndex + 1) + ' C' + (columnIndex + 1), sourceText: cell, visibleLines: [cell], kind: rows.plainList ? 'list-item' : 'table-cell', role: 'DATA_LABEL', contentType: graphicTextType(cell, cachedFrameName, cachedLayerName), bounds: cellBox, permittedRegion: {x: cellBox.x, y: cellBox.y, width: cellBox.width, height: virtualPermittedHeight(cellBox.height, cellSize)}, style: {fontFamily: family, fontSize: cellSize, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: cellLeading / cellSize, alignment: columns[columnIndex].alignment, fill: fill}, illustrator: {textFrameIndex: frameDocumentIndex, virtualCell: true, row: rowIndex, column: columnIndex, sourceFrameId: baseId, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable, layoutSource: columns[columnIndex].layoutSource || 'reconstructed-grid', tabAnchor: columns[columnIndex].tabAnchor}}, frame, cell));
        exportedBlocks++; splitCells++;
      }
    } else {
      artboards[boardIndex].textFrames.push(attachLegendMetadata({id: baseId, name: frame.name || ('Text ' + (textIndex + 1)), sourceText: scanRecord.contents, visibleLines: isUniformHeader ? [scanRecord.contents] : visibleLines(frame), kind: frame.kind === TextType.AREATEXT ? 'area' : frame.kind === TextType.PATHTEXT ? 'path' : 'point', role: role(frame, textIndex), contentType: graphicTextType(scanRecord.contents, cachedFrameName, cachedLayerName), bounds: box, permittedRegion: {x: Math.max(0, box.x), y: Math.max(0, box.y - size * 0.5), width: Math.max(box.width, artboards[boardIndex].bounds.width - Math.max(0, box.x) - 12), height: Math.max(box.height, size * 4)}, style: {fontFamily: family, fontSize: size, fontWeight: fontWeight, fontStyleName: fontStyleName, lineHeight: leading / size, alignment: justify, fill: fill}, illustrator: {textFrameIndex: frameDocumentIndex, layerName: frame.layer.name, locked: frame.locked, editable: frame.editable}}, frame, scanRecord.contents));
      exportedBlocks++;
    }
  }
  var graphicCount = 0, graphicSeenElements = {}, graphicKey, graphicIndex, graphicItem, graphicBounds, graphicBoard, graphicRect, graphicBox, graphicPoints, graphicName, graphicGroup, graphicRecord, childIndex, child;
  /* Pure vector/text documents use their exported SVG as the artwork source.
     Do not walk every Illustrator PathItem: visually simple files can contain
     thousands of hidden or nested paths and block ExtendScript before export.
     Photo documents retain the legacy semantic vector scan for compatibility. */
  var semanticVectorCount = documentHasRasterPhotos ? doc.pathItems.length : 0;
  for (graphicIndex = 0; graphicIndex < semanticVectorCount; graphicIndex++) {
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
  function imageRotation(item) {
    try { return Math.atan2(item.matrix.mValueB, item.matrix.mValueA) * 180 / Math.PI; } catch (_) { return 0; }
  }
  function scanImageCollection(collection, imageType) {
    var imageIndex, imageItem, imageBounds, imageBoard, imageRect, imageBox, imagePosition, originalWidth, originalHeight, originalX, originalY, rotation, record;
    for (imageIndex = 0; imageIndex < collection.length; imageIndex++) {
      progress('Scanning images', imageIndex, collection.length, selectedIndices.length === 1 ? doc.artboards[selectedIndices[0]].name : 'selected artboards');
      imageItem = collection[imageIndex];
      try { if (imageItem.hidden) continue; imageBounds = imageItem.visibleBounds; } catch (_) { continue; }
      imageBoard = artboardFor(imageBounds); if (imageBoard < 0 || !artboardsByIndex[imageBoard]) continue;
      imageRect = doc.artboards[imageBoard].artboardRect; imageBox = localBounds(imageBounds, imageRect);
      try { imagePosition = imageItem.position; } catch (_) { imagePosition = [imageBounds[0], imageBounds[1]]; }
      try { originalWidth = Math.abs(Number(imageItem.width)); } catch (_) { originalWidth = imageBox.width; }
      try { originalHeight = Math.abs(Number(imageItem.height)); } catch (_) { originalHeight = imageBox.height; }
      originalX = Number(imagePosition[0]) - imageRect[0]; originalY = imageRect[1] - Number(imagePosition[1]); rotation = imageRotation(imageItem);
      record = {id: 'cl-image-' + (imageBoard + 1) + '-' + (artboardsByIndex[imageBoard].imageObjects.length + 1), type: 'image', name: String(imageItem.name || ('Image ' + (imageIndex + 1))), original: {x: originalX, y: originalY, width: originalWidth, height: originalHeight, rotation: rotation}, bounds: imageBox, aspectRatio: originalHeight ? originalWidth / originalHeight : null, lockedGeometry: true, imageType: imageType, layerName: String(imageItem.layer ? imageItem.layer.name : ''), illustrator: {typename: imageItem.typename, itemIndex: imageIndex, locked: imageItem.locked, editable: !imageItem.locked}};
      artboardsByIndex[imageBoard].imageObjects.push(record); artboardsByIndex[imageBoard].objectCount++;
      try { addLayer(artboardsByIndex[imageBoard], imageItem.layer.name); } catch (_) {}
    }
  }
  try { scanImageCollection(doc.placedItems, 'placed'); } catch (_) {}
  try { scanImageCollection(doc.rasterItems, 'raster'); } catch (_) {}
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
        var originalFrame = doc.textFrames[contentFrame.illustrator.textFrameIndex];
        /* visibleBounds on a parent group can force Illustrator to resolve an
           entire nested artwork tree. Only photo documents need semantic
           text/vector grouping; pure vector charts keep the SVG intact. */
        contentFrame.sourceGroupKey = documentHasRasterPhotos ? sourceGroupKey(originalFrame, doc.artboards[artboards[i].index].artboardRect) : null;
        contentFrame.style.letterSpacing = 0;
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
  if (documentHasRasterPhotos) try { for (i = 0; i < doc.groupItems.length; i++) if (/outline|outlined/i.test(doc.groupItems[i].name)) outlinedCount++; } catch (_) {}
  var previousActiveArtboard = doc.artboards.getActiveArtboardIndex();
  for (i = 0; i < artboards.length; i++) {
    var imageValidationError = null;
    // Always preserve Illustrator's own full SVG as the source/reference preview.
    // ChartLingo should use previewSvg directly for Chinese Source instead of
    // reconstructing the original textFrames. This keeps tabs, mixed colors,
    // glyph legends, baselines, merged visual cells and line breaks identical.
    progress('Rendering Illustrator source preview', i + 1, artboards.length, artboards[i].name);
    artboards[i].previewSvg = readSvg(artboards[i].index, false);
    if (invalidSvgImageReason(artboards[i].previewSvg, artboards[i].imageObjects.length)) artboards[i].previewSvg = null;
    progress(exportChoice.imageMode === 'optimized' ? 'Embedding photos and preserving vectors' : 'Rendering editable artwork', exportChoice.imageMode === 'optimized' ? i + 1 : artboards.length + i, exportChoice.imageMode === 'optimized' ? artboards.length : artboards.length * 2, artboards[i].name);
    artboards[i].artworkSvg = readArtworkWithoutLiveText(artboards[i].index, artboards[i], exportChoice.imageMode === 'optimized');
    imageValidationError = invalidSvgImageReason(artboards[i].artworkSvg, artboards[i].imageObjects.length);
    if (imageValidationError) throw new Error('Image export failed on ' + artboards[i].name + ': ' + imageValidationError + ' Re-embed the linked image in Illustrator and export again. Vector artwork was not flattened.');
    var optimization = imageOptimizationStats[artboards[i].index] || {optimizedImageCount: 0, targetPpi: null, jpegQuality: null, imageFormat: 'none', sourceBytes: 0, optimizedBytes: 0};
    artboards[i].imageExportDiagnostics = {chartId: artboards[i].id, imageCount: artboards[i].imageObjects.length, optimizedImageCount: optimization.optimizedImageCount, imageFormat: optimization.imageFormat, targetPpi: exportChoice.imageMode === 'optimized' ? optimization.targetPpi : null, jpegQuality: exportChoice.imageMode === 'optimized' ? optimization.jpegQuality : null, sourceBytes: optimization.sourceBytes, optimizedBytes: optimization.optimizedBytes, sourceType: artboards[i].imageObjects.length ? (exportChoice.imageMode === 'optimized' ? 'optimized-embedded-data-uri' : 'original-embedded-data-uri') : 'none', sourceIsValid: true, embedded: true, illustratorCompatible: true, vectorsPreserved: true, textPreservedSeparately: true, usedRasterFallback: false};
  }
  try { doc.artboards.setActiveArtboardIndex(previousActiveArtboard); } catch (_) {}
  function packageFor(records, suffix) {
    return {schema: 'https://chartlingo.local/schemas/package-v2.json', schemaVersion: '2.0.0', generator: {name: 'ChartLingo Illustrator Prototype', version: '1.0.6-preview-legend-color'}, document: {id: 'cl-doc-' + clean(doc.name).replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase() + (suffix || ''), revision: String(doc.fullName && doc.fullName.exists ? doc.fullName.modified.getTime() : new Date().getTime()), name: doc.name.replace(/\.[^.]+$/, '') + (suffix || ''), sourceApp: 'Adobe Illustrator', sourceVersion: app.version, exportMode: exportChoice.mode === 0 ? 'single' : 'multiple', imageMode: exportChoice.imageMode, artboards: records}, warnings: outlinedCount ? [{code: 'POSSIBLE_OUTLINED_TEXT', message: outlinedCount + ' named outline group(s) require manual review.'}] : []};
  }
  function writePackage(file, data, artboardName) {
    var payload, opened = false, written = false, closed = false, verifiedFile;
    if (!data || data.schema !== 'https://chartlingo.local/schemas/package-v2.json' || !data.document || !data.document.artboards) throw filesystemError('invalid_json_output', 'validate package structure', 'The generated package is missing required ChartLingo data.', file, 'Required schema or document data is missing.');
    payload = jsonStringify(data, '', 0);
    file.encoding = 'UTF-8';
    try {
      opened = file.open('w');
      if (!opened) throw filesystemError(/denied|permission/i.test(String(file.error)) ? 'permission_denied' : 'file_open_failed', 'open output file', 'Cannot open the output file for writing.', file, file.error);
      written = file.write(payload);
      if (!written) throw filesystemError('file_write_failed', 'write output file', 'Illustrator could not write the ChartLingo package.', file, file.error);
      closed = file.close(); opened = false;
      if (closed === false) throw filesystemError('file_close_failed', 'close output file', 'Illustrator could not finish writing the ChartLingo package.', file, file.error);
      exportDiagnostics.filesWritten++;
      exportDiagnostics.actualFiles.push(displayPath(file));
      verifiedFile = new File(file.absoluteURI);
      if (!verifiedFile.exists || verifiedFile.length <= 0 || verifiedFile.length < payload.length) throw filesystemError('file_verification_failed', 'verify output file', 'The output file is missing, empty, or incomplete after writing.', verifiedFile, verifiedFile.error);
      if (normalizePath(verifiedFile.parent.fsName) !== normalizePath(destinationFolder.fsName)) throw filesystemError('invalid_destination_path', 'verify output location', 'The output file was not created directly inside the selected folder.', verifiedFile, 'Expected parent: ' + displayPath(destinationFolder));
      exportDiagnostics.verifiedFiles.push(displayPath(verifiedFile));
      exportDiagnostics.fileSizes[displayPath(verifiedFile)] = verifiedFile.length;
      exportDiagnostics.filesVerified++;
      exportDiagnostics.artboardsCompleted += data.document.artboards.length;
      return verifiedFile;
    } catch (fileError) {
      if (opened) try { file.close(); } catch (_) {}
      fileError.chartLingoArtboard = artboardName || 'Multiple artboards';
      exportDiagnostics.fileErrors.push({type: fileError.chartLingoType || 'file_write_failed', artboard: fileError.chartLingoArtboard, operation: fileError.chartLingoOperation || 'write package', file: fileError.chartLingoFile || displayPath(file), error: fileError.chartLingoUnderlying || String(fileError.message || fileError)});
      throw fileError;
    }
  }
  function verifyCompleteExport() {
    var i, j, expected, found, diskFiles = [], diskLookup = {}, diskEntry;
    try { diskFiles = destinationFolder.getFiles(); }
    catch (folderReadError) { throw filesystemError('file_verification_failed', 'inspect destination folder', 'Illustrator could not inspect the destination folder after export.', destinationFolder, folderReadError.message || folderReadError); }
    for (i = 0; i < diskFiles.length; i++) {
      diskEntry = diskFiles[i];
      if (diskEntry instanceof File) diskLookup[normalizePath(displayPath(diskEntry))] = true;
    }
    for (i = 0; i < exportDiagnostics.expectedFiles.length; i++) {
      expected = normalizePath(exportDiagnostics.expectedFiles[i]); found = false;
      for (j = 0; j < exportDiagnostics.verifiedFiles.length; j++) if (normalizePath(exportDiagnostics.verifiedFiles[j]) === expected && diskLookup[expected]) { found = true; break; }
      if (!found) exportDiagnostics.missingFiles.push(exportDiagnostics.expectedFiles[i]);
    }
    if (exportDiagnostics.missingFiles.length || exportDiagnostics.filesVerified !== exportDiagnostics.expectedFiles.length) throw filesystemError('file_verification_failed', 'verify completed export', 'Not every requested package was verified in the selected folder.', destinationFolder, 'Expected ' + exportDiagnostics.expectedFiles.length + ' file(s); verified ' + exportDiagnostics.filesVerified + '.');
    exportDiagnostics.exportSucceeded = true;
  }
  function errorReport(error) {
    var primaryType = exportDiagnostics.filesWritten ? 'partial_export_failed' : (error.chartLingoType || 'export_failed');
    var lines = ['ChartLingo export failed.', '', 'Type: ' + primaryType, 'Cause: ' + (error.chartLingoType || 'unknown'), 'Operation: ' + (error.chartLingoOperation || 'export package'), 'Artboard: ' + (error.chartLingoArtboard || 'Not applicable'), '', 'Destination folder:', displayPath(destinationFolder) || '(unresolved)', '', 'Output file:', error.chartLingoFile || '(not created)', '', 'Error:', error.chartLingoUnderlying || error.message || String(error)];
    if (exportDiagnostics.actualFiles.length) lines.push('', 'Files successfully written before the failure:', exportDiagnostics.actualFiles.join('\n'));
    lines.push('', 'Adobe Illustrator may need access under macOS System Settings > Privacy & Security > Files and Folders (or Full Disk Access).', 'Give Illustrator permission to access this folder, or run the exporter again and choose another writable folder.', '', 'The Illustrator document was left unchanged.');
    return lines.join('\n');
  }
  var outputCount = 0, outputPaths = [], currentArtboardName = '', separateFiles = [], separateNames = [];
  if (exportChoice.separate) {
    for (i = 0; i < artboards.length; i++) {
      currentArtboardName = artboards[i].name || ('Artboard ' + (artboards[i].index + 1));
      separateNames[i] = safeFileName(doc.name.replace(/\.[^.]+$/, ''), 'chartlingo-export') + '-' + (artboards[i].index + 1) + '-' + safeFileName(currentArtboardName, 'Artboard-' + (artboards[i].index + 1)) + '.chartlingo';
      separateFiles[i] = uniqueFile(destinationFolder, separateNames[i]);
      exportDiagnostics.expectedFiles.push(displayPath(separateFiles[i]));
    }
    for (i = 0; i < artboards.length; i++) {
      currentArtboardName = artboards[i].name || ('Artboard ' + (artboards[i].index + 1));
      var separateFile = separateFiles[i];
      separateFile = writePackage(separateFile, packageFor([artboards[i]], '-artboard-' + (artboards[i].index + 1)), currentArtboardName);
      outputCount++; outputPaths.push(displayPath(separateFile));
    }
  } else {
    destination = writePackage(destination, packageFor(artboards, ''), artboards.length === 1 ? artboards[0].name : 'Multiple artboards');
    outputCount = 1; outputPaths.push(displayPath(destination));
  }
  verifyCompleteExport();
  try { progressWindow.close(); } catch (_) {}
  alert('ChartLingo export complete.\n\nDestination folder:\n' + displayPath(destinationFolder) + '\n\nOutput files:\n' + outputPaths.join('\n') + '\n\nExporter: 1.0.6-preview-legend-color\nMode: ' + exportDiagnostics.exportMode + '\nText font: Noto Sans SC (source-font lookup skipped)\nPhoto handling: ' + (exportChoice.imageMode === 'optimized' ? 'compatible visible photo crops rasterized in memory; unsupported photos safely kept original' : 'original embedded images') + '; vectors preserved\nFiles written: ' + exportDiagnostics.filesWritten + '\nFiles verified: ' + exportDiagnostics.filesVerified + '\nArtboards exported: ' + exportDiagnostics.artboardsCompleted + '\nPackage text blocks: ' + exportedBlocks + '\nIndependent vector elements: ' + graphicCount + '\nSeparated text items: ' + splitCells);
  } catch (exportError) {
    try { doc.artboards.setActiveArtboardIndex(initialActiveArtboard); } catch (_) {}
    try { progressWindow.close(); } catch (_) {}
    if (String(exportError.message || exportError) === '__CHARTLINGO_CANCELLED__') alert('ChartLingo export cancelled. The Illustrator document was restored.');
    else alert(errorReport(exportError));
  }
})();
