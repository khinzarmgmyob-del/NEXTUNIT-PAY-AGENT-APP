import React, { useState, useRef } from 'react';
import {
  ScanLine,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  FileDown,
  Printer,
  Sparkles,
  ArrowRight,
  Copy,
} from 'lucide-react';
import { scanSlipWithOcr, OcrSlipResult } from '../utils/ocrEngine';
import { formatKs } from '../utils/formatters';

interface OcrSlipScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTransaction?: (extractedData: OcrSlipResult['data']) => void;
}

export const OcrSlipScannerModal: React.FC<OcrSlipScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyTransaction,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrSlipResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(previewUrl);
    setOcrResult(null);

    // Auto-start OCR scan
    setIsScanning(true);
    setScanProgress(5);
    setProgressStatus('ပုံရိပ်အား စတင်စစ်ဆေးနေပါသည်...');

    try {
      const result = await scanSlipWithOcr(file, (pct, status) => {
        setScanProgress(pct);
        setProgressStatus(status);
      });
      setOcrResult(result);
    } catch (err: any) {
      console.error('OCR process error:', err);
      alert(`OCR ဖတ်ရှုရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (!ocrResult || !ocrResult.data) return;
    onApplyTransaction?.(ocrResult.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>OCR ဘောက်ချာ/Slip ဖတ်ရှုခြင်း Engine</span>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] rounded-full font-bold">
                  AI OCR v2.0
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                KBZPay, WavePay, AYA Pay, CB Pay ဘောက်ချာပုံများမှ ငွေပမာဏ၊ ဖုန်းနှင့် Ref ID များကို အလိုအလျောက် ဖတ်ရှုပေးပါသည်
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* UPLOAD / DROPZONE */}
          {!selectedImage ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center bg-indigo-50/40 dark:bg-indigo-950/20 cursor-pointer transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950/40 space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ဘောက်ချာ / Slip ဓာတ်ပုံအား ဤနေရာသို့ ဆွဲထည့်ပါ သို့မဟုတ် ဖုန်းထဲမှ ရွေးချယ်ပါ
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PNG, JPG, JPEG သို့မဟုတ် ကင်မရာ ရိုက်ချက်
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IMAGE PREVIEW */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-2 relative group max-h-[300px]">
                <img
                  src={selectedImage}
                  alt="Slip preview"
                  className="max-h-[280px] w-auto object-contain rounded-lg"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg backdrop-blur-xs flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>အသစ်လဲမည်</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* OCR STATUS & EXTRACTED FIELDS */}
              <div className="space-y-3">
                {isScanning && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      <span>{progressStatus || 'OCR ဖတ်ရှုနေပါသည်...'}</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-200"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {ocrResult && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>OCR ဖတ်ရှုမှု အောင်မြင်ပါသည် ({ocrResult.confidence}% တိကျမှု)</span>
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 text-xs">
                      {/* Amount */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">ငွေပမာဏ (Amount):</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {ocrResult.data.amount ? `${formatKs(ocrResult.data.amount)} Ks` : 'မတွေ့ရှိပါ'}
                        </span>
                      </div>

                      {/* Type */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">အမျိုးအစား (Type):</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {ocrResult.data.type || 'ငွေသွင်း'}
                        </span>
                      </div>

                      {/* Wallet */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Wallet/အကောင့်:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {ocrResult.data.walletName || 'KPay / WavePay'}
                        </span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">ဖုန်းနံပါတ် (Phone):</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {ocrResult.data.phone || 'မတွေ့ရှိပါ'}
                        </span>
                      </div>

                      {/* Transaction ID */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">ဘောက်ချာ/Txn ID:</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {ocrResult.data.txnId || 'မတွေ့ရှိပါ'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">ရက်စွဲ (Date):</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {ocrResult.data.date} {ocrResult.data.time || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RAW OCR TEXT ACCORDION */}
          {ocrResult && ocrResult.rawText && (
            <details className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs">
              <summary className="font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                OCR မှ ဖတ်ရှုရရှိသော မူရင်းစာသားများ (Raw Text Logs)
              </summary>
              <pre className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {ocrResult.rawText}
              </pre>
            </details>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <button
            onClick={() => {
              setSelectedImage(null);
              setOcrResult(null);
            }}
            className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
          >
            အသစ်ပြန်စစ်မည် (Reset)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              ပိတ်မည်
            </button>

            {ocrResult && ocrResult.data && onApplyTransaction && (
              <button
                onClick={handleApply}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <span>စာရင်းထဲသို့ ထည့်သွင်းမည်</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
