import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
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
 * Native + Web PDF Exporter
 * - Auto-Fit to A4 Landscape for multi-column tables (>6 cols)
 * - Automatic Multi-Page pagination (Page 1, 2, 3...)
 * - High-DPI canvas capture using browser's native text shaper for Burmese & English
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

  const isLandscape =
    options.orientation === 'landscape' ||
    (!options.orientation && options.tableHeaders.length >= 7);
  const paperWidthMm = isLandscape ? 297 : 210;
  const paperHeightMm = isLandscape ? 210 : 297;
  const containerWidthPx = isLandscape ? 1122 : 800;

  let pdfDoc: jsPDF;

  // Retrieve individual page markup array
  const pages = buildReportHtmlPages({
    ...options,
    orientation: isLandscape ? 'landscape' : 'portrait',
  });

  // Offscreen container positioned at (0,0) behind UI to ensure positive coordinates for html2canvas
  const container = document.createElement('div');
  container.id = 'pdf-render-stage';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = `${containerWidthPx}px`;
  container.style.zIndex = '-9999';
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
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pages.length; i++) {
      container.innerHTML = pages[i];
      // Allow browser to render layout and fonts
      await new Promise((resolve) => setTimeout(resolve, 80));

      const pageEl = container.firstElementChild as HTMLElement;
      if (!pageEl) continue;

      pageEl.style.boxShadow = 'none';
      pageEl.style.border = 'none';
      pageEl.style.margin = '0';
      const actualHeight = pageEl.offsetHeight || (isLandscape ? 770 : 1080);

      const canvasPromise = html2canvas(pageEl, {
        scale: 2, // 2x scale for sharp text rendering
        useCORS: false,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: containerWidthPx,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: containerWidthPx,
        height: actualHeight,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Canvas render timed out')), 12000)
      );

      const canvas = await Promise.race([canvasPromise, timeoutPromise]);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, paperWidthMm, paperHeightMm);
    }

    pdfDoc = pdf;
  } catch (canvasErr) {
    console.warn('Canvas PDF export error, triggering native print preview engine:', canvasErr);
    // Never fallback to raw doc.text() which cannot shape Burmese characters.
    // Fallback to Native Print Preview which guarantees 100% native vector font rendering!
    const fullHtml = generateFullReportHtmlDocument({
      ...options,
      orientation: isLandscape ? 'landscape' : 'portrait',
    });
    executeNativePrintOrPreview(fullHtml, options.title);
    return {
      success: true,
      platform: 'web',
    };
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
