import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PrintReportOptions,
  buildReportHtmlMarkup,
  buildReportHtmlPages,
  downloadBlob,
  exportReportToPdfAndShare,
  generateFullReportHtmlDocument,
  executeNativePrintOrPreview,
} from './exportAndPrint';

import { normalizeMyanmarUnicode } from './unicodeEngine';

/**
 * Result interface for native export operations
 */
export interface NativeExportResult {
  success: boolean;
  filePath?: string;
  platform: 'native' | 'web';
  error?: string;
}

/**
 * Universal Core Engine: Saves and Opens a file using Capacitor Filesystem + FileOpener
 * 
 * 1. Pre-checks platform (Capacitor Native vs Web Preview).
 * 2. Writes to Directory.Documents (with MoneyAgent/ subfolder, recursive: true).
 * 3. Falls back to Directory.Cache if external storage permissions are restricted.
 * 4. Invokes @capacitor-community/file-opener to open the file with installed Native PDF Reader or Excel.
 * 5. Catch block provides clear alerts / feedback.
 */
export async function saveAndOpenFileNative({
  fileName,
  base64Data,
  mimeType,
  fallbackBlob,
}: {
  fileName: string;
  base64Data: string;
  mimeType: string;
  fallbackBlob?: Blob;
}): Promise<NativeExportResult> {
  const isNative = Capacitor.isNativePlatform();

  // Web fallback: download directly in browser
  if (!isNative) {
    if (fallbackBlob) {
      await downloadBlob(fallbackBlob, fileName);
      return { success: true, platform: 'web' };
    }
    // Convert base64 to blob if fallbackBlob not provided
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      await downloadBlob(blob, fileName);
      return { success: true, platform: 'web' };
    } catch (e: any) {
      console.error('Web download error:', e);
      return { success: false, platform: 'web', error: e?.message };
    }
  }

  // Mobile Native Platform Execution
  let fileResult;
  const targetFolder = 'MoneyAgent';
  const targetPath = `${targetFolder}/${fileName}`;

  // Step 1: Write file with Directory.Documents or fallback to Directory.Cache
  try {
    fileResult = await Filesystem.writeFile({
      path: targetPath,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (docErr: any) {
    console.warn('Directory.Documents write failed, attempting Directory.Cache fallback:', docErr);
    try {
      fileResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
    } catch (cacheErr: any) {
      console.error('Directory.Cache write also failed:', cacheErr);
      const errMsg = `ဖိုင်သိမ်းဆည်း၍ မရပါ (Permission လိုအပ်နိုင်ပါသည်):\n${cacheErr?.message || cacheErr}`;
      alert(errMsg);
      return { success: false, platform: 'native', error: cacheErr?.message };
    }
  }

  const filePath = fileResult.uri;

  // Step 2: Open file with Native FileOpener
  try {
    await FileOpener.open({
      filePath: filePath,
      contentType: mimeType,
      openWithDefault: false,
    });
    return { success: true, filePath, platform: 'native' };
  } catch (openErr: any) {
    console.warn('FileOpener openWithDefault: false failed, retrying with openWithDefault: true:', openErr);
    try {
      await FileOpener.open({
        filePath: filePath,
        contentType: mimeType,
        openWithDefault: true,
      });
      return { success: true, filePath, platform: 'native' };
    } catch (retryErr: any) {
      console.warn('Native FileOpener open failed, attempting system Share sheet:', retryErr);
      try {
        await Share.share({
          title: fileName,
          text: fileName,
          url: filePath,
          dialogTitle: 'ဖိုင်ဖွင့်ရန် App ရွေးချယ်ပါ (Choose App)',
        });
        return { success: true, filePath, platform: 'native' };
      } catch (shareErr: any) {
        console.error('System Share also failed:', shareErr);
        const msg = retryErr?.message || String(retryErr);
        alert(
          `ဖိုင်ကို သိမ်းဆည်းပြီးပါပြီ!\nတည်နေရာ: ${filePath}\n\nသို့သော် ဖိုင်ဖွင့်ရန် သင့်တော်သော App (PDF Reader / Excel) မတွေ့ရှိပါ သို့မဟုတ် Permission လိုအပ်ပါသည်:\n${msg}`
        );
        return { success: true, filePath, platform: 'native', error: msg };
      }
    }
  }
}

/**
 * Native + Web Excel (.xlsx) Exporter
 * Works seamlessly with existing Report tables & formats
 */
export async function exportToExcelNative({
  filename,
  sheetName = 'Transactions',
  headers,
  rows,
  summaryRow,
}: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
  summaryRow?: (string | number)[];
}): Promise<NativeExportResult> {
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  try {
    const wb = XLSX.utils.book_new();

    // Unicode Engine normalization for Myanmar & English text
    const cleanHeaders = headers.map((h) => normalizeMyanmarUnicode(h));
    const cleanRows = rows.map((r) =>
      r.map((cell) => (typeof cell === 'string' ? normalizeMyanmarUnicode(cell) : cell))
    );
    const cleanSummary = summaryRow?.map((cell) =>
      typeof cell === 'string' ? normalizeMyanmarUnicode(cell) : cell
    );

    const sheetData: (string | number)[][] = [cleanHeaders, ...cleanRows];
    if (cleanSummary && cleanSummary.length > 0) {
      sheetData.push(cleanSummary);
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

    // Base64 encoding for Native Capacitor Filesystem
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    // Blob for Web fallback
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const fallbackBlob = new Blob([excelBuffer], { type: mimeType });

    return await saveAndOpenFileNative({
      fileName: safeFilename,
      base64Data,
      mimeType,
      fallbackBlob,
    });
  } catch (err: any) {
    console.error('exportToExcelNative error:', err);
    alert(`Excel ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    return { success: false, platform: 'native', error: err?.message };
  }
}

/**
 * Converts an ArrayBuffer to a Base64 string without exceeding maximum call stack size
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * High-performance, 100% reliable Native Canvas 2D PDF Generator
 * Uses browser's native text shaper for perfect Myanmar & English fonts without corruption
 */
function createCanvasFallbackPdf(options: PrintReportOptions): jsPDF {
  const isLandscape =
    options.orientation === 'landscape' ||
    (!options.orientation && options.tableHeaders.length >= 7);

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const paperWidthMm = isLandscape ? 297 : 210;
  const paperHeightMm = isLandscape ? 210 : 297;
  const canvasW = isLandscape ? 1400 : 990;
  const canvasH = isLandscape ? 990 : 1400;

  const shopName = options.shopProfile?.shopName || 'Money Agent POS';
  const subtitle = options.subtitle || '';
  const datePrinted = new Date().toLocaleString('en-GB');

  const rows = options.tableRows;
  const headers = options.tableHeaders;
  const summaryCards = options.summaryCards || [];
  const summaryRow = options.summaryRow;

  const rowsPerPage = isLandscape ? (summaryCards.length > 0 ? 14 : 18) : 24;
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const fontNormal = '"Noto Sans Myanmar", "Padauk", "Pyidaungsu", "Plus Jakarta Sans", sans-serif';

  for (let p = 0; p < totalPages; p++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const marginX = 24;
    let currentY = 32;

    if (p === 0) {
      // Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 22px ${fontNormal}`;
      ctx.fillText(shopName, canvasW / 2, currentY);

      currentY += 24;
      ctx.font = `bold 16px ${fontNormal}`;
      ctx.fillText(options.title || 'အရောင်းအဝယ်နှင့် ကော်မရှင် ရှင်းတမ်း', canvasW / 2, currentY);

      currentY += 18;
      ctx.font = `12px ${fontNormal}`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${subtitle} | ထုတ်ယူချိန် (Printed): ${datePrinted}`, canvasW / 2, currentY);

      currentY += 16;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, currentY);
      ctx.lineTo(canvasW - marginX, currentY);
      ctx.stroke();

      currentY += 14;

      // Summary cards
      if (summaryCards.length > 0) {
        const cardCount = Math.min(summaryCards.length, 4);
        const cardGap = 12;
        const totalGap = cardGap * (cardCount - 1);
        const cardWidth = (canvasW - marginX * 2 - totalGap) / cardCount;
        const cardHeight = 52;

        summaryCards.slice(0, 4).forEach((card, idx) => {
          const cardX = marginX + idx * (cardWidth + cardGap);
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(cardX, currentY, cardWidth, cardHeight, 6);
          } else {
            ctx.rect(cardX, currentY, cardWidth, cardHeight);
          }
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = '#475569';
          ctx.font = `bold 11px ${fontNormal}`;
          ctx.fillText(card.label, cardX + 8, currentY + 16);

          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 14px ${fontNormal}`;
          ctx.fillText(card.value, cardX + 8, currentY + 34);

          if (card.note) {
            ctx.fillStyle = '#64748b';
            ctx.font = `10px ${fontNormal}`;
            ctx.fillText(card.note, cardX + 8, currentY + 46);
          }
        });

        currentY += cardHeight + 14;
      }
    } else {
      // Subsequent page compact header
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 15px ${fontNormal}`;
      ctx.fillText(`${shopName} • ${options.title}`, marginX, currentY);

      ctx.textAlign = 'right';
      ctx.font = `12px ${fontNormal}`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(
        `${subtitle} | စာမျက်နှာ ${p + 1} / ${totalPages} (Page ${p + 1} of ${totalPages})`,
        canvasW - marginX,
        currentY
      );

      currentY += 12;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginX, currentY);
      ctx.lineTo(canvasW - marginX, currentY);
      ctx.stroke();
      currentY += 12;
    }

    // Draw Table
    const tableWidth = canvasW - marginX * 2;
    const colCount = Math.min(headers.length, 17);
    const colWidth = tableWidth / colCount;
    const headerHeight = 28;
    const rowHeight = 24;

    // Header row
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(marginX, currentY, tableWidth, headerHeight);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, currentY, tableWidth, headerHeight);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 11px ${fontNormal}`;
    ctx.textAlign = 'center';

    headers.slice(0, colCount).forEach((h, colIdx) => {
      const cellX = marginX + colIdx * colWidth;
      ctx.strokeRect(cellX, currentY, colWidth, headerHeight);
      ctx.fillText(String(h).substring(0, 16), cellX + colWidth / 2, currentY + 18);
    });

    currentY += headerHeight;

    // Page rows
    const startIdx = p * rowsPerPage;
    const endIdx = Math.min(startIdx + rowsPerPage, rows.length);
    const pageRows = rows.slice(startIdx, endIdx);

    pageRows.forEach((row, rIdx) => {
      const isEven = rIdx % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#f8fafc';
      ctx.fillRect(marginX, currentY, tableWidth, rowHeight);

      row.slice(0, colCount).forEach((cell, colIdx) => {
        const cellX = marginX + colIdx * colWidth;
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(cellX, currentY, colWidth, rowHeight);

        const text = cell !== undefined && cell !== null ? String(cell) : '';
        const isPos = text.startsWith('+');
        const isNeg = text.startsWith('-');
        ctx.fillStyle = isPos ? '#047857' : isNeg ? '#b91c1c' : '#1e293b';
        ctx.font = `${isPos || isNeg ? 'bold ' : ''}10.5px ${fontNormal}`;

        const isCenter = colIdx <= 2;
        const isRight = colIdx >= 5 && colIdx <= 9;
        if (isCenter) {
          ctx.textAlign = 'center';
          ctx.fillText(text, cellX + colWidth / 2, currentY + 16);
        } else if (isRight) {
          ctx.textAlign = 'right';
          ctx.fillText(text, cellX + colWidth - 4, currentY + 16);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(text.substring(0, 18), cellX + 4, currentY + 16);
        }
      });

      currentY += rowHeight;
    });

    // Summary row on last page
    if (p === totalPages - 1 && summaryRow && summaryRow.length > 0) {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(marginX, currentY, tableWidth, rowHeight);

      summaryRow.slice(0, colCount).forEach((cell, colIdx) => {
        const cellX = marginX + colIdx * colWidth;
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(cellX, currentY, colWidth, rowHeight);

        const text = cell !== undefined && cell !== null ? String(cell) : '';
        const isPos = text.startsWith('+');
        const isNeg = text.startsWith('-');
        ctx.fillStyle = isPos ? '#047857' : isNeg ? '#b91c1c' : '#0f172a';
        ctx.font = `bold 11px ${fontNormal}`;

        const isRight = colIdx >= 5 && colIdx <= 9;
        if (isRight) {
          ctx.textAlign = 'right';
          ctx.fillText(text, cellX + colWidth - 4, currentY + 16);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(text, cellX + 4, currentY + 16);
        }
      });
      currentY += rowHeight;
    }

    // Footer
    const footerY = canvasH - 20;
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(marginX, footerY - 12);
    ctx.lineTo(canvasW - marginX, footerY - 12);
    ctx.stroke();

    ctx.font = `11px ${fontNormal}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText(
      `စာရင်းပေါင်း (Total): ${rows.length} ခု • မှတ်တမ်းအမှတ် (Records): ${startIdx + 1}-${endIdx}`,
      marginX,
      footerY
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 11.5px ${fontNormal}`;
    ctx.fillText(`စာမျက်နှာ ${p + 1} / ${totalPages} • Page ${p + 1} of ${totalPages}`, canvasW / 2, footerY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = `11px ${fontNormal}`;
    ctx.fillText(`Money Agent POS`, canvasW - marginX, footerY);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (p > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, paperWidthMm, paperHeightMm);
  }

  return pdf;
}

/**
 * Native + Web PDF Exporter
 * - Auto-Fit to A4 Landscape for multi-column tables (>6 cols)
 * - Automatic Multi-Page pagination (Page 1, 2, 3...)
 * - High-DPI canvas capture using browser's native text shaper for Burmese & English
 * - On Mobile Native: Generates real PDF binary, writes to Documents, launches FileOpener with "Choose App" / "Open with" chooser
 * - On Web Browser: Directly downloads or triggers Web Share
 */
export async function exportToPdfNative(
  options: PrintReportOptions & { filename?: string }
): Promise<NativeExportResult> {
  const safeFilename = options.filename
    ? options.filename.endsWith('.pdf')
      ? options.filename
      : `${options.filename}.pdf`
    : `Report_${Date.now()}.pdf`;

  const isLandscape =
    options.orientation === 'landscape' ||
    (!options.orientation && options.tableHeaders.length >= 7);

  const paperSize = options.paperSize || 'a4';
  let paperWidthMm = isLandscape ? 297 : 210;
  let paperHeightMm = isLandscape ? 210 : 297;
  let containerWidthPx = isLandscape ? 1122 : 800;
  let jsPdfFormat: string | number[] = 'a4';

  if (paperSize === 'letter') {
    paperWidthMm = isLandscape ? 279.4 : 215.9;
    paperHeightMm = isLandscape ? 215.9 : 279.4;
    containerWidthPx = isLandscape ? 1056 : 816;
    jsPdfFormat = 'letter';
  } else if (paperSize === 'a5') {
    paperWidthMm = isLandscape ? 210 : 148;
    paperHeightMm = isLandscape ? 148 : 210;
    containerWidthPx = isLandscape ? 794 : 560;
    jsPdfFormat = 'a5';
  } else if (paperSize === 'pos80') {
    paperWidthMm = 80;
    paperHeightMm = 200;
    containerWidthPx = 320;
    jsPdfFormat = [80, 200];
  }

  let pdfDoc: jsPDF | null = null;

  // Retrieve individual page markup array
  const pages = buildReportHtmlPages({
    ...options,
    orientation: isLandscape ? 'landscape' : 'portrait',
    paperSize,
  });

  // Position container in foreground with opacity 1 to ensure browser layout & fonts are fully active
  const container = document.createElement('div');
  container.id = 'pdf-render-stage';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = `${containerWidthPx}px`;
  container.style.zIndex = '99999';
  container.style.visibility = 'visible';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily =
    "'Noto Sans Myanmar', 'Padauk', 'Pyidaungsu', 'Plus Jakarta Sans', Arial, sans-serif";
  container.style.margin = '0';
  container.style.padding = '0';
  document.body.appendChild(container);

  try {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: jsPdfFormat as any,
      compress: true,
    });

    for (let i = 0; i < pages.length; i++) {
      container.innerHTML = pages[i];
      // Allow browser to render layout and fonts
      await new Promise((resolve) => setTimeout(resolve, 60));

      const pageEl = container.firstElementChild as HTMLElement;
      if (!pageEl) continue;

      pageEl.style.boxShadow = 'none';
      pageEl.style.border = 'none';
      pageEl.style.margin = '0';

      const canvasPromise = html2canvas(pageEl, {
        scale: 1.35, // Fast, lightweight, crisp on mobile
        useCORS: true,
        allowTaint: false, // Prevents canvas tainting so toDataURL never throws SecurityError
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: containerWidthPx,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Canvas render timed out')), 8000)
      );

      const canvas = await Promise.race([canvasPromise, timeoutPromise]);
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      if (i > 0) {
        pdf.addPage(jsPdfFormat as any, isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, paperWidthMm, paperHeightMm);
    }

    pdfDoc = pdf;
  } catch (canvasErr) {
    console.warn('html2canvas failed or timed out, using Canvas 2D fallback engine:', canvasErr);
    // 100% reliable fallback using native HTML5 Canvas 2D with browser font shaper
    pdfDoc = createCanvasFallbackPdf(options);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }

  // Ensure pdfDoc is never null
  if (!pdfDoc) {
    pdfDoc = createCanvasFallbackPdf(options);
  }

  // Convert PDF to binary ArrayBuffer, Base64, and Blob, then save & trigger native choose app dialog
  try {
    const arrayBuffer = pdfDoc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const fallbackBlob = pdfDoc.output('blob');

    return await saveAndOpenFileNative({
      fileName: safeFilename,
      base64Data,
      mimeType: 'application/pdf',
      fallbackBlob,
    });
  } catch (saveErr: any) {
    console.error('PDF Save & Open error:', saveErr);
    alert(`PDF ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${saveErr?.message || saveErr}`);
    return { success: false, platform: 'native', error: saveErr?.message };
  }
}
