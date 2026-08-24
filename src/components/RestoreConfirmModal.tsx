import React, { useEffect } from 'react';
import { ShieldAlert, CheckCircle2, X, Database, Banknote, Wallet, History, Store, Calendar } from 'lucide-react';
import { BackupData } from '../types';
import { formatKs } from '../utils/formatters';

interface RestoreConfirmModalProps {
  data: BackupData;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  data,
  onConfirm,
  onCancel,
}) => {
  const totalCash = data.cashAccounts.reduce((sum, c) => sum + c.balance, 0);
  const totalWallets = data.wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalAll = totalCash + totalWallets;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onCancel}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150 z-10 my-auto max-h-[94vh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Backup ဖိုင် Restore ပြုလုပ်မည်</h3>
              <p className="text-xs text-sky-100">ဖိုင်အတွင်းရှိ ဒေတာများကို စစ်ဆေးအတည်ပြုပါ</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Warning Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">သတိပြုရန်:</span>
              ဤ Backup ဖိုင်ကို Restore လုပ်လိုက်ပါက လက်ရှိဖုန်းထဲရှိ စာရင်းများကို ဖိုင်အတွင်းရှိ အချက်အလက်များဖြင့် အစားထိုး သိမ်းဆည်းသွားမည် ဖြစ်ပါသည်။
            </div>
          </div>

          {/* Backup Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1 text-slate-500 font-medium mb-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <span>ငွေသားအကောင့်</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{data.cashAccounts.length} ခု</div>
              <div className="text-[10px] text-emerald-700 font-semibold">{formatKs(totalCash)}</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1 text-slate-500 font-medium mb-1">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                <span>Wallet အကောင့်</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{data.wallets.length} ခု</div>
              <div className="text-[10px] text-indigo-700 font-semibold">{formatKs(totalWallets)}</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1 text-slate-500 font-medium mb-1">
                <History className="w-3.5 h-3.5 text-amber-600" />
                <span>မှတ်တမ်းအရေအတွက်</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{data.transactions.length} ခု</div>
              <div className="text-[10px] text-slate-500">စုစုပေါင်း စာရင်း</div>
            </div>
          </div>

          {/* Detailed Metadata */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            {data.shopProfile && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  ဆိုင်အမည်:
                </span>
                <span className="font-bold text-slate-800">{data.shopProfile.shopName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Backup ထုတ်ယူခဲ့သည့်ရက်:
              </span>
              <span className="font-semibold text-slate-700">
                {new Date(data.exportedAt).toLocaleString('en-US')}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-700 font-bold">ငွေစာရင်း စုစုပေါင်း လက်ကျန်:</span>
              <span className="font-black text-indigo-700 text-sm">{formatKs(totalAll)}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            မလုပ်တော့ပါ (Cancel)
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            အတည်ပြုပြီး Restore သွင်းမည်
          </button>
        </div>
      </div>
    </div>
  );
};
