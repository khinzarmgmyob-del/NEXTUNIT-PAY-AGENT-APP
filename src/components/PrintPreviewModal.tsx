import React, { useState, useRef } from 'react';
import {
  Printer,
  FileDown,
  X,
  FileSpreadsheet,
  Sliders,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
} from 'lucide-react';
import { ShopProfile } from '../types';
import { PrintReportOptions, buildReportHtmlMarkup, executeNativePrintOrPreview } from '../utils/exportAndPrint';
import { exportToPdfNative, exportToExcelNative } from '../utils/nativeFileExporter';
import { UNICODE_FONT_FAMILY } from '../utils/unicodeEngine';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportOptions: PrintReportOptions & {
    filename?: string;
  };
}

type PaperSize = 'a4' | 'letter' | 'a5' | 'pos80';
type Orientation = 'portrait' | 'landscape';
type MarginSize = 'normal' | 'compact' | 'wide';

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  reportOptions,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [marginSize, setMarginSize] = useState<MarginSize>('normal');
  const [scale, setScale] = useState<number>(100);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Compute paper CSS dimensions
  const getPaperDimensions = () => {
    if (paperSize === 'pos80') {
      return { width: '80mm', minHeight: '140mm' };
    }
    if (paperSize === 'a5') {
      return orientation === 'portrait'
        ? { width: '148mm', minHeight: '210mm' }
        : { width: '210mm', minHeight: '148mm' };
    }
    if (paperSize === 'letter') {
      return orientation === 'portrait'
        ? { width: '215.9mm', minHeight: '279.4mm' }
        : { width: '279.4mm', minHeight: '215.9mm' };
    }
    // Default A4
    return orientation === 'portrait'
      ? { width: '210mm', minHeight: '297mm' }
      : { width: '297mm', minHeight: '210mm' };
  };

  const getMarginCss = () => {
    switch (marginSize) {
      case 'compact':
        return '8mm';
      case 'wide':
        return '22mm';
      default:
        return '14mm';
    }
  };

  // Generate customized HTML markup
  const htmlContent = buildReportHtmlMarkup(reportOptions);

  // Direct Print Trigger with Page Setup CSS (100% reliable inside iframes & webviews)
  const handlePrint = () => {
    const pageSizeCss = paperSize === 'pos80' ? '80mm auto' : `${paperSize} ${orientation}`;
    const marginCss = getMarginCss();

    const fullDoc = `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8" />
  <title>${reportOptions.title}</title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: ${marginCss};
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: ${UNICODE_FONT_FAMILY};
      color: #000000;
      background: #ffffff;
      padding: ${marginCss};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      zoom: ${scale}%;
    }
    .no-print {
      display: none !important;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    executeNativePrintOrPreview(fullDoc, reportOptions.title);
  };

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportToPdfNative({
        ...reportOptions,
        filename: reportOptions.filename || `${reportOptions.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
      });
    } catch (err: any) {
      console.error('PDF error:', err);
      alert(`PDF ဖိုင်ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Excel Download Handler
  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportToExcelNative({
        filename: reportOptions.filename
          ? reportOptions.filename.replace(/\.pdf$/i, '.xlsx')
          : `${reportOptions.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
        sheetName: 'Report',
        headers: reportOptions.tableHeaders,
        rows: reportOptions.tableRows,
        summaryRow: reportOptions.summaryRow,
      });
    } catch (err: any) {
      console.error('Excel error:', err);
      alert(`Excel ဖိုင်ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const paperDims = getPaperDimensions();

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/85 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* TOP CONTROL BAR */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>စာမျက်နှာ ပရင့်နှင့် Page Setup (Print Preview)</span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-semibold">
                Unicode Engine
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {reportOptions.title} {reportOptions.subtitle && `• ${reportOptions.subtitle}`}
            </p>
          </div>
        </div>

        {/* PAGE SETUP SETTINGS CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          {/* Paper Size */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pl-1">Size:</span>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="a4">📄 A4 (Standard)</option>
              <option value="letter">📄 Letter</option>
              <option value="a5">📄 A5</option>
              <option value="pos80">🧾 80mm POS Slip</option>
            </select>
          </div>

          {/* Orientation */}
          {paperSize !== 'pos80' && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ပုံစံ:</span>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="portrait">↕️ ဒေါင်လိုက် (Portrait)</option>
                <option value="landscape">↔️ အလျားလိုက် (Landscape)</option>
              </select>
            </div>
          )}

          {/* Margin */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Margin:</span>
            <select
              value={marginSize}
              onChange={(e) => setMarginSize(e.target.value as MarginSize)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="compact">ကျဉ်း (Compact 8mm)</option>
              <option value="normal">ပုံမှန် (Normal 14mm)</option>
              <option value="wide">ကျယ် (Wide 22mm)</option>
            </select>
          </div>

          {/* Scale Zoom */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
            <button
              onClick={() => setScale((s) => Math.max(60, s - 10))}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs w-9 text-center font-bold text-slate-700 dark:text-slate-300">
              {scale}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(140, s + 10))}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2">
          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>စာရွက် ပရင့်ထုတ်မည်</span>
          </button>

          {/* PDF Download Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'PDF ဖန်တီးနေ...' : 'PDF ဒေါင်းမည်'}</span>
          </button>

          {/* Excel Download Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? 'Excel ထုတ်နေ...' : 'Excel (.xlsx)'}</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="ပိတ်မည်"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* LIVE PREVIEW CANVAS AREA */}
      <div className="flex-1 overflow-auto bg-slate-800/50 rounded-2xl p-4 flex justify-center items-start border border-slate-700/50">
        <div
          ref={previewRef}
          className="bg-white text-black shadow-2xl transition-all duration-200 origin-top overflow-hidden"
          style={{
            width: paperDims.width,
            minHeight: paperDims.minHeight,
            padding: getMarginCss(),
            fontFamily: UNICODE_FONT_FAMILY,
            transform: `scale(${scale / 100})`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
};
