import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Wifi,
  Radio,
  Zap,
  CheckCircle2,
  RefreshCw,
  Settings,
  Columns,
  Check,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { ShopProfile } from '../types';
import {
  PrintReportOptions,
  buildReportHtmlMarkup,
  executeNativePrintOrPreview,
  computeSummaryRowWithAllTotals,
} from '../utils/exportAndPrint';
import { exportToPdfNative, exportToExcelNative } from '../utils/nativeFileExporter';
import { UNICODE_FONT_FAMILY } from '../utils/unicodeEngine';
import {
  NetworkPrinter,
  getSavedNetworkPrinter,
  autoScanLocalNetwork,
  autoRunVirtualDriver,
  generateTestPrintHtml,
} from '../utils/networkPrinterDriver';
import { NetworkPrinterModal } from './NetworkPrinterModal';

interface PrintPreviewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  reportOptions: PrintReportOptions & {
    filename?: string;
  };
}

type PaperSize = 'a4' | 'letter' | 'a5' | 'pos80';
type Orientation = 'portrait' | 'landscape';
type MarginSize = 'normal' | 'compact' | 'wide';
type FontSize = 'normal' | 'compact' | 'large';

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen = true,
  onClose,
  reportOptions,
}) => {
  if (isOpen === false) return null;
  const defaultOrientation: Orientation =
    reportOptions.orientation ||
    (reportOptions.tableHeaders && reportOptions.tableHeaders.length >= 7 ? 'landscape' : 'portrait');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>(defaultOrientation);
  const [marginSize, setMarginSize] = useState<MarginSize>('normal');
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [scale, setScale] = useState<number>(100);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [networkPrinter, setNetworkPrinter] = useState<NetworkPrinter>(getSavedNetworkPrinter);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [driverNotice, setDriverNotice] = useState<{ text: string; type: 'info' | 'success' } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Column Visibility state: list of visible column indices
  const [visibleColumnIndices, setVisibleColumnIndices] = useState<number[]>(() =>
    reportOptions.tableHeaders ? reportOptions.tableHeaders.map((_, i) => i) : []
  );

  // Re-sync when table headers change
  useEffect(() => {
    if (reportOptions.tableHeaders) {
      setVisibleColumnIndices(reportOptions.tableHeaders.map((_, i) => i));
    }
  }, [reportOptions.tableHeaders]);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedNetworkPrinter();
      setNetworkPrinter(saved);
    }
  }, [isOpen]);

  // Quick toggle a column index
  const toggleColumn = (index: number) => {
    if (visibleColumnIndices.includes(index)) {
      if (visibleColumnIndices.length <= 1) return; // keep at least 1 column
      setVisibleColumnIndices((prev) => prev.filter((i) => i !== index));
    } else {
      setVisibleColumnIndices((prev) => [...prev, index].sort((a, b) => a - b));
    }
  };

  // Select all columns
  const selectAllColumns = () => {
    setVisibleColumnIndices(reportOptions.tableHeaders.map((_, i) => i));
  };

  // Select essential core financial columns preset
  const selectEssentialColumns = () => {
    const essential = reportOptions.tableHeaders
      .map((header, idx) => {
        if (idx === 0) return idx; // No.
        const h = header.toLowerCase();
        if (
          h.includes('ရက်စွဲ') ||
          h.includes('date') ||
          h.includes('ဖောက်သည်') ||
          h.includes('customer') ||
          h.includes('အမျိုးအစား') ||
          h.includes('type') ||
          h.includes('လက်ငင်း') ||
          h.includes('actual') ||
          h.includes('မူလငွေ') ||
          h.includes('amount') ||
          h.includes('ကော်မရှင်') ||
          h.includes('comm') ||
          h.includes('ဝေါလက်') ||
          h.includes('wallet') ||
          h.includes('လက်ကျန်') ||
          h.includes('balance')
        ) {
          return idx;
        }
        return -1;
      })
      .filter((idx) => idx !== -1);

    if (essential.length > 0) {
      setVisibleColumnIndices(essential);
    } else {
      selectAllColumns();
    }
  };

  // Derived filtered data respecting visible column selections
  const effectiveHeaders = useMemo(() => {
    return reportOptions.tableHeaders.filter((_, idx) => visibleColumnIndices.includes(idx));
  }, [reportOptions.tableHeaders, visibleColumnIndices]);

  const effectiveRows = useMemo(() => {
    return reportOptions.tableRows.map((row) =>
      row.filter((_, idx) => visibleColumnIndices.includes(idx))
    );
  }, [reportOptions.tableRows, visibleColumnIndices]);

  const effectiveAligns = useMemo(() => {
    if (!reportOptions.columnAligns) return undefined;
    return reportOptions.columnAligns.filter((_, idx) => visibleColumnIndices.includes(idx));
  }, [reportOptions.columnAligns, visibleColumnIndices]);

  // Dynamically compute totals for all numeric/amount columns
  const effectiveSummaryRow = useMemo(() => {
    const filteredBaseSummary = reportOptions.summaryRow
      ? reportOptions.summaryRow.filter((_, idx) => visibleColumnIndices.includes(idx))
      : undefined;
    return computeSummaryRowWithAllTotals(effectiveHeaders, effectiveRows, filteredBaseSummary);
  }, [effectiveHeaders, effectiveRows, reportOptions.summaryRow, visibleColumnIndices]);

  // Quick auto-detect local network printers
  const handleQuickAutoDetect = async () => {
    setIsAutoDetecting(true);
    setDriverNotice({ text: 'ဒေသတွင်း Wi-Fi ကွန်ရက်အတွင်း ပရင်တာများကို ရှာဖွေနေပါသည်...', type: 'info' });
    try {
      const found = await autoScanLocalNetwork('192.168.1');
      if (found.length > 1) {
        const detected = found[1];
        setNetworkPrinter(detected);
        setDriverNotice({ text: `Wi-Fi ပရင်တာ ${detected.name} ကို ရှာဖွေတွေ့ရှိပြီး အလိုအလျောက် ချိတ်ဆက်လိုက်ပါပြီ။`, type: 'success' });
      } else {
        setDriverNotice({ text: `Universal Wi-Fi Print Spooler (Mopria/AirPrint) အသင့်ဖြစ်နေပါပြီ။`, type: 'success' });
      }
    } catch (e) {
      console.warn('Quick auto detect error:', e);
    } finally {
      setIsAutoDetecting(false);
      setTimeout(() => setDriverNotice(null), 4000);
    }
  };

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
        return '6mm 8mm';
      case 'wide':
        return '18mm 22mm';
      default:
        return '10mm 14mm';
    }
  };

  // Generate customized HTML markup using filtered columns, responsive margins & font scaling
  const htmlContent = buildReportHtmlMarkup({
    ...reportOptions,
    tableHeaders: effectiveHeaders,
    tableRows: effectiveRows,
    summaryRow: effectiveSummaryRow,
    columnAligns: effectiveAligns,
    orientation,
    fontSize,
    marginSize,
    paperSize,
  });

  const [isPrintingWithDriver, setIsPrintingWithDriver] = useState(false);

  // Direct Print Trigger with Page Setup CSS & Auto-Run Virtual Driver
  const handlePrint = async () => {
    const pageSizeCss = paperSize === 'pos80' ? '80mm auto' : `${paperSize} ${orientation}`;
    const marginCss = getMarginCss();

    const fullDoc = `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="utf-8" />
  <title>${reportOptions.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&family=Padauk:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: ${pageSizeCss};
      margin: ${marginCss};
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
      .no-print {
        display: none !important;
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
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: auto !important;
        box-sizing: border-box !important;
      }
      th, td {
        border: 1px solid #94a3b8 !important;
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
      color: #000000;
      background: #ffffff;
      padding: ${marginCss};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      zoom: ${scale}%;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    setIsPrintingWithDriver(true);
    setDriverNotice({
      text: `Virtual Driver အလိုအလျောက် အလုပ်လုပ်နေပါသည်... ${networkPrinter.name} သို့ Print ပို့ဆောင်နေပါသည်...`,
      type: 'info',
    });

    try {
      const res = await autoRunVirtualDriver(fullDoc, {
        printer: networkPrinter,
        paperSize,
        orientation,
        title: reportOptions.title,
      });

      if (res.success) {
        setDriverNotice({
          text: `Virtual Driver အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ (${networkPrinter.name})`,
          type: 'success',
        });
      } else {
        // Direct browser print fallback
        executeNativePrintOrPreview(fullDoc, reportOptions.title);
      }
    } catch (err: any) {
      console.warn('Virtual driver execution error, falling back to direct browser print:', err);
      executeNativePrintOrPreview(fullDoc, reportOptions.title);
    } finally {
      setIsPrintingWithDriver(false);
      setTimeout(() => setDriverNotice(null), 4000);
    }
  };

  // PDF Download Handler - Respects hidden columns, margin, font scale and computed totals
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportToPdfNative({
        ...reportOptions,
        tableHeaders: effectiveHeaders,
        tableRows: effectiveRows,
        summaryRow: effectiveSummaryRow,
        columnAligns: effectiveAligns,
        orientation,
        fontSize,
        marginSize,
        paperSize,
        filename: reportOptions.filename || `${reportOptions.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
      });
    } catch (err: any) {
      console.error('PDF error:', err);
      alert(`PDF ဖိုင်ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Excel Download Handler - Respects hidden columns and computed totals
  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportToExcelNative({
        filename: reportOptions.filename
          ? reportOptions.filename.replace(/\.pdf$/i, '.xlsx')
          : `${reportOptions.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
        sheetName: 'Report',
        headers: effectiveHeaders,
        rows: effectiveRows,
        summaryRow: effectiveSummaryRow,
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
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 relative">
          {/* Column Selector Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setIsColumnPickerOpen((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                isColumnPickerOpen || visibleColumnIndices.length < reportOptions.tableHeaders.length
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="မလိုသော ကော်လံများကို ဖျောက်/ပြ ရွေးချယ်မည်"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>ကော်လံများ ({visibleColumnIndices.length}/{reportOptions.tableHeaders.length})</span>
            </button>

            {/* Column Picker Flyout Panel */}
            {isColumnPickerOpen && (
              <div 
                className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    <span>ပုံနှိပ်/ထုတ်ယူမည့် ကော်လံများ</span>
                  </div>
                  <button
                    onClick={() => setIsColumnPickerOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Preset Buttons */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <button
                    onClick={selectAllColumns}
                    className="flex-1 py-1 px-2 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer text-center"
                  >
                    အားလုံးပြမည်
                  </button>
                  <button
                    onClick={selectEssentialColumns}
                    className="flex-1 py-1 px-2 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer text-center"
                    title="အဓိက ငွေစာရင်း ကော်လံများကိုသာ အကျဉ်းချုံး ပြမည်"
                  >
                    အဓိက (Compact)
                  </button>
                </div>

                {/* Column Checklist */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {reportOptions.tableHeaders.map((header, idx) => {
                    const isChecked = visibleColumnIndices.includes(idx);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs select-none transition-colors ${
                          isChecked
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/40 text-slate-900 dark:text-slate-100 font-semibold'
                            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(idx)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                        />
                        <span className="truncate flex-1" title={header}>
                          {header}
                        </span>
                        {isChecked && (
                          <Eye className="w-3 h-3 text-indigo-500 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                  <span>ရွေးချယ်ထား: {visibleColumnIndices.length} ခု</span>
                  <button
                    onClick={() => setIsColumnPickerOpen(false)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    အိုကေ (Done)
                  </button>
                </div>
              </div>
            )}
          </div>

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

          {/* Font / Text Size */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Font:</span>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as FontSize)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              title="စာလုံးနှင့် ဇယား အရွယ်အစား ချိန်ညှိရန်"
            >
              <option value="compact">သေး (Compact)</option>
              <option value="normal">ပုံမှန် (Normal)</option>
              <option value="large">ကြီး (Large)</option>
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
              title="ဘေးဘောင် Margin အကျဉ်း/အကျယ် ချိန်ညှိရန်"
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
            title="လက်ရှိ ကော်လံနှင့် အနေအထားအတိုင်း PDF ထုတ်မည်"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'PDF ဖန်တီးနေ...' : 'PDF ဒေါင်းမည်'}</span>
          </button>

          {/* Excel Download Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            title="လက်ရှိ ကော်လံနှင့် အနေအထားအတိုင်း Excel ထုတ်မည်"
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

      {/* DRIVER FEEDBACK FLOATING BANNER */}
      {driverNotice && (
        <div
          className={`mb-3 p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            driverNotice.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20'
              : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {driverNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <span className="font-semibold">{driverNotice.text}</span>
          </div>
          <button
            onClick={() => setDriverNotice(null)}
            className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* LOCAL NETWORK WI-FI PRINTER & VIRTUAL DRIVER STATUS BAR */}
      <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 sm:px-4 shadow-md flex flex-wrap items-center justify-between gap-2.5 text-xs mb-3 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
              <Wifi className="w-4 h-4" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Wi-Fi ပရင်တာ:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[320px]">
                {networkPrinter.name}
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md">
                {networkPrinter.ip.includes('Local') ? 'Universal Wi-Fi' : networkPrinter.ip}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Virtual Driver: Phone/Tablet Direct Auto-Run Ready (အသင့်ရှိ)</span>
            </div>
          </div>
        </div>

        {/* PRINTER ACTION CONTROLS */}
        <div className="flex items-center gap-2">
          {/* Quick Auto-Detect Button */}
          <button
            onClick={handleQuickAutoDetect}
            disabled={isAutoDetecting}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 text-[11px]"
            title="ဒေသတွင်း Wi-Fi ပရင်တာ အလိုအလျောက် ရှာဖွေမည်"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isAutoDetecting ? 'animate-spin' : ''}`} />
            <span>{isAutoDetecting ? 'ရှာဖွေနေ...' : 'Auto Detect (ရှာဖွေမည်)'}</span>
          </button>

          {/* Manage / Configure Button */}
          <button
            onClick={() => setIsNetworkModalOpen(true)}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 active:scale-95 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer text-[11px]"
            title="Wi-Fi ပရင်တာ ပြင်ဆင်ရန် / Manual IP ချိတ်ရန်"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ပရင်တာ ပြင်ဆင်ရန်</span>
          </button>
        </div>
      </div>

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

      {/* NETWORK PRINTER MANAGEMENT MODAL */}
      <NetworkPrinterModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
        shopProfile={reportOptions.shopProfile}
        onPrinterConnected={(p) => {
          setNetworkPrinter(p);
          setDriverNotice({ text: `${p.name} သို့ ချိတ်ဆက်ပြီးပါပြီ`, type: 'success' });
          setTimeout(() => setDriverNotice(null), 3000);
        }}
      />
    </div>
  );
};
