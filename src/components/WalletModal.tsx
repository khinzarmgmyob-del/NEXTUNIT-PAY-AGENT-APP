import React, { useState, useEffect } from 'react';
import { X, Wallet, Plus, Trash2, Edit3, ShieldAlert, Palette, Check } from 'lucide-react';
import { WalletItem } from '../types';
import { getTodayFormatted, formatKs } from '../utils/formatters';
import { COLOR_PRESETS, getPresetByColor } from '../utils/colors';

interface WalletModalProps {
  wallets: WalletItem[];
  onClose: () => void;
  onAddWallet: (wallet: Omit<WalletItem, 'id'>) => void;
  onUpdateWallet: (wallet: WalletItem) => void;
  onDeleteWallet: (id: number) => void;
}

const PRESET_WALLETS = [
  'KPay (Personal)',
  'KPay (Agent)',
  'WaveMoney (Agent)',
  'CB Pay',
  'AYA Pay',
  'KBZ Banking (iBanking)',
  'Yoma Next',
  'TrueMoney',
  'UAB Pay',
];

export const WalletModal: React.FC<WalletModalProps> = ({
  wallets,
  onClose,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
}) => {
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [date, setDate] = useState(getTodayFormatted());
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('indigo');

  const handleStartEdit = (w: WalletItem) => {
    setEditingWallet(w);
    setName(w.name);
    setBalance(w.balance.toString());
    setDate(w.updatedDate || getTodayFormatted());
    setAccountNumber(w.accountNumber || '');
    setSelectedColor(w.color || 'indigo');
  };

  const handleResetForm = () => {
    setEditingWallet(null);
    setName('');
    setBalance('');
    setDate(getTodayFormatted());
    setAccountNumber('');
    setSelectedColor('indigo');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || balance === '') {
      alert('ကျေးဇူးပြု၍ Wallet အမည်နှင့် လက်ကျန်ငွေ ဖြည့်စွက်ပါ။');
      return;
    }

    const numBal = parseFloat(balance) || 0;

    if (editingWallet) {
      onUpdateWallet({
        ...editingWallet,
        name: name.trim(),
        balance: numBal,
        updatedDate: date,
        accountNumber: accountNumber.trim() || undefined,
        color: selectedColor,
      });
    } else {
      onAddWallet({
        name: name.trim(),
        balance: numBal,
        updatedDate: date,
        accountNumber: accountNumber.trim() || undefined,
        color: selectedColor,
      });
    }

    handleResetForm();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 md:p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                👛 Wallet / Bank အကောက်များ စီမံခန့်ခွဲမှု
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">Wallet အသစ်ထည့်ခြင်း၊ အရောင်သတ်မှတ်ခြင်းနှင့် လက်ကျန်ငွေ ပြင်ဆင်ခြင်း</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Existing Wallets List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              လက်ရှိ Wallet / Bank အကောက်များ ({wallets.length} ခု)
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {wallets.map((w) => {
                const preset = getPresetByColor(w.color, 'indigo');
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white/40"
                        style={{ backgroundColor: preset.hex }}
                        title={preset.name}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{w.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {w.accountNumber ? `Acc: ${w.accountNumber} • ` : ''}
                          နောက်ဆုံးပြင်: {w.updatedDate}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 pl-2">
                      <div className="text-right">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm font-mono">{formatKs(w.balance)}</div>
                        <div className="text-[11px] text-slate-400">{(w.balance / 100000).toFixed(1)} သိန်း</div>
                      </div>
                      <button
                        onClick={() => handleStartEdit(w)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="ပြင်ဆင်မည်"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {wallets.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`'${w.name}' Wallet ကို ဖျက်ရန် သေချာပါသလား?`)) {
                              onDeleteWallet(w.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add or Edit Form */}
          <form onSubmit={handleSubmit} className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {editingWallet ? `✏️ '${editingWallet.name}' ကို ပြင်ဆင်ရန်` : '➕ Wallet အကောက် အသစ် ထည့်သွင်းရန်'}
              </span>
              {editingWallet && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  အသစ်ထည့်မည်သို့ ပြောင်းရန်
                </button>
              )}
            </div>

            {!editingWallet && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  အသုံးများသော အမည်များ ရွေးချယ်နိုင်သည်:
                </label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_WALLETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setName(p)}
                      className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Wallet အမည် <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ - KPay (Shop)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  လက်ကျန် ပမာဏ (Ks) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* Color Selection Palette */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>အကောက် အရောင်ရွေးချယ်ရန် (Color Tag):</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                {COLOR_PRESETS.map((p) => {
                  const isSelected = selectedColor === p.id || selectedColor === p.hex;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedColor(p.id)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                        isSelected 
                          ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 scale-110 border-white shadow-sm' 
                          : 'border-transparent hover:scale-105 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-2">
                  {getPresetByColor(selectedColor, 'indigo').name}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  အကောက် / ဖုန်းနံပါတ် (ရွေးချယ်ရန်)
                </label>
                <input
                  type="text"
                  placeholder="09..."
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ပြင်ဆင်သည့် နေ့စွဲ
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {editingWallet ? 'ပြင်ဆင်ချက် သိမ်းမည် ✓' : 'Wallet အသစ် သိမ်းမည် +'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
