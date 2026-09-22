# ChartLingo Quick User Guide

> Testing prototype: keep the original Illustrator file and check the English chart before publishing.

## Prepare and download

- Adobe Illustrator 2024–2026.
- Original `.ai` chart with live, editable text.
- [Illustrator export script](https://drive.google.com/drive/folders/15RGGpvhxGXEzK9KwODGHV9rPNvJfAFVP?usp=drive_link).
- [ChartLingo Translation Gem](https://gemini.google.com/gem/18JlfyILMc9Ts_8a9-Y_C16c-3zXiQQs0?usp=sharing).
- [ChartLingo](https://yuchej.github.io/ChartLingo/chartlingoV2/).

## Workflow

```mermaid
flowchart LR
    A[Export Illustrator package] --> B[Translate with Gemini Gem]
    B --> C[Save translations as CSV or TXT]
    C --> D[Import both files]
    D --> E[Generate English chart]
    E --> F[Review edit and export]
```

## 1. Install the Illustrator script

1. Download `export-to-chartlingo.jsx` from the [shared script folder](https://drive.google.com/drive/folders/15RGGpvhxGXEzK9KwODGHV9rPNvJfAFVP?usp=drive_link).
2. Copy it into Illustrator's `Scripts` folder.

**macOS**

```text
/Applications/Adobe Illustrator 2026/Presets.localized/en_US/Scripts/
```

**Windows**

```text
C:\Program Files\Adobe\Adobe Illustrator 2026\Presets\en_US\Scripts\
```

3. Restart Illustrator.
4. The script will appear under **File → Scripts → export-to-chartlingo**.

## 2. Export from Illustrator

1. Keep all text live. Do not outline it.
2. Open the correct artboard.
3. Select **File → Scripts → export-to-chartlingo**.
4. Export the selected artboard.
5. Save the `.chartlingo` package.

Exporter 0.8.4 asks you to choose any destination folder available to Illustrator, including nested folders and names containing spaces or Chinese characters. It first tests write access inside that exact folder, then writes a collision-safe package name based on the Illustrator document name. Each package is reopened and checked for non-empty, valid ChartLingo JSON before success is reported. If macOS blocks access, the exporter reports the selected folder, affected output file, filesystem error, and relevant Privacy & Security action. It automatically removes control characters that are invalid in embedded SVG; ChartLingo repeats this cleanup during import so packages from older exporters can also open without manual repair. It separates explicit line breaks and items divided by Tabs, repeated spaces, or full-width spaces into independent ChartLingo text objects. This improves CSV/TXT matching without changing the Illustrator artwork. A multi-line header remains one text object when all its lines use the same font size. Table columns retain their Illustrator Tab anchors and a usable final-column width. Numeric chart scales remain protected, and decimal fragments such as `8` and `.0` are rejoined as `8.0`.

## 3. Create the CSV or TXT translation file

1. Open and add the [Translation Gem](https://gemini.google.com/gem/18JlfyILMc9Ts_8a9-Y_C16c-3zXiQQs0?usp=sharing) to Gemini.
2. Upload the Chinese graphic to the Gem.
3. Ask the Gem to extract and translate the chart text.
4. Copy the translations into a plain-text editor and save them as either `.csv` or `.txt`.
5. Check names, numbers, units, dates, Source, and Credit before importing the file.

### CSV format

Use the column names `CH` and `EN`. An optional `ID` column may be included when Illustrator text-frame IDs are available.

```csv
CH,EN
电子制造业,Electronics Manufacturing
资讯与通信,Information & Communications
```

### TXT format

The recommended TXT format is one Chinese/English pair per line, separated by a Tab:

```text
电子制造业<Tab>Electronics Manufacturing
资讯与通信<Tab>Information & Communications
```

ChartLingo also accepts pairs separated by `|` or `=>`, labelled `CH:`/`EN:` lines, and alternating Chinese and English lines. A comma-separated TXT file is supported when its first line is the `CH,EN` header. Use UTF-8 encoding so Chinese characters display correctly.

Rules:

- Keep each logical text item in its own row.
- Keep Year and Quarter separate when they are separate objects.
- Keep Source and Credit in separate rows.
- Numbers that do not need translation may be omitted.

## 4. Generate the English chart

1. Open [ChartLingo](https://yuchej.github.io/ChartLingo/chartlingoV2/).
2. Select **Import .chartlingo File** and upload the `.chartlingo` file.
3. Select **Import CSV or TXT** and upload the translation file.
4. The English result generates automatically after both files are loaded.

## 5. Review and edit

- Compare the Chinese and English charts.
- Select **Edit graphic**.
- Click text to edit content, size, color, width, alignment, or line breaks.
- Drag text to move it.
- Shift-click to select and move several items together.
- Use **Show Chinese reference**, Undo, and Redo when needed.
- In **Data mismatch detected**, related graphic and CSV items appear as one issue group. Choose **Change text boxes to match CSV** to adopt the CSV structure, or **Keep ChartLingo format** to retain the imported text-box structure.

Check:

- No text overlaps.
- Numbers stay in the correct positions.
- Long labels wrap correctly.
- Source and Credit do not overlap the logo.
- Names, numbers, units, and translations are correct.

## 6. Export

- Leave **Output size** on **Auto height** for the existing content-based canvas, or select **Fixed 1200 × 800** for only the active artboard. Fixed mode scales the complete design proportionally and adds white space when needed; it does not stretch the artwork.
- **Export SVG** for vector output.
- **Export PNG** for image output.
- Review the exported file before publishing.

## Report a problem

Send:

- Illustrator version and operating system.
- Source `.ai` file, if shareable.
- `.chartlingo` package.
- CSV or TXT translation file.
- Screenshot of the problem.
- Short description of the expected result.

**Happy testing!**
