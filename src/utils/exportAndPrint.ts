import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { ShopProfile, Transaction } from '../types';
import { formatKs } from './formatters';
import { exportToExcelNative, exportToPdfNative, saveAndOpenFileNative } from './nativeFileExporter';

export { exportToExcelNative, exportToPdfNative, saveAndOpenFileNative };

/**
 * Robust Excel (.xlsx) Exporter using SheetJS
 * Formats numbers as actual numbers, creates clean column widths, and handles Myanmar Unicode.
 * Automatically delegates to Capacitor Filesystem + FileOpener when on mobile native.
 */
export function exportToExcelXlsx({
  filename,
  sheetName = 'Report',
  headers,
  rows,
  summaryRow,
}: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
  summaryRow?: (string | number)[];
}) {
  // On Native Mobile (Android / iOS): Use Capacitor Filesystem + FileOpener
  if (Capacitor.isNativePlatform()) {
    exportToExcelNative({
      filename,
      sheetName,
      headers,
      rows,
      summaryRow,
    }).catch((err) => console.error('exportToExcelNative error:', err));
    return true;
  }
  try {
    const wb = XLSX.utils.book_new();

    const sheetData: (string | number)[][] = [headers, ...rows];
    if (summaryRow && summaryRow.length > 0) {
      sheetData.push(summaryRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-calculate column widths
    const colWidths = headers.map((header, colIdx) => {
      let maxLen = header ? header.toString().length : 10;
      for (let r = 0; r < Math.min(rows.length, 200); r++) {
        const val = rows[r]?.[colIdx];
        if (val !== undefined && val !== null) {
          const len = val.toString().length;
          if (len > maxLen) maxLen = len;
        }
      }
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    // Generate buffer & download via Blob
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    downloadBlob(blob, safeFilename);
    return true;
  } catch (error) {
    console.error('Excel export failed, falling back to CSV:', error);
    // Fallback to CSV
    exportToCsvBlob({
      filename: filename.replace(/\.xlsx$/i, '.csv'),
      headers,
      rows: summaryRow ? [...rows, summaryRow] : rows,
    });
    return false;
  }
}

/**
 * Universal CSV Exporter using UTF-8 BOM and Blob
 * Avoids encodeURI length limits and Unicode corruption.
 */
export function exportToCsvBlob({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const escapeCsvCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const csvRows: string[] = [];
  csvRows.push(headers.map(escapeCsvCell).join(','));

  rows.forEach((row) => {
    csvRows.push(row.map(escapeCsvCell).join(','));
  });

  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadBlob(blob, safeFilename);
}

/**
 * Helper to download Blob safely across all browsers, iframes & WebViews
 */
export function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('download', filename);
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    link.style.top = '-9999px';
    link.style.opacity = '0';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 2500);
  } catch (e) {
    console.error('downloadBlob error:', e);
  }
}

export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  shopProfile?: ShopProfile;
  summaryCards?: { label: string; value: string; note?: string }[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
  summaryRow?: (string | number)[];
  columnAligns?: ('left' | 'center' | 'right')[];
}

/**
 * Builds standard clean HTML markup for A4 Report sheets
 */
export function buildReportHtmlMarkup({
  title,
  subtitle,
  shopProfile,
  summaryCards = [],
  tableHeaders,
  tableRows,
  summaryRow,
  columnAligns = [],
}: PrintReportOptions): string {
  const shopName = shopProfile?.shopName || 'Money Agent POS';
  const shopAddress = shopProfile?.address || '';
  const shopPhone = shopProfile?.phone || '';
  const datePrinted = new Date().toLocaleString('en-GB');

  const alignStyles = tableHeaders.map((_, i) => {
    const align = columnAligns[i] || (i === 0 || i === 1 ? 'center' : i >= tableHeaders.length - 2 ? 'left' : 'right');
    return align;
  });

  const cardsHtml =
    summaryCards.length > 0
      ? `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px;">
        ${summaryCards
          .map(
            (c) => `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc;">
            <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase;">${c.label}</div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px;">${c.value}</div>
            ${c.note ? `<div style="font-size: 9px; color: #64748b;">${c.note}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  const theadHtml = `
    <thead>
      <tr>
        ${tableHeaders
          .map(
            (h, i) =>
              `<th style="background-color: #f1f5f9; color: #0f172a; font-weight: bold; border: 1px solid #94a3b8; padding: 6px 8px; font-size: 10px; text-align: ${alignStyles[i]}; white-space: nowrap;">${h}</th>`
          )
          .join('')}
      </tr>
    </thead>
  `;

  const tbodyHtml = `
    <tbody>
      ${
        tableRows.length === 0
          ? `<tr><td colspan="${tableHeaders.length}" style="text-align:center; padding: 20px; color:#888; border: 1px solid #cbd5e1;">ဒေတာ မရှိပါ</td></tr>`
          : tableRows
              .map(
                (row, rowIdx) => `
            <tr style="background-color: ${rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
              ${row
                .map((cell, colIdx) => {
                  const align = alignStyles[colIdx] || 'left';
                  const cellStr = cell !== undefined && cell !== null ? String(cell) : '-';
                  const isPositive = cellStr.startsWith('+');
                  const isNegative = cellStr.startsWith('-');
                  const colorStyle = isPositive
                    ? 'color: #047857; font-weight: bold;'
                    : isNegative
                    ? 'color: #b91c1c; font-weight: bold;'
                    : 'color: #1e293b;';
                  return `<td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 10px; text-align: ${align}; ${colorStyle}; white-space: nowrap;">${cellStr}</td>`;
                })
                .join('')}
            </tr>
          `
              )
              .join('')
      }
      ${
        summaryRow && summaryRow.length > 0
          ? `
        <tr style="background-color: #e2e8f0; border-top: 2px solid #0f172a; font-weight: bold;">
          ${summaryRow
            .map((cell, colIdx) => {
              const align = alignStyles[colIdx] || 'left';
              const cellStr = cell !== undefined && cell !== null ? String(cell) : '';
              const isPositive = cellStr.startsWith('+');
              const isNegative = cellStr.startsWith('-');
              const colorStyle = isPositive
                ? 'color: #047857;'
                : isNegative
                ? 'color: #b91c1c;'
                : 'color: #0f172a;';
              return `<td style="border: 1px solid #94a3b8; padding: 6px 8px; font-size: 10px; text-align: ${align}; font-weight: bold; ${colorStyle}">${cellStr}</td>`;
            })
            .join('')}
        </tr>
      `
          : ''
      }
    </tbody>
  `;

  return `
    <div class="report-content" style="font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, sans-serif; color: #0f172a; background: #fff; padding: 12px; font-size: 11px; line-height: 1.4; width: 100%;">
      <div style="text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #0f172a;">
        <div style="font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">${shopName}</div>
        ${shopAddress || shopPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${[shopAddress, shopPhone].filter(Boolean).join(' • ')}</div>` : ''}
        <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 6px;">${title}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 3px;">${subtitle || ''} | ထုတ်ယူချိန်: ${datePrinted}</div>
      </div>

      ${cardsHtml}

      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
        <div>စာရင်းပေါင်း: ${tableRows.length} ခု</div>
        <div>ထုတ်ယူသည့်စနစ်: Money Agent POS</div>
      </div>
    </div>
  `;
}

/**
 * Builds standard clean HTML markup for Voucher / Receipt
 */
export function buildReceiptHtmlMarkup(transactionOrHtml: Transaction | string, shopProfile?: ShopProfile): string {
  if (typeof transactionOrHtml === 'string') {
    return transactionOrHtml;
  }
  const tx = transactionOrHtml;
  const sName = shopProfile?.shopName || 'MONEY AGENT POS';
  const sPhone = shopProfile?.phone || '';
  const sAddr = shopProfile?.address || '';
  const isTransfer = tx.type === 'လွှဲပြောင်း';
  const isCashOut = tx.type === 'ထုတ်';
  const isDeduct = tx.commissionMode === 'deduct';
  const netPayout = isCashOut ? (isDeduct ? Math.max(0, tx.amount - tx.commission) : tx.amount) : tx.amount;
  const typeLabel = isTransfer ? '🔄 လွှဲပြောင်း' : isCashOut ? '📤 ငွေထုတ် (Cash Out)' : '📥 ငွေသွင်း (Cash In)';

  return `
    <div style="font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, monospace; color: #000; background: #fff; padding: 12px; font-size: 11px; line-height: 1.4; width: 340px; margin: 0 auto; border: 1px dashed #666; border-radius: 4px;">
      <div style="text-align:center; padding-bottom:8px; border-bottom:1px dashed #666; margin-bottom:8px;">
        <div style="font-size:14px; font-weight:bold; text-transform:uppercase;">${sName}</div>
        ${sAddr ? `<div style="font-size:10px; color:#555;">${sAddr}</div>` : ''}
        ${sPhone ? `<div style="font-size:10px; color:#333; font-weight:bold;">${sPhone}</div>` : ''}
        <div style="font-size:10px; font-weight:bold; margin-top:4px; color:#333;">
          ${isTransfer ? 'WALLET TO WALLET လွှဲပြောင်း ပြေစာ' : 'ငွေလွှဲ / ငွေထုတ် ပြေစာလက်မှတ်'}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
        <span style="color:#555;">ပြေစာနံပါတ်:</span>
        <span style="font-weight:bold;">#${tx.id}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
        <span style="color:#555;">ရက်စွဲ/အချိန်:</span>
        <span>${tx.date} ${tx.time || ''}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
        <span style="color:#555;">ဖောက်သည်:</span>
        <span style="font-weight:bold;">${tx.customerName}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
        <span style="color:#555;">ဖုန်းနံပါတ်:</span>
        <span>${tx.phone || '-'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:#555;">အမျိုးအစား:</span>
        <span style="font-weight:bold;">${typeLabel}</span>
      </div>

      ${
        isTransfer
          ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#555;">From Wallet:</span>
          <span style="font-weight:bold;">${tx.walletName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#555;">To Wallet:</span>
          <span style="font-weight:bold;">${tx.targetWalletName || '-'}</span>
        </div>
      `
          : `
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#555;">Wallet အကောက်:</span>
          <span style="font-weight:bold;">${tx.walletName || '-'}</span>
        </div>
      `
      }

      ${
        tx.cashAccountName
          ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#555;">ငွေသားအကောက်:</span>
          <span>${tx.cashAccountName}</span>
        </div>
      `
          : ''
      }

      <div style="border-top:1px dashed #666; padding-top:6px; margin-top:6px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; margin-bottom:3px;">
          <span>${isTransfer ? 'လွှဲပြောင်းငွေ:' : 'မူလငွေ ပမာဏ:'}</span>
          <span>${formatKs(tx.amount)} Ks</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#047857; margin-bottom:3px;">
          <span>ဝန်ဆောင်ခ (ကော်မရှင်):</span>
          <span>+${formatKs(tx.commission)} Ks</span>
        </div>
        ${
          isCashOut
            ? `
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#b91c1c; border-top:1px dashed #ccc; padding-top:4px; margin-top:3px;">
            <span>ဖောက်သည်သို့ ပေးငွေ:</span>
            <span>${formatKs(netPayout)} Ks</span>
          </div>
        `
            : ''
        }
      </div>

      ${
        tx.note
          ? `
        <div style="border-top:1px dashed #ccc; padding-top:4px; margin-top:4px; font-size:10px; color:#555;">
          <span>မှတ်ချက်: </span><span>${tx.note}</span>
        </div>
      `
          : ''
      }

      <div style="text-align:center; font-size:9px; color:#777; margin-top:8px; padding-top:6px; border-top:1px dashed #666;">
        ကျေးဇူးတင်ပါသည်။ အဆင်ပြေစွာ အသုံးပြုနိုင်ပါစေ။
      </div>
    </div>
  `;
}

/**
 * Generates standalone full HTML document with embedded CSS Media Print rules for Auto-Fit & A4 Portrait
 */
export function generateFullReportHtmlDocument(options: PrintReportOptions): string {
  const content = buildReportHtmlMarkup(options);
  return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes" />
  <title>${options.title}</title>
  <style>
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Report Container ကို စာရွက်အကျယ်နဲ့ Auto Fit ဖြစ်အောင် ညှိခြင်း */
      .report-container, table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        word-wrap: break-word !important;
        font-size: 10pt !important; /* Auto scale font size */
      }
      /* Print တွင် မပါချင်သော App Header/Buttons များကို ဖျောက်ခြင်း */
      .no-print, button, navbar, .action-bar {
        display: none !important;
      }
      th, td {
        border: 1px solid #94a3b8 !important;
        padding: 4px 6px !important;
        color: #000000 !important;
      }
      th {
        background-color: #f1f5f9 !important;
        color: #0f172a !important;
        font-weight: bold !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 16px;
      font-size: 11px;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .action-bar {
      width: 100%;
      max-width: 900px;
      margin-bottom: 14px;
      padding: 10px 16px;
      background: #1e293b;
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .action-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .action-btn:hover {
      background: #4338ca;
    }
    .close-btn {
      background: #475569;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .close-btn:hover {
      background: #334155;
    }
    .report-container {
      width: 100%;
      max-width: 900px;
      background: #ffffff;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div style="font-weight: bold; font-size: 13px;">📄 ${options.title}</div>
    <div style="display:flex; gap: 8px;">
      <button class="action-btn" onclick="window.print()">🖨️ စာရွက်ထုတ်မည် / Save as PDF</button>
      <button class="close-btn" onclick="window.close()">❌ ပိတ်မည်</button>
    </div>
  </div>
  <div class="report-container">
    ${content}
  </div>
  <script>
    // Auto trigger print when loaded
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch(e) {
          console.warn('Auto print failed:', e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;
}

/**
 * Generates standalone full HTML document for Receipt Voucher with Native Print rules
 */
export function generateFullReceiptHtmlDocument(transactionOrHtml: Transaction | string, shopProfile?: ShopProfile): string {
  const content = buildReceiptHtmlMarkup(transactionOrHtml, shopProfile);
  const txId = typeof transactionOrHtml === 'object' ? transactionOrHtml.id : 'Receipt';
  return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ပြေစာလက်မှတ် #${txId}</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 4mm;
      }
      body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print, button, navbar, .action-bar {
        display: none !important;
      }
      .receipt-container {
        width: 76mm !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        border: none !important;
        padding: 4px !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, monospace;
      color: #000000;
      background: #f1f5f9;
      padding: 16px;
      font-size: 11px;
      line-height: 1.35;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .action-bar {
      width: 100%;
      max-width: 360px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #1e293b;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .action-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
    }
    .close-btn {
      background: #475569;
      color: #ffffff;
      border: none;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
    }
    .receipt-container {
      width: 350px;
      max-width: 100%;
      background: #ffffff;
      padding: 16px;
      border: 1px dashed #64748b;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div style="font-weight: bold; font-size: 12px;">🧾 ပြေစာလက်မှတ် #${txId}</div>
    <div style="display:flex; gap: 6px;">
      <button class="action-btn" onclick="window.print()">🖨️ Print</button>
      <button class="close-btn" onclick="window.close()">❌ ပိတ်</button>
    </div>
  </div>
  <div class="receipt-container">
    ${content}
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch(e) {
          console.warn('Auto print failed:', e);
        }
      }, 300);
    });
  </script>
</body>
</html>`;
}

/**
 * 100% Reliable Native Browser Print & Preview Engine
 * 1. Creates an isolated dynamic iframe to trigger window.print() directly
 * 2. If iframe print is blocked by WebView, opens Blob HTML Preview Window with auto-print & Save as PDF
 */
export function executeNativePrintOrPreview(htmlContent: string, title: string = 'Report') {
  try {
    let iframe = document.getElementById('pos-print-iframe') as HTMLIFrameElement | null;
    if (iframe && document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = 'pos-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed, falling back to Blob Preview / window.open:', e);
          fallbackBlobPreview(htmlContent, title);
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('Direct iframe creation error:', err);
  }

  // Fallback to Blob window / preview if iframe fails or running inside webview without iframe print
  fallbackBlobPreview(htmlContent, title);
}

function fallbackBlobPreview(htmlContent: string, title: string) {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // If popup blocker blocked window.open, create a download/open link
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) {
    console.error('Blob preview failed, trying window.print():', e);
    window.print();
  }
}

/**
 * Helper to Export Formatted Report as PDF / Native Print & Share
 */
export async function exportReportToPdfAndShare(options: PrintReportOptions & { filename?: string }): Promise<boolean> {
  // On Native Mobile: delegate to Capacitor Native PDF generator + FileOpener
  if (Capacitor.isNativePlatform()) {
    await exportToPdfNative(options);
    return true;
  }
  const fullHtml = generateFullReportHtmlDocument(options);
  executeNativePrintOrPreview(fullHtml, options.title);
  return true;
}

/**
 * Helper to Export Receipt Voucher as PDF / Native Print & Share
 */
export async function exportReceiptToPdfAndShare(
  transactionOrHtml: Transaction | string,
  shopProfile?: ShopProfile,
  filename?: string
): Promise<boolean> {
  const fullHtml = generateFullReceiptHtmlDocument(transactionOrHtml, shopProfile);
  const txId = typeof transactionOrHtml === 'object' ? transactionOrHtml.id : 'Voucher';
  executeNativePrintOrPreview(fullHtml, `Receipt_${txId}`);
  return true;
}

/**
 * Printable Report Helper
 * Generates an isolated, beautifully styled print window/iframe with Auto Justify
 */
export function printFormattedReport(options: PrintReportOptions) {
  const fullHtml = generateFullReportHtmlDocument(options);
  executeNativePrintOrPreview(fullHtml, options.title);
}

/**
 * Print Transaction Receipt Directly
 */
export function printReceiptDocument(transactionOrHtml: Transaction | string, shopProfile?: ShopProfile) {
  const fullHtml = generateFullReceiptHtmlDocument(transactionOrHtml, shopProfile);
  const txId = typeof transactionOrHtml === 'object' ? transactionOrHtml.id : 'Receipt';
  executeNativePrintOrPreview(fullHtml, `Receipt_${txId}`);
}
