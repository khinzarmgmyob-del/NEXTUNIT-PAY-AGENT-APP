import React, { useState, useEffect } from 'react';
import { X, Printer, Copy, Check, FileCheck, Store, MapPin, Phone } from 'lucide-react';
import { Transaction, ShopProfile } from '../types';
import { formatKs } from '../utils/formatters';

interface TransactionReceiptModalProps {
  transaction: Transaction;
  shopProfile?: ShopProfile;
  onClose: () => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  transaction,
  shopProfile: propProfile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Get shop profile from prop or fallback to localStorage
  const shopProfile: ShopProfile = propProfile || (() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { shopName: 'MONEY AGENT POS', address: '', phone: '' };
      }
    }
    return { shopName: 'MONEY AGENT POS', address: '', phone: '' };
  })();

  const isCashOut = transaction.type === 'ထုတ်';
  const isTransfer = transaction.type === 'လွှဲပြောင်း';
  const isDeducted = transaction.commissionMode === 'deduct';
  const netCash = transaction.netPayout !== undefined
    ? transaction.netPayout
    : (isCashOut && isDeducted ? (transaction.amount - transaction.commission) : transaction.amount);

  const typeLabel = isTransfer
    ? 'Wallet to Wallet လွှဲပြောင်း'
    : transaction.type === 'သွင်း'
    ? 'ငွေသွင်း (Cash In)'
    : 'ငွေထုတ် (Cash Out)';

  const receiptText = `
=== ${shopProfile.shopName || 'Money Agent POS'} ===
${shopProfile.address ? `လိပ်စာ: ${shopProfile.address}\n` : ''}${shopProfile.phone ? `ဖုန်း: ${shopProfile.phone}\n` : ''}--------------------------------
ပြေစာအမှတ်: #${transaction.id}
နေ့စွဲ / အချိန်: ${transaction.date} ${transaction.time || ''}
ဖောက်သည်အမည်: ${transaction.customerName}
အမျိုးအစား: ${typeLabel}
${isTransfer ? `လွှဲထုတ်သည့် Wallet: ${transaction.walletName}\nလက်ခံသည့် Wallet: ${transaction.targetWalletName || '-'}\n` : `Wallet အကောင့်: ${transaction.walletName}\n`}ငွေပမာဏ: ${transaction.amount.toLocaleString()} Ks
ကော်မရှင်/ဝန်ဆောင်ခ: ${transaction.commission.toLocaleString()} Ks ${isCashOut ? (isDeducted ? '(မူလငွေမှ နုတ်ယူ)' : '(သက်သက်ပေး)') : ''}
${isCashOut ? `ဖောက်သည်သို့ အမှန်ပေးငွေ: ${netCash.toLocaleString()} Ks\n` : ''}ဖုန်းနံပါတ်: ${transaction.phone}
${transaction.cashAccountName ? `ငွေသားအကောင့်: ${transaction.cashAccountName}\n` : ''}${transaction.note ? `မှတ်ချက်: ${transaction.note}\n` : ''}================================
အဆင်ပြေစွာ အသုံးပြုနိုင်ပါစေ။ ကျေးဇူးတင်ပါသည်။
  `.trim();

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 md:p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isTransfer ? 'bg-sky-50 text-sky-600' : isCashOut ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <FileCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-800">ငွေလွှဲ/ငွေထုတ် ပြေစာ (Receipt)</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1 mb-3">
          {/* Voucher Paper Box */}
          <div className="p-4 sm:p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-xs text-slate-800 space-y-3 select-all shadow-inner">
          {/* Shop Header (Centered) */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 font-sans space-y-1">
            {shopProfile.logoUrl && (
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 rounded-full border-2 border-indigo-100 bg-white p-1 shadow-xs flex items-center justify-center overflow-hidden">
                  <img
                    src={shopProfile.logoUrl}
                    alt="Shop Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
            <div className="font-bold text-base text-slate-900 tracking-tight">
              {shopProfile.shopName || '📱 MONEY AGENT POS'}
            </div>
            {shopProfile.address && (
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{shopProfile.address}</span>
              </div>
            )}
            {shopProfile.phone && (
              <div className="text-[11px] text-slate-600 font-semibold flex items-center justify-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{shopProfile.phone}</span>
              </div>
            )}
            <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider pt-0.5">
              {isTransfer ? '🔄 Wallet to Wallet လွှဲပြောင်း ပြေစာ' : 'ငွေလွှဲ / ငွေထုတ် ပြေစာလက်မှတ်'}
            </div>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">ပြေစာနံပါတ်:</span>
            <span className="font-bold text-slate-900">#{transaction.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ရက်စွဲ / အချိန်:</span>
            <span className="font-semibold text-slate-800">{transaction.date} {transaction.time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ဖောက်သည်:</span>
            <span className="font-bold text-slate-900">{transaction.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ဖုန်းနံပါတ်:</span>
            <span className="text-slate-800">{transaction.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">အမျိုးအစား:</span>
            <span className={`font-bold ${
              isTransfer ? 'text-sky-600' : transaction.type === 'သွင်း' ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {typeLabel}
            </span>
          </div>

          {isTransfer ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">လွှဲထုတ်သည့် Wallet (From):</span>
                <span className="font-bold text-sky-700">{transaction.walletName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">လက်ခံသည့် Wallet (To):</span>
                <span className="font-bold text-indigo-700">{transaction.targetWalletName || '-'}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-slate-500">အသုံးပြုသည့် Wallet:</span>
              <span className="font-semibold text-slate-800">{transaction.walletName}</span>
            </div>
          )}

          {transaction.cashAccountName && (
            <div className="flex justify-between">
              <span className="text-slate-500">
                {isTransfer ? 'ကော်မရှင်ဝင် ငွေသားအကောင့်:' : 'ငွေသားအကောင့်:'}
              </span>
              <span className="font-semibold text-slate-800">{transaction.cashAccountName}</span>
            </div>
          )}

          <div className="pt-2 border-t border-dashed border-slate-300">
            <div className="flex justify-between text-sm py-1 font-bold">
              <span>{isTransfer ? 'လွှဲပြောင်းငွေ ပမာဏ:' : 'မူလငွေ ပမာဏ:'}</span>
              <span className="text-slate-950">{formatKs(transaction.amount)}</span>
            </div>
            <div className="flex justify-between text-xs py-0.5 text-emerald-700">
              <span>
                {isTransfer ? 'လွှဲခ / ဝန်ဆောင်ခ:' : 'ဝန်ဆောင်ခ (ကော်မရှင်):'}{' '}
                {isCashOut ? (isDeducted ? '(မူလငွေမှ နုတ်ယူ)' : '(သက်သက်ပေး)') : ''}
              </span>
              <span>+{formatKs(transaction.commission)}</span>
            </div>
            {isCashOut && (
              <div className="flex justify-between text-sm py-1.5 mt-1 border-t border-dashed border-slate-200 font-bold text-rose-700 bg-rose-50/70 px-2 rounded">
                <span>ဖောက်သည်သို့ အမှန်ပေးငွေ:</span>
                <span>{formatKs(netCash)}</span>
              </div>
            )}
          </div>

          {transaction.note && (
            <div className="pt-2 border-t border-dashed border-slate-300 text-[11px] text-slate-600">
              <span>မှတ်ချက်: </span>
              <span>{transaction.note}</span>
            </div>
          )}

          <div className="text-center pt-2 text-[10px] text-slate-400 font-sans">
            ကျေးဇူးတင်ပါသည်။ အဆင်ပြေစွာ အသုံးပြုနိုင်ပါစေ။
          </div>
        </div>
      </div>

        {/* Action buttons (Pinned at bottom) */}
        <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
          <button
            onClick={handleCopyText}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                ပြေစာစာသား Copy
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print ထုတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
