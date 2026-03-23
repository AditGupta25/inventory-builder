import ExcelJS from 'exceljs';
import path from 'path';
import { mkdirSync } from 'fs';
import os from 'os';

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8537A' },
};

const HEADER_FONT = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const FLAG_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF3CD' },
};

const FLAG_FONT = {
  color: { argb: 'FFE67E22' },
  bold: true,
};

const ALT_ROW_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8F9FA' },
};

const INVENTORY_COLUMNS = [
  { header: 'UPC', key: 'upc', width: 18 },
  { header: 'Product/Service Name', key: 'name', width: 40 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Sub-Category', key: 'subCategory', width: 18 },
  { header: 'Images', key: 'images', width: 12 },
  { header: 'Size/Description', key: 'sizeDescription', width: 20 },
  { header: 'Unit of Measure', key: 'unitOfMeasure', width: 15 },
  { header: 'Store Price', key: 'storePrice', width: 12 },
];

const FLAG_COLUMNS = [
  ...INVENTORY_COLUMNS,
  { header: 'Flag', key: 'flag', width: 25 },
  { header: 'Flag Detail', key: 'flagDetail', width: 40 },
];

export async function writeInventoryFiles(formattedData, qaData, sessionId) {
  const outDir = path.join(os.tmpdir(), sessionId);
  mkdirSync(outDir, { recursive: true });

  const cleanPath = path.join(outDir, 'inventory_clean.xlsx');
  const flaggedPath = path.join(outDir, 'inventory_flagged.xlsx');

  // Write clean file
  await writeWorkbook(cleanPath, formattedData.clean, INVENTORY_COLUMNS, qaData, false);

  // Write flagged file
  await writeWorkbook(flaggedPath, formattedData.flagged, FLAG_COLUMNS, qaData, true);

  return { cleanFile: cleanPath, flaggedFile: flaggedPath };
}

async function writeWorkbook(filePath, rows, columns, qaData, isFlagged) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inventory Builder';
  workbook.created = new Date();

  // Inventory sheet
  const sheet = workbook.addWorksheet(isFlagged ? 'Flagged Items' : 'Inventory');
  sheet.columns = columns;

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD63384' } },
    };
  });
  headerRow.height = 28;

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Add data rows
  for (let i = 0; i < rows.length; i++) {
    const row = sheet.addRow(rows[i]);

    // Alternating row colors
    if (i % 2 === 1) {
      row.eachCell(cell => { cell.fill = ALT_ROW_FILL; });
    }

    // Highlight flagged rows
    if (isFlagged) {
      row.eachCell(cell => { cell.fill = FLAG_FILL; });
      // Style flag columns specifically
      const flagCell = row.getCell('flag');
      const flagDetailCell = row.getCell('flagDetail');
      if (flagCell) flagCell.font = FLAG_FONT;
      if (flagDetailCell) flagDetailCell.font = FLAG_FONT;
    }

    // Format price as currency
    const priceCell = row.getCell('storePrice');
    if (priceCell) {
      priceCell.numFmt = '$#,##0.00';
    }
  }

  // QA Report sheet
  const qaSheet = workbook.addWorksheet('QA Report');
  addQAReport(qaSheet, qaData);

  await workbook.xlsx.writeFile(filePath);
}

function addQAReport(sheet, qaData) {
  // Title
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Quality Assurance Report';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFE8537A' } };
  titleCell.alignment = { horizontal: 'center' };

  // Summary section
  sheet.getCell('A3').value = 'Summary';
  sheet.getCell('A3').font = { bold: true, size: 13 };

  const summary = qaData.summary || {};
  const summaryRows = [
    ['Total Processed', summary.totalProcessed || 0],
    ['Clean Items', summary.cleanCount || 0],
    ['Flagged Items', summary.flaggedCount || 0],
    ['Skipped Items', summary.skippedCount || 0],
    ['Conflicts Resolved', summary.conflictsResolved || 0],
    ['Quality Score', `${qaData.qualityScore || 0}/100`],
  ];

  let row = 4;
  for (const [label, value] of summaryRows) {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = value;
    row++;
  }

  // Plain English Summary
  row += 1;
  sheet.getCell(`A${row}`).value = 'Summary';
  sheet.getCell(`A${row}`).font = { bold: true, size: 13 };
  row++;
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getCell(`A${row}`).value = qaData.plainEnglishSummary || '';
  sheet.getCell(`A${row}`).alignment = { wrapText: true };
  sheet.getRow(row).height = 40;

  // Issues section
  row += 2;
  sheet.getCell(`A${row}`).value = 'Issues';
  sheet.getCell(`A${row}`).font = { bold: true, size: 13 };
  row++;

  // Issues header
  const issueHeaders = ['Severity', 'Field', 'Message', 'Affected Items'];
  issueHeaders.forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  row++;

  const issues = qaData.issues || [];
  for (const issue of issues) {
    sheet.getCell(row, 1).value = issue.severity;
    sheet.getCell(row, 2).value = issue.field;
    sheet.getCell(row, 3).value = issue.message;
    sheet.getCell(row, 4).value = (issue.affectedItems || []).join(', ');

    // Color severity
    const sevCell = sheet.getCell(row, 1);
    if (issue.severity === 'ERROR') {
      sevCell.font = { bold: true, color: { argb: 'FFDC3545' } };
    } else if (issue.severity === 'WARNING') {
      sevCell.font = { bold: true, color: { argb: 'FFE67E22' } };
    } else {
      sevCell.font = { color: { argb: 'FF6C757D' } };
    }

    row++;
  }

  // Column widths
  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 50;
  sheet.getColumn(4).width = 50;
}
