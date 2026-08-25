import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
export function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 1000);
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
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
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
              return `<td style="border: 1px solid #94a3b8; padding: 6px 8px; font-size: 10px; text-align: ${align}; font-weight: bold; color: #0f172a;">${
                cell !== undefined && cell !== null ? cell : ''
              }</td>`;
            })
            .join('')}
        </tr>
      `
          : ''
      }
    </tbody>
  `;

  return `
    <div style="font-family: 'Plus Jakarta Sans', 'Pyidaungsu', 'Padauk', Arial, sans-serif; color: #0f172a; background: #fff; padding: 16px; font-size: 11px; line-height: 1.4; width: 100%;">
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

      <div style="margin-top: 20px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
        <div>စာရင်းပေါင်း: ${tableRows.length} ခု</div>
        <div>System: Money Agent POS</div>
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
 * Robust HTML to PDF Generator and Direct Download / Capacitor Share
 * 1. Renders HTML in high DPI canvas using offscreen positioned wrapper
 * 2. Compiles to clean A4 / Receipt PDF using jsPDF
 * 3. Triggers immediate automatic file download as .pdf
 * 4. Also shares via Native Sheet on Android/iOS Capacitor
 */
export async function exportAndSharePdf({
  htmlContent,
  filename,
  title,
  isThermal = false,
}: {
  htmlContent: string;
  filename: string;
  title: string;
  isThermal?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  // Create off-screen rendering wrapper that is fully painted but positioned off-viewport
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0px';
  wrapper.style.width = isThermal ? '400px' : '860px';
  wrapper.style.overflow = 'visible';
  wrapper.style.zIndex = '-99999';
  wrapper.style.backgroundColor = '#ffffff';

  const container = document.createElement('div');
  container.style.width = isThermal ? '380px' : '820px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.innerHTML = htmlContent;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  try {
    // Wait for layout/fonts to be ready
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(container, {
      scale: 2, // 2x crisp rendering for Myanmar Unicode
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: isThermal ? 450 : 920,
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL('image/png');

    let pdf: jsPDF;
    if (isThermal) {
      // Thermal 80mm format
      const pdfWidth = 80;
      const pdfHeight = Math.max(80, (canvas.height * pdfWidth) / canvas.width);
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    } else {
      // A4 portrait format with standard page margins
      pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    // 1. Direct Browser PDF Download via Blob URL (most reliable in iframe & browsers)
    const pdfBlob = pdf.output('blob');
    downloadBlob(pdfBlob, safeFilename);

    // 2. Also trigger jsPDF save method
    try {
      pdf.save(safeFilename);
    } catch (saveErr) {
      console.warn('pdf.save note:', saveErr);
    }

    // 3. If running in Capacitor Native Environment (Android / iOS), also trigger Native Share
    if (Capacitor.isNativePlatform()) {
      try {
        const base64DataUri = pdf.output('datauristring');
        const base64Clean = base64DataUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');

        const writeResult = await Filesystem.writeFile({
          path: safeFilename,
          data: base64Clean,
          directory: Directory.Cache,
        });

        await Share.share({
          title: title,
          text: `${title} - Money Agent POS PDF Report`,
          url: writeResult.uri,
          dialogTitle: 'Share PDF via Viber, Telegram or Save to Files',
        });
      } catch (nativeErr: any) {
        console.warn('Native Capacitor Share note:', nativeErr);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('PDF Generation / Export error:', error);
    return { success: false, error: error?.message || 'PDF ထုတ်ယူရာတွင် အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်။' };
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

/**
 * Helper to Export Formatted Report as PDF & Native Share
 */
export async function exportReportToPdfAndShare(options: PrintReportOptions & { filename?: string }): Promise<boolean> {
  const html = buildReportHtmlMarkup(options);
  const safeFilename = options.filename || `${options.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  const result = await exportAndSharePdf({
    htmlContent: html,
    filename: safeFilename,
    title: options.title,
    isThermal: false,
  });
  return result.success;
}

/**
 * Helper to Export Receipt Voucher as PDF & Native Share
 */
export async function exportReceiptToPdfAndShare(
  transactionOrHtml: Transaction | string,
  shopProfile?: ShopProfile,
  filename?: string
): Promise<boolean> {
  const html = buildReceiptHtmlMarkup(transactionOrHtml, shopProfile);
  const txId = typeof transactionOrHtml === 'object' ? transactionOrHtml.id : 'Voucher';
  const safeFilename = filename || `Receipt_Voucher_${txId}_${Date.now()}.pdf`;
  const result = await exportAndSharePdf({
    htmlContent: html,
    filename: safeFilename,
    title: `ပြေစာလက်မှတ် #${txId}`,
    isThermal: true,
  });
  return result.success;
}

/**
 * Printable Report Helper
 * Generates an isolated, beautifully styled print window/iframe
 */
export function printFormattedReport(options: PrintReportOptions) {
  const innerHtml = buildReportHtmlMarkup(options);
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${options.title}</title>
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
      </style>
    </head>
    <body>
      ${innerHtml}
    </body>
    </html>
  `;
  executePrintHtml(fullHtml);
}

/**
 * Print Transaction Receipt Directly
 */
export function printReceiptDocument(transactionOrHtml: Transaction | string, shopProfile?: ShopProfile) {
  const innerHtml = buildReceiptHtmlMarkup(transactionOrHtml, shopProfile);
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
      </style>
    </head>
    <body>
      ${innerHtml}
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
