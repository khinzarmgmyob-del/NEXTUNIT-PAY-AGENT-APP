import * as XLSX from 'xlsx';
import { ShopProfile, Transaction } from '../types';
import { formatKs } from './formatters';

/**
 * Robust Excel (.xlsx) Exporter using SheetJS
 * Formats numbers as actual numbers, creates clean column widths, and handles Myanmar Unicode.
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
 * Helper to download Blob safely across all browsers & WebViews
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Printable Report Helper
 * Generates an isolated, beautifully styled print window/iframe
 * containing Myanmar typography, high-contrast tables, summary metrics, and shop profile.
 */
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

export function printFormattedReport({
  title,
  subtitle,
  shopProfile,
  summaryCards = [],
  tableHeaders,
  tableRows,
  summaryRow,
  columnAligns = [],
}: PrintReportOptions) {
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
      <div class="summary-grid">
        ${summaryCards
          .map(
            (c) => `
          <div class="summary-card">
            <div class="summary-label">${c.label}</div>
            <div class="summary-val">${c.value}</div>
            ${c.note ? `<div class="summary-note">${c.note}</div>` : ''}
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
        ${tableHeaders.map((h, i) => `<th style="text-align: ${alignStyles[i]}">${h}</th>`).join('')}
      </tr>
    </thead>
  `;

  const tbodyHtml = `
    <tbody>
      ${
        tableRows.length === 0
          ? `<tr><td colspan="${tableHeaders.length}" style="text-align:center; padding: 20px; color:#888;">ဒေတာ မရှိပါ</td></tr>`
          : tableRows
              .map(
                (row) => `
            <tr>
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
                    : '';
                  return `<td style="text-align: ${align}; ${colorStyle}">${cellStr}</td>`;
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
        <tr class="summary-row">
          ${summaryRow
            .map((cell, colIdx) => {
              const align = alignStyles[colIdx] || 'left';
              return `<td style="text-align: ${align}; font-weight: bold;">${cell !== undefined && cell !== null ? cell : ''}</td>`;
            })
            .join('')}
        </tr>
      `
          : ''
      }
    </tbody>
  `;

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, sans-serif;
          color: #0f172a;
          background: #fff;
          padding: 12px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          text-align: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 2px solid #0f172a;
        }
        .shop-title {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }
        .shop-info {
          font-size: 11px;
          color: #475569;
          margin-top: 2px;
        }
        .report-title {
          font-size: 14px;
          font-weight: bold;
          color: #1e293b;
          margin-top: 6px;
        }
        .report-meta {
          font-size: 10px;
          color: #64748b;
          margin-top: 3px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }
        .summary-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          background: #f8fafc;
        }
        .summary-label {
          font-size: 9px;
          font-weight: bold;
          color: #475569;
          text-transform: uppercase;
        }
        .summary-val {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 2px;
        }
        .summary-note {
          font-size: 9px;
          color: #64748b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          margin-top: 8px;
        }
        th {
          background-color: #f1f5f9;
          color: #0f172a;
          font-weight: bold;
          border: 1px solid #94a3b8;
          padding: 6px 8px;
          white-space: nowrap;
        }
        td {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
          white-space: nowrap;
        }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .summary-row {
          background-color: #e2e8f0 !important;
          border-top: 2px solid #0f172a;
          font-weight: bold;
        }
        .footer {
          margin-top: 20px;
          padding-top: 8px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-title">${shopName}</div>
        ${shopAddress || shopPhone ? `<div class="shop-info">${[shopAddress, shopPhone].filter(Boolean).join(' • ')}</div>` : ''}
        <div class="report-title">${title}</div>
        <div class="report-meta">${subtitle || ''} | ထုတ်ယူချိန်: ${datePrinted}</div>
      </div>

      ${cardsHtml}

      <table>
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <div class="footer">
        <div>စာရင်းပေါင်း: ${tableRows.length} ခု</div>
        <div>System: Money Agent POS</div>
      </div>
    </body>
    </html>
  `;

  executePrintHtml(fullHtml);
}

/**
 * Print Transaction Receipt Directly
 */
export function printReceiptDocument(transactionOrHtml: Transaction | string, shopProfile?: ShopProfile) {
  let innerHtml = '';

  if (typeof transactionOrHtml === 'string') {
    innerHtml = transactionOrHtml;
  } else {
    const tx = transactionOrHtml;
    const sName = shopProfile?.shopName || 'MONEY AGENT POS';
    const sPhone = shopProfile?.phone || '';
    const sAddr = shopProfile?.address || '';
    const isTransfer = tx.type === 'လွှဲပြောင်း';
    const isCashOut = tx.type === 'ထုတ်';
    const isDeduct = tx.commissionMode === 'deduct';
    const netPayout = isCashOut ? (isDeduct ? Math.max(0, tx.amount - tx.commission) : tx.amount) : tx.amount;
    const typeLabel = isTransfer ? '🔄 လွှဲပြောင်း' : isCashOut ? '📤 ငွေထုတ် (Cash Out)' : '📥 ငွေသွင်း (Cash In)';

    innerHtml = `
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
    `;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, monospace;
          color: #000;
          background: #fff;
          padding: 8px;
          font-size: 11px;
          line-height: 1.35;
          width: 76mm;
          margin: 0 auto;
        }
        .receipt-container {
          border: 1px dashed #666;
          padding: 10px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        ${innerHtml}
      </div>
    </body>
    </html>
  `;

  executePrintHtml(fullHtml);
}

/**
 * Spawns an isolated invisible iframe to trigger print reliably inside iframes and WebViews
 */
function executePrintHtml(htmlContent: string) {
  let iframe = document.getElementById('pos-print-iframe') as HTMLIFrameElement | null;
  if (iframe) {
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
  if (!doc) {
    // Fallback
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Trigger print once styles/fonts are loaded
  setTimeout(() => {
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.print():', e);
      window.print();
    }
  }, 400);
}
