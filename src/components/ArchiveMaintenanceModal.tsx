import React, { useState, useEffect } from 'react';
import {
  X,
  Archive,
  Trash2,
  Download,
  Share2,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Database,
  Layers,
} from 'lucide-react';
import { Transaction } from '../types';
import {
  ArchiveFilterPeriod,
  partitionTransactions,
  exportArchiveFile,
  cleanCacheAndTemporaryData,
} from '../utils/archiveManager';
import { formatKs } from '../utils/formatters';

interface ArchiveMaintenanceModalProps {
  transactions: Transaction[];
  onClose: () => void;
  onPurgeArchived: (retainedTransactions: Transaction[], purgedCount: number) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ArchiveMaintenanceModal: React.FC<ArchiveMaintenanceModalProps> = ({
  transactions,
  onClose,
  onPurgeArchived,
  onShowToast,
}) => {
  const [period, setPeriod] = useState<ArchiveFilterPeriod>('6months');
  const [customDate, setCustomDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [hasExported, setHasExported] = useState<boolean>(false);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [isCleaningCache, setIsCleaningCache] = useState<boolean>(false);

  // Compute partition
  const { toArchive, toKeep, cutoffDate } = partitionTransactions(
    transactions,
    period,
    customDate
  );

  const totalArchiveAmount = toArchive.reduce((sum, t) => sum + t.amount, 0);

  // Step 2: Export Archive Handler
  const handleExportArchive = async (shareDirectly: boolean = false) => {
    if (toArchive.length === 0) {
      onShowToast('Archive ပြုလုပ်ရန် စာရင်းဟောင်း မရှိပါ', 'info');
      return;
    }

    setIsExporting(true);
    try {
      const res = await exportArchiveFile(toArchive, cutoffDate, shareDirectly);
      if (res.success) {
        setHasExported(true);
        setExportedFilename(res.fileName || 'archive.json');
        onShowToast(res.message, 'success');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast('Archive ထုတ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ' + (err?.message || ''), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Step 3: Safe Purge Handler
  const handlePurge = () => {
    if (toArchive.length === 0) {
      onShowToast('ဖျက်ထုတ်ရန် စာရင်းဟောင်း မရှိပါ', 'info');
      return;
    }

    if (!hasExported) {
      const confirmWithoutExport = confirm(
        `⚠️ သတိပေးချက်: စာရင်းဟောင်း (${toArchive.length}) ခုကို Archive File မထုတ်ရသေးပါ။\n\nFile မထုတ်ဘဲ ဖျက်လိုက်ပါက ပြန်ယူ၍ မရနိုင်ပါ။ သေချာပါသလား?`
      );
      if (!confirmWithoutExport) return;
    } else {
      const confirmPurge = confirm(
        `အတည်ပြုချက်: စာရင်းဟောင်း (${toArchive.length}) ခု အား Main App မှ ဖျက်ထုတ်ပြီး Database ကို ကျုံ့ရှင်းလင်း (Purge & Vacuum) ပါမည်။ သေချာပါသလား?`
      );
      if (!confirmPurge) return;
    }

    onPurgeArchived(toKeep, toArchive.length);
    onShowToast(`စာရင်းဟောင်း (${toArchive.length}) ခု အား အောင်မြင်စွာ ဖျက်ထုတ်ပြီး Database Compact ပြုလုပ်ပြီးပါပြီ။`, 'success');
    onClose();
  };

  // Cache Clean Handler
  const handleClearCache = async () => {
    setIsCleaningCache(true);
    try {
      const res = await cleanCacheAndTemporaryData();
      onShowToast(res.message, 'success');
    } catch (err: any) {
      onShowToast('Cache ရှင်းလင်းရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်', 'error');
    } finally {
      setIsCleaningCache(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs shrink-0">
              <Archive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">စာရင်းဟောင်းများ Archive & Cache ရှင်းလင်းခြင်း</h3>
              <p className="text-xs text-amber-100">App လေးလံမှု မဖြစ်စေရန် စာရင်းဟောင်းများ ခွဲထုတ်ထိန်းသိမ်းခြင်း</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* STEP 1: SELECT ARCHIVE PERIOD */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                Archive ပြုလုပ်မည့် ကာလ ရွေးချယ်ပါ
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Cutoff ရက်စွဲ: <b className="text-indigo-700">{cutoffDate}</b> မတိုင်မီ
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPeriod('1month')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  period === '1month'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ၁ လ ထက်ဟောင်း
              </button>

              <button
                type="button"
                onClick={() => setPeriod('3months')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  period === '3months'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ၃ လ ထက်ဟောင်း
              </button>

              <button
                type="button"
                onClick={() => setPeriod('6months')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  period === '6months'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ၆ လ ထက်ဟောင်း
              </button>

              <button
                type="button"
                onClick={() => setPeriod('1year')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  period === '1year'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ၁ နှစ် ထက်ဟောင်း
              </button>
            </div>

            {/* Partition Statistics */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Archive ထုတ်မည့် စာရင်း:</span>
                <span className="text-base font-black text-amber-900">{toArchive.length} ခု</span>
                <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">
                  {formatKs(totalArchiveAmount)}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">App ထဲတွင် ဆက်ထားမည့် စာရင်း:</span>
                <span className="text-base font-black text-emerald-800">{toKeep.length} ခု</span>
                <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">လတ်တလော စာရင်းများ</span>
              </div>
            </div>
          </div>

          {/* STEP 2: EXPORT ARCHIVE TO FILE */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                စာရင်းဟောင်းများကို File အဖြစ် Export/Share လုပ်ပါ
              </span>
              {hasExported && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Export ပြီးပါပြီ
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExportArchive(false)}
                disabled={isExporting || toArchive.length === 0}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                📥 JSON သိမ်းဆည်းမည်
              </button>

              <button
                type="button"
                onClick={() => handleExportArchive(true)}
                disabled={isExporting || toArchive.length === 0}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                📤 Archive ဖိုင် Share မည်
              </button>
            </div>
            {hasExported && (
              <p className="text-[11px] text-slate-500 font-mono truncate">
                Export ဖိုင်: {exportedFilename}
              </p>
            )}
          </div>

          {/* STEP 3: PURGE OLD DATA & CACHE CLEAN */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              စာရင်းဟောင်းများ ဖျက်ထုတ်ခြင်း (Purge & Vacuum)
            </span>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                အရေးကြီး သတိပေးချက်:
              </div>
              <p className="text-[11px] leading-relaxed">
                အဆင့် (၂) တွင် File အောင်မြင်စွာ ထုတ်ယူပြီးပါက ဤနေရာတွင် စာရင်းဟောင်း ({toArchive.length}) ခု အား ဖျက်ထုတ်ပြီး App Database ကို အလိုအလျောက် သန့်စင် ကျုံ့ပေးပါမည်။
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handlePurge}
                disabled={toArchive.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                🗑️ စာရင်းဟောင်း ({toArchive.length}) ခု ဖျက်ထုတ်မည် (Purge)
              </button>

              <button
                type="button"
                onClick={handleClearCache}
                disabled={isCleaningCache}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="ယာယီ Cache ဖိုင်များ ရှင်းလင်းမည်"
              >
                {isCleaningCache ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-600" />}
                🧹 Cache & Temp ရှင်းမည်
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
