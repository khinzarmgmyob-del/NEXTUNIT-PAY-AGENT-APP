import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PrintReportOptions,
  buildReportHtmlMarkup,
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
      console.error('Native FileOpener error:', retryErr);
      const msg = retryErr?.message || String(retryErr);
      alert(
        `ဖိုင်ကို သိမ်းဆည်းပြီးပါပြီ!\nတည်နေရာ: ${filePath}\n\nသို့သော် ဖိုင်ဖွင့်ရန် သင့်တော်သော App (PDF Reader / Excel) မတွေ့ရှိပါ သို့မဟုတ် Permission လိုအပ်ပါသည်:\n${msg}`
      );
      return { success: true, filePath, platform: 'native', error: msg };
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
 * Direct Vector PDF generator fallback using jsPDF (no canvas / no timeout)
 */
function createFallbackVectorPdf(options: PrintReportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const shopName = options.shopProfile?.shopName || 'Money Agent POS';
  doc.setFontSize(13);
  doc.text(shopName, 14, 15);
  doc.setFontSize(11);
  doc.text(options.title || 'Report', 14, 22);
  if (options.subtitle) {
    doc.setFontSize(8);
    doc.text(options.subtitle, 14, 28);
  }

  let startY = 34;
  if (options.summaryCards && options.summaryCards.length > 0) {
    doc.setFontSize(8);
    const cardTexts = options.summaryCards.map((c) => `${c.label}: ${c.value}`).join('  |  ');
    doc.text(cardTexts, 14, startY);
    startY += 8;
  }

  const maxCols = Math.min(options.tableHeaders.length, 10);
  const headers = options.tableHeaders.slice(0, maxCols);
  const colWidth = (210 - 28) / maxCols;

  doc.setFontSize(8);
  headers.forEach((h, idx) => {
    doc.text(String(h).substring(0, 16), 14 + idx * colWidth, startY);
  });
  doc.line(14, startY + 2, 196, startY + 2);
  startY += 6;

  options.tableRows.forEach((row) => {
    if (startY > 280) {
      doc.addPage();
      startY = 15;
    }
    row.slice(0, maxCols).forEach((cell, idx) => {
      const val = cell !== undefined && cell !== null ? String(cell) : '';
      doc.text(val.substring(0, 16), 14 + idx * colWidth, startY);
    });
    startY += 5;
  });

  if (options.summaryRow && options.summaryRow.length > 0) {
    if (startY > 275) {
      doc.addPage();
      startY = 15;
    }
    doc.line(14, startY, 196, startY);
    startY += 4;
    options.summaryRow.slice(0, maxCols).forEach((cell, idx) => {
      const val = cell !== undefined && cell !== null ? String(cell) : '';
      doc.text(val.substring(0, 16), 14 + idx * colWidth, startY);
    });
  }

  return doc;
}

/**
 * Native + Web PDF Exporter
 * - On Mobile Native: Generates real PDF binary, writes to Documents, launches FileOpener with "Open with" chooser
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

  let pdfDoc: jsPDF;

  // Render hidden offscreen container with full opacity for canvas rendering
  const reportHtml = buildReportHtmlMarkup(options);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.width = '800px';
  container.style.zIndex = '99999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '20px';
  container.style.fontFamily = "'Pyidaungsu', 'Padauk', 'Myanmar3', 'Noto Sans Myanmar', -apple-system, BlinkMacSystemFont, sans-serif";
  container.innerHTML = reportHtml;
  document.body.appendChild(container);

  try {
    const canvasPromise = html2canvas(container, {
      scale: 1.2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF Canvas render timed out')), 12000)
    );

    const canvas = await Promise.race([canvasPromise, timeoutPromise]);

    const imgData = canvas.toDataURL('image/jpeg', 0.90);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdfDoc = pdf;
  } catch (canvasErr) {
    console.warn('Canvas rendering fallback to vector PDF:', canvasErr);
    pdfDoc = createFallbackVectorPdf(options);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }

  // Convert PDF to binary ArrayBuffer, Base64, and Blob
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
