import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PrintReportOptions, buildReportHtmlMarkup, downloadBlob, exportReportToPdfAndShare } from './exportAndPrint';

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
      downloadBlob(fallbackBlob, fileName);
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
      downloadBlob(blob, fileName);
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
      openWithDefault: true,
    });
    return { success: true, filePath, platform: 'native' };
  } catch (openErr: any) {
    console.error('Native FileOpener error:', openErr);
    const msg = openErr?.message || String(openErr);
    alert(
      `ဖိုင်ကို သိမ်းဆည်းပြီးပါပြီ!\nတည်နေရာ: ${filePath}\n\nသို့သော် ဖိုင်ဖွင့်ရန် သင့်တော်သော App (PDF Reader / Excel) မတွေ့ရှိပါ သို့မဟုတ် Permission လိုအပ်ပါသည်:\n${msg}`
    );
    return { success: true, filePath, platform: 'native', error: msg };
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
 * Native + Web PDF Exporter
 * - On Mobile Native: Generates real PDF binary via html2canvas & jsPDF, writes to Documents, launches FileOpener
 * - On Web Browser: Opens clean native print & Save-as-PDF preview dialog
 */
export async function exportToPdfNative(
  options: PrintReportOptions & { filename?: string }
): Promise<NativeExportResult> {
  const isNative = Capacitor.isNativePlatform();
  const safeFilename = options.filename
    ? options.filename.endsWith('.pdf')
      ? options.filename
      : `${options.filename}.pdf`
    : `Report_${Date.now()}.pdf`;

  // On Web: use browser print / save as PDF
  if (!isNative) {
    await exportReportToPdfAndShare(options);
    return { success: true, platform: 'web' };
  }

  // On Mobile Native: Render HTML to canvas and generate PDF
  const reportHtml = buildReportHtmlMarkup(options);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width standard in px
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '24px';
  container.innerHTML = reportHtml;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width mm
    const pageHeight = 297; // A4 height mm
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

    const dataUri = pdf.output('datauristring');
    const base64Data = dataUri.replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, '').replace(/^data:.*?;base64,/, '');

    return await saveAndOpenFileNative({
      fileName: safeFilename,
      base64Data,
      mimeType: 'application/pdf',
    });
  } catch (err: any) {
    console.warn('Native PDF canvas generation failed, falling back to print dialog:', err);
    // Fallback to native print preview
    await exportReportToPdfAndShare(options);
    return { success: true, platform: 'native' };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
