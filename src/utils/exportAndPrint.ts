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
 * Helper to download Blob safely across all browsers, iframes, mobile & tablet devices
 * Supports mobile Web Share API for native "Save to Files" (Save As) on iOS & Android
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const isMobileOrTablet =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window && navigator.maxTouchPoints > 0));

    // 1. Mobile & Tablet Web Share (Save to Files / Save As on iOS & Android)
    if (
      isMobileOrTablet &&
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).share === 'function' &&
      typeof (navigator as any).canShare === 'function'
    ) {
      try {
        const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            files: [file],
            title: filename,
            text: `${filename} ဖိုင်အား သိမ်းဆည်းရန် သို့မဟုတ် Share ပြုလုပ်ရန်`,
          });
          return true;
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return true; // User dismissed share/save dialog
        }
        console.warn('Mobile Web Share fallback to direct download:', shareErr);
      }
    }

    // 2. File System Access API (Desktop / Chromium Tablet "Save As" Picker)
    if (!isMobileOrTablet && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const extension = filename.split('.').pop() || '';
        const mimeType = blob.type || 'application/octet-stream';
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Exported File',
              accept: { [mimeType]: [`.${extension}`] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (pickerErr: any) {
        if (pickerErr?.name === 'AbortError') {
          return true;
        }
        console.warn('showSaveFilePicker fallback to download anchor:', pickerErr);
      }
    }

    // 3. Universal standard anchor download
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
    
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 4000);

    return true;
  } catch (e) {
    console.error('downloadBlob error:', e);
    return false;
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
  orientation?: 'portrait' | 'landscape';
}

/**
 * Converts Western digits (0-9) to Myanmar digits (၀-၉)
 */
export function toMyanmarDigits(num: number | string): string {
  const mmDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return num
    .toString()
    .split('')
    .map((char) => {
      const parsed = parseInt(char, 10);
      return !isNaN(parsed) && parsed >= 0 && parsed <= 9 ? mmDigits[parsed] : char;
    })
    .join('');
}

interface ReportPageChunk {
  pageIndex: number;
  totalPages: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  startRowIndex: number;
  endRowIndex: number;
  rows: (string | number)[][];
  summaryRow?: (string | number)[];
}

function chunkReportRows(
  rows: (string | number)[][],
  summaryRow: (string | number)[] | undefined,
  firstPageCapacity: number,
  otherPageCapacity: number
): ReportPageChunk[] {
  if (rows.length === 0) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        startRowIndex: 0,
        endRowIndex: 0,
        rows: [],
        summaryRow,
      },
    ];
  }

  // If everything fits on the first page
  if (rows.length <= firstPageCapacity) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        startRowIndex: 1,
        endRowIndex: rows.length,
        rows,
        summaryRow,
      },
    ];
  }

  const chunks: ReportPageChunk[] = [];
  const p1Rows = rows.slice(0, firstPageCapacity);
  chunks.push({
    pageIndex: 0,
    totalPages: 0,
    isFirstPage: true,
    isLastPage: false,
    startRowIndex: 1,
    endRowIndex: p1Rows.length,
    rows: p1Rows,
  });

  let currentIdx = firstPageCapacity;
  while (currentIdx < rows.length) {
    const nextBatch = rows.slice(currentIdx, currentIdx + otherPageCapacity);
    const startNum = currentIdx + 1;
    const endNum = currentIdx + nextBatch.length;
    currentIdx += otherPageCapacity;
    const isLast = currentIdx >= rows.length;
    chunks.push({
      pageIndex: chunks.length,
      totalPages: 0,
      isFirstPage: false,
      isLastPage: isLast,
      startRowIndex: startNum,
      endRowIndex: endNum,
      rows: nextBatch,
      summaryRow: isLast ? summaryRow : undefined,
    });
  }

  const total = chunks.length;
  chunks.forEach((c) => {
    c.totalPages = total;
  });
  return chunks;
}

/**
 * Builds array of individual page sheets HTML markup
 */
export function buildReportHtmlPages({
  title,
  subtitle,
  shopProfile,
  summaryCards = [],
  tableHeaders,
  tableRows,
  summaryRow,
  columnAligns = [],
  orientation,
}: PrintReportOptions): string[] {
  const isLandscape = orientation === 'landscape' || (!orientation && tableHeaders.length >= 7);
  const shopName = shopProfile?.shopName || 'Money Agent POS';
  const shopAddress = shopProfile?.address || '';
  const shopPhone = shopProfile?.phone || '';
  const datePrinted = new Date().toLocaleString('en-GB');

  const alignStyles = tableHeaders.map((_, i) => {
    const align =
      columnAligns[i] ||
      (i === 0 || i === 1 || i === 2 ? 'center' : i >= tableHeaders.length - 2 ? 'left' : 'right');
    return align;
  });

  const pageWidthPx = isLandscape ? 1122 : 800;
  const pageMinHeightPx = isLandscape ? 770 : 1080;
  const firstPageCapacity = isLandscape
    ? summaryCards.length > 0
      ? 14
      : 18
    : summaryCards.length > 0
    ? 22
    : 28;
  const otherPageCapacity = isLandscape ? 20 : 30;

  const chunks = chunkReportRows(tableRows, summaryRow, firstPageCapacity, otherPageCapacity);
  const totalChunks = chunks.length;

  const renderCardsHtml = () => {
    if (!summaryCards || summaryCards.length === 0) return '';
    return `
      <div style="display: grid; grid-template-columns: repeat(${Math.min(
        summaryCards.length,
        4
      )}, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px;">
        ${summaryCards
          .map(
            (c) => `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
            <div style="font-size: 8.5px; font-weight: bold; color: #475569; text-transform: uppercase;">${c.label}</div>
            <div style="font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 1px;">${c.value}</div>
            ${c.note ? `<div style="font-size: 8px; color: #64748b; margin-top: 1px;">${c.note}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;
  };

  const renderTableHeader = () => `
    <thead>
      <tr>
        ${tableHeaders
          .map(
            (h, i) =>
              `<th style="background-color: #f1f5f9; color: #0f172a; font-weight: bold; border: 1px solid #94a3b8; padding: 4px 5px; font-size: ${
                isLandscape ? '9px' : '10px'
              }; text-align: ${alignStyles[i]}; white-space: nowrap;">${h}</th>`
          )
          .join('')}
      </tr>
    </thead>
  `;

  const renderTableRow = (row: (string | number)[], rowIdx: number) => `
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
          const isNowrap =
            colIdx < 3 ||
            colIdx === 5 ||
            colIdx === 6 ||
            colIdx === 7 ||
            colIdx === 8 ||
            colIdx === 9 ||
            colIdx === 11;
          return `<td style="border: 1px solid #cbd5e1; padding: 3px 5px; font-size: ${
            isLandscape ? '8.5px' : '9.5px'
          }; text-align: ${align}; ${colorStyle}; ${
            isNowrap ? 'white-space: nowrap;' : 'word-break: break-word;'
          }">${cellStr}</td>`;
        })
        .join('')}
    </tr>
  `;

  const renderSummaryRow = (sRow: (string | number)[]) => `
    <tr style="background-color: #e2e8f0; border-top: 2px solid #0f172a; font-weight: bold;">
      ${sRow
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
          return `<td style="border: 1px solid #94a3b8; padding: 4px 5px; font-size: ${
            isLandscape ? '9px' : '10px'
          }; text-align: ${align}; font-weight: bold; ${colorStyle}">${cellStr}</td>`;
        })
        .join('')}
    </tr>
  `;

  // Render paginated sheets (report-page)
  return chunks.map((chunk) => {
    const pageNum = chunk.pageIndex + 1;
    const mmPageNum = toMyanmarDigits(pageNum);
    const mmTotal = toMyanmarDigits(totalChunks);

    if (chunk.isFirstPage) {
      return `
      <div class="report-page" data-page="${pageNum}" style="width: ${pageWidthPx}px; min-height: ${pageMinHeightPx}px; box-sizing: border-box; padding: 14px 18px; background: #ffffff; color: #0f172a; display: flex; flex-direction: column; justify-content: space-between; page-break-after: ${
        totalChunks > 1 ? 'always' : 'auto'
      }; break-after: ${
        totalChunks > 1 ? 'page' : 'auto'
      }; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); font-family: 'Plus Jakarta Sans', 'Noto Sans Myanmar', 'Padauk', 'Pyidaungsu', sans-serif;">
        <div>
          <!-- Shop Header -->
          <div style="text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #0f172a;">
            <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; text-transform: uppercase;">${shopName}</div>
            ${
              shopAddress || shopPhone
                ? `<div style="font-size: 10px; color: #475569; margin-top: 1px;">${[shopAddress, shopPhone]
                    .filter(Boolean)
                    .join(' • ')}</div>`
                : ''
            }
            <div style="font-size: 13px; font-weight: bold; color: #1e293b; margin-top: 4px;">${title}</div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${subtitle || ''} | ထုတ်ယူချိန် (Printed): ${datePrinted}</div>
          </div>

          <!-- Summary Cards -->
          ${renderCardsHtml()}

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
            ${renderTableHeader()}
            <tbody>
              ${
                chunk.rows.length === 0
                  ? `<tr><td colspan="${tableHeaders.length}" style="text-align:center; padding: 20px; color:#888; border: 1px solid #cbd5e1;">ဒေတာ မရှိပါ (No Data)</td></tr>`
                  : chunk.rows.map((row, rIdx) => renderTableRow(row, rIdx)).join('')
              }
              ${chunk.isLastPage && chunk.summaryRow ? renderSummaryRow(chunk.summaryRow) : ''}
            </tbody>
          </table>
        </div>

        <!-- Page Footer -->
        <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #64748b;">
          <div>စာရင်းပေါင်း (Total): ${tableRows.length} ခု • မှတ်တမ်းအမှတ် (Records): ${chunk.startRowIndex}-${chunk.endRowIndex}</div>
          <div style="font-weight: bold; color: #0f172a;">စာမျက်နှာ ${mmPageNum} / ${mmTotal} • Page ${pageNum} of ${totalChunks}</div>
          <div>ထုတ်ယူသည့်စနစ်: Money Agent POS</div>
        </div>
      </div>
    `;
    }

    // Subsequent Pages
    return `
    <div class="report-page" data-page="${pageNum}" style="width: ${pageWidthPx}px; min-height: ${pageMinHeightPx}px; box-sizing: border-box; padding: 14px 18px; background: #ffffff; color: #0f172a; display: flex; flex-direction: column; justify-content: space-between; page-break-after: ${
      chunk.isLastPage ? 'auto' : 'always'
    }; break-after: ${
      chunk.isLastPage ? 'auto' : 'page'
    }; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); font-family: 'Plus Jakarta Sans', 'Noto Sans Myanmar', 'Padauk', 'Pyidaungsu', sans-serif;">
      <div>
        <!-- Compact Top Banner -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 4px; border-bottom: 2px solid #0f172a; margin-bottom: 6px;">
          <div style="font-size: 11.5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${shopName} • ${title}</div>
          <div style="font-size: 9px; color: #64748b;">${subtitle || ''} | စာမျက်နှာ ${mmPageNum} / ${mmTotal} (Page ${pageNum}/${totalChunks})</div>
        </div>

        <!-- Table with repeated Header -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
          ${renderTableHeader()}
          <tbody>
            ${chunk.rows.map((row, rIdx) => renderTableRow(row, rIdx)).join('')}
            ${chunk.isLastPage && chunk.summaryRow ? renderSummaryRow(chunk.summaryRow) : ''}
          </tbody>
        </table>
      </div>

      <!-- Page Footer -->
      <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #64748b;">
        <div>မှတ်တမ်းအမှတ် (Records): ${chunk.startRowIndex}-${chunk.endRowIndex} / ${tableRows.length}</div>
        <div style="font-weight: bold; color: #0f172a;">စာမျက်နှာ ${mmPageNum} / ${mmTotal} • Page ${pageNum} of ${totalChunks}</div>
        <div>ထုတ်ယူသည့်စနစ်: Money Agent POS</div>
      </div>
    </div>
  `;
  });
}

/**
 * Builds standard clean HTML markup for A4 Report sheets with Auto-Fit & Multi-Page Pagination
 */
export function buildReportHtmlMarkup(options: PrintReportOptions): string {
  const pagesHtml = buildReportHtmlPages(options).join('');
  return `
    <div class="report-wrapper" style="font-family: 'Plus Jakarta Sans', 'Noto Sans Myanmar', 'Padauk', 'Pyidaungsu', Arial, sans-serif; color: #0f172a; background: transparent; width: 100%; display: flex; flex-direction: column; align-items: center;">
      ${pagesHtml}
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
  const isLandscape = options.orientation === 'landscape' || (!options.orientation && options.tableHeaders.length >= 7);
  const pageSizeCss = isLandscape ? 'A4 landscape' : 'A4 portrait';
  const pageMarginCss = isLandscape ? '6mm 8mm' : '8mm 10mm';
  const content = buildReportHtmlMarkup({
    ...options,
    orientation: isLandscape ? 'landscape' : 'portrait',
  });

  return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes" />
  <title>${options.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&family=Padauk:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: ${pageSizeCss};
      margin: ${pageMarginCss};
    }
    @media print {
      body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
        overflow: visible !important;
      }
      .no-print, button, navbar, .action-bar {
        display: none !important;
      }
      .report-wrapper {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      .report-page {
        page-break-after: always !important;
        break-after: page !important;
        width: 100% !important;
        min-height: 100% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 4mm 6mm !important;
        box-shadow: none !important;
        border: none !important;
      }
      .report-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .report-container {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: auto !important;
        word-wrap: break-word !important;
        font-size: ${isLandscape ? '8.5pt' : '9.5pt'} !important;
      }
      th, td {
        border: 1px solid #94a3b8 !important;
        padding: 3px 5px !important;
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
      font-family: 'Plus Jakarta Sans', 'Noto Sans Myanmar', 'Padauk', 'Pyidaungsu', Arial, sans-serif;
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
      max-width: ${isLandscape ? '1140px' : '900px'};
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
      max-width: ${isLandscape ? '1180px' : '900px'};
      background: transparent;
      padding: 0;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div style="font-weight: bold; font-size: 13px;">📄 ${options.title} (${isLandscape ? 'A4 Landscape အလျားလိုက်' : 'A4 Portrait ဒေါင်လိုက်'})</div>
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
