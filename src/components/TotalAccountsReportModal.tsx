import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Search,
  Download,
  Printer,
  Banknote,
  Wallet,
  TrendingUp,
  Layers,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Transaction, WalletItem, CashAccountItem, ShopProfile } from '../types';
import { getTodayFormatted, formatKs, formatLakh } from '../utils/formatters';

interface TotalAccountsReportModalProps {
  onClose: () => void;
  wallets: WalletItem[];
  cashAccounts: CashAccountItem[];
  transactions: Transaction[];
  shopProfile?: ShopProfile;
  selectedReportDate: string;
  setSelectedReportDate: (date: string) => void;
}

export const TotalAccountsReportModal: React.FC<TotalAccountsReportModalProps> = ({
  onClose,
  wallets,
  cashAccounts,
  transactions,
  shopProfile,
  selectedReportDate,
  setSelectedReportDate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card'); // Default card on mobile
  const [showSummaryChips, setShowSummaryChips] = useState(true);
  const todayStr = getTodayFormatted();

  // Filter transactions by date and search
  const filteredTransactions = transactions.filter((item) => {
    if (selectedReportDate !== 'ALL' && item.date !== selectedReportDate) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      item.walletName.toLowerCase().includes(q) ||
      (item.targetWalletName && item.targetWalletName.toLowerCase().includes(q)) ||
      (item.cashAccountName && item.cashAccountName.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => a.id - b.id);

  // Cash Account deltas for filtered transactions
  const getCashDeltaForTx = (tx: Transaction, cashAccName: string): number => {
    if (tx.cashAccountName !== cashAccName) return 0;
    if (tx.type === 'လွှဲပြောင်း') {
      return tx.commission || 0; // Commission collected in cash
    }
    const isCashOut = tx.type === 'ထုတ်';
    if (!isCashOut) {
      return tx.amount + (tx.commission || 0);
    }
    return -(tx.amount - (tx.commission || 0));
  };

  // Wallet deltas for filtered transactions
  const getWalletDeltaForTx = (tx: Transaction, walletName: string): number => {
    if (tx.type === 'လွှဲပြောင်း') {
      if (tx.walletName === walletName) return -tx.amount;
      if (tx.targetWalletName === walletName) return tx.amount;
      return 0;
    }
    if (tx.walletName !== walletName) return 0;
    const isCashOut = tx.type === 'ထုတ်';
    return isCashOut ? tx.amount : -tx.amount;
  };

  // Total current balances
  const totalCashBalance = cashAccounts.reduce((sum, c) => sum + c.balance, 0);
  const totalWalletBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const grandTotalBalance = totalCashBalance + totalWalletBalance;

  // Commission totals
  const totalCommission = sortedTransactions.reduce((sum, t) => sum + (t.commission || 0), 0);

  // Totals for matrix columns
  const cashAccountTotals = cashAccounts.map((c) =>
    sortedTransactions.reduce((sum, tx) => sum + getCashDeltaForTx(tx, c.name), 0)
  );
  const walletTotals = wallets.map((w) =>
    sortedTransactions.reduce((sum, tx) => sum + getWalletDeltaForTx(tx, w.name), 0)
  );

  // Export CSV
  const handleExportCSV = () => {
    const cashHeaders = cashAccounts.map((c) => `"${c.name} (ငွေသား)"`);
    const walletHeaders = wallets.map((w) => `"${w.name} (Wallet)"`);

    const headers = [
      'စဉ်',
      'နေ့စွဲ',
      'အချိန်',
      'ဖောက်သည်အမည်',
      'အမျိုးအစား / ဖော်ပြချက်',
      ...cashHeaders,
      ...walletHeaders,
      'ကော်မရှင်ခ (Ks)',
      'ဖုန်းနံပါတ်',
      'မှတ်ချက်',
    ].join(',');

    const rows = sortedTransactions.map((tx, idx) => {
      const isCashOut = tx.type === 'ထုတ်';
      const isTransfer = tx.type === 'လွှဲပြောင်း';
      const desc = isTransfer
        ? `Wallet to Wallet (${tx.walletName} -> ${tx.targetWalletName || '-'})`
        : isCashOut
        ? `ငွေထုတ် (${tx.walletName} -> ${tx.cashAccountName})`
        : `ငွေသွင်း (${tx.cashAccountName} -> ${tx.walletName})`;

      const cashCols = cashAccounts.map((c) => {
        const delta = getCashDeltaForTx(tx, c.name);
        return delta !== 0 ? delta : 0;
      });

      const walletCols = wallets.map((w) => {
        const delta = getWalletDeltaForTx(tx, w.name);
        return delta !== 0 ? delta : 0;
      });

      return [
        idx + 1,
        `"${tx.date}"`,
        `"${tx.time || '-'}"`,
        `"${tx.customerName}"`,
        `"${desc}"`,
        ...cashCols,
        ...walletCols,
        tx.commission || 0,
        `"${tx.phone}"`,
        `"${tx.note || '-'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `all_accounts_balance_ledger_${selectedReportDate}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-7xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-5 md:p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                စုစုပေါင်း ငွေစာရင်းအားလုံး လက်ကျန် အသေးစိတ် ရှင်းတမ်း
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                ငွေသား နှင့် Wallet အကောက်အားလုံး၏ အပြောင်းအလဲမှတ်တမ်း
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="ကတ်ပြားပုံစံ (Card View)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Card</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="ဇယားပုံစံ (Table View)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">ဇယား</span>
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="CSV ဒေါင်းလုဒ်"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Print ထုတ်မည်"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 pr-0.5 space-y-3">
          {/* Summary Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl p-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">📌 လက်ရှိ လက်ကျန်ငွေများ အကျဉ်းချုပ်</span>
              <button
                onClick={() => setShowSummaryChips(!showSummaryChips)}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                {showSummaryChips ? 'ဖျောက်မည်' : 'ကြည့်မည်'}
                {showSummaryChips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSummaryChips && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <Banknote className="w-3 h-3" />
                    💵 ငွေသားပေါင်း ({cashAccounts.length} နေရာ)
                  </div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatKs(totalCashBalance)}
                  </div>
                  <div className="text-[9px] text-emerald-600 dark:text-emerald-500">{formatLakh(totalCashBalance)}</div>
                </div>

                <div className="p-2.5 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                  <div className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    🏦 Wallet ပေါင်း ({wallets.length} ခု)
                  </div>
                  <div className="text-sm sm:text-base font-black text-indigo-700 dark:text-indigo-400 mt-0.5">
                    {formatKs(totalWalletBalance)}
                  </div>
                  <div className="text-[9px] text-indigo-600 dark:text-indigo-400">{formatLakh(totalWalletBalance)}</div>
                </div>

                <div className="p-2.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    📈 ကော်မရှင် စုစုပေါင်း
                  </div>
                  <div className="text-sm sm:text-base font-black text-amber-800 dark:text-amber-400 mt-0.5">
                    +{formatKs(totalCommission)}
                  </div>
                  <div className="text-[9px] text-amber-700 dark:text-amber-500">အရောင်းအဝယ် {sortedTransactions.length} ခုမှ</div>
                </div>

                <div className="p-2.5 bg-gradient-to-tr from-indigo-700 to-indigo-600 text-white rounded-xl shadow-xs">
                  <div className="text-[10px] font-bold text-indigo-100 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    🌐 ငွေစာရင်းအားလုံးလက်ကျန်
                  </div>
                  <div className="text-sm sm:text-base font-black text-white mt-0.5">
                    {formatKs(grandTotalBalance)}
                  </div>
                  <div className="text-[9px] text-indigo-200">{formatLakh(grandTotalBalance)} (Cash+Wallet)</div>
                </div>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <input
                type="date"
                value={selectedReportDate === 'ALL' ? todayStr : selectedReportDate}
                onChange={(e) => setSelectedReportDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <button
              onClick={() => setSelectedReportDate(todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedReportDate === todayStr
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              ယနေ့
            </button>

            <button
              onClick={() => setSelectedReportDate('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedReportDate === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              ရက်စွဲအားလုံး
            </button>

            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ရှာဖွေရန်..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* VIEW 1: RESPONSIVE CARDS VIEW */}
          {viewMode === 'card' && (
            <div className="space-y-2.5">
              {/* Reference Card: Opening Balances */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <span>📌 အကောက်များ၏ လက်ရှိ လက်ကျန်ငွေများ (Current Balances):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {cashAccounts.map((c) => (
                    <div key={`card-init-c-${c.id}`} className="p-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold truncate">💵 {c.name}</div>
                      <div className="font-black text-emerald-700 dark:text-emerald-400">{formatKs(c.balance)}</div>
                    </div>
                  ))}
                  {wallets.map((w) => (
                    <div key={`card-init-w-${w.id}`} className="p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <div className="text-[10px] text-indigo-800 dark:text-indigo-300 font-bold truncate">🏦 {w.name}</div>
                      <div className="font-black text-indigo-700 dark:text-indigo-400">{formatKs(w.balance)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {sortedTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-xs">
                  ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော အရောင်းအဝယ် စာရင်း မရှိပါ။
                </div>
              ) : (
                sortedTransactions.map((item, index) => {
                  const isCashOut = item.type === 'ထုတ်';
                  const isTransfer = item.type === 'လွှဲပြောင်း';
                  const cashDelta = getCashDeltaForTx(item, item.cashAccountName || '');
                  const walletDelta = getWalletDeltaForTx(item, item.walletName);

                  return (
                    <div
                      key={`card-tx-${item.id}`}
                      className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl shadow-xs space-y-2 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                              {index + 1}. {item.customerName}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                isTransfer
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                  : isCashOut
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {isTransfer ? '🔄 Wallet to Wallet' : isCashOut ? 'ငွေထုတ် (Out)' : 'ငွေသွင်း (In)'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.date} {item.time && `• ${item.time}`} {item.phone && `• ${item.phone}`}
                          </div>
                        </div>

                        {item.commission > 0 && (
                          <span className="text-xs font-black text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 shrink-0">
                            +{formatKs(item.commission)} Ks
                          </span>
                        )}
                      </div>

                      {/* Account balance changes */}
                      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
                        {isTransfer ? (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                📤 {item.walletName} (လွှဲထုတ်):
                              </span>
                              <span className="font-black text-red-600 dark:text-red-400">
                                -{formatKs(item.amount)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                📥 {item.targetWalletName || 'Wallet'} (လက်ခံ):
                              </span>
                              <span className="font-black text-indigo-700 dark:text-indigo-400">
                                +{formatKs(item.amount)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                💵 {item.cashAccountName || 'ငွေသားအကောက်'}:
                              </span>
                              <span className={`font-black ${cashDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {cashDelta >= 0 ? `+${formatKs(cashDelta)}` : formatKs(cashDelta)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                🏦 {item.walletName || 'Wallet'}:
                              </span>
                              <span className={`font-black ${walletDelta >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                                {walletDelta >= 0 ? `+${formatKs(walletDelta)}` : formatKs(walletDelta)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {item.note && (
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-700">
                          {item.note}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {sortedTransactions.length > 0 && (
                <div className="p-3 bg-slate-900 dark:bg-slate-950 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300">📊 စုစုပေါင်း ({sortedTransactions.length} ခု) Total:</span>
                    <span className="font-black text-amber-300">
                      ကော်မရှင်: +{formatKs(totalCommission)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span>ငွေသားလက်ကျန်: <b className="text-emerald-400">{formatKs(totalCashBalance)}</b></span>
                    <span>•</span>
                    <span>Walletလက်ကျန်: <b className="text-indigo-300">{formatKs(totalWalletBalance)}</b></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FULL MATRIX TABLE */}
          {viewMode === 'table' && (
            <div className="space-y-1.5">
              {/* Horizontal Scroll Hint for Mobile/Tablet */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] bg-indigo-50/90 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  <span>👉 ဘေးသို့ ဆွဲရွှေ့ပြီး ငွေသားနှင့် Wallet အကောက်များ စစ်ဆေးနိုင်ပါသည် (Swipe left/right)</span>
                </div>
                <span className="text-slate-400 font-medium text-[11px] hidden sm:inline">
                  ငွေစာရင်း {cashAccounts.length + wallets.length} ခု
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[56vh] sm:max-h-[62vh] overscroll-contain border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                <table 
                  className="w-full text-xs text-left border-collapse"
                  style={{ minWidth: `${Math.max(920, 460 + (cashAccounts.length + wallets.length) * 115)}px` }}
                >
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                    <tr className="border-b border-slate-200/80 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/90 text-[10px]">
                      <th colSpan={4} className="p-1.5 text-center text-slate-700 dark:text-slate-200 font-bold border-r border-slate-300 dark:border-slate-700">
                        📋 အရောင်းအဝယ် အချက်အလက်
                      </th>
                      <th
                        colSpan={cashAccounts.length}
                        className="p-1.5 text-center text-emerald-900 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 font-bold border-r border-slate-300 dark:border-slate-700"
                      >
                        💵 ငွေသားအကောက်များ
                      </th>
                      <th
                        colSpan={wallets.length}
                        className="p-1.5 text-center text-indigo-900 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/60 font-bold border-r border-slate-300 dark:border-slate-700"
                      >
                        🏦 Wallet အကောက်များ
                      </th>
                      <th colSpan={2} className="p-1.5 text-center text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 font-bold">
                        အခြား
                      </th>
                    </tr>
                    <tr>
                      <th className="p-2 whitespace-nowrap min-w-[44px]">စဉ်</th>
                      <th className="p-2 whitespace-nowrap min-w-[110px]">ရက်စွဲ/အချိန်</th>
                      <th className="p-2 whitespace-nowrap min-w-[130px]">ဖောက်သည်</th>
                      <th className="p-2 whitespace-nowrap min-w-[90px] border-r border-slate-300 dark:border-slate-700">အမျိုးအစား</th>

                      {/* Cash Account Columns */}
                      {cashAccounts.map((c) => (
                        <th
                          key={`th-c-${c.id}`}
                          className="p-2 text-right whitespace-nowrap bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold min-w-[110px]"
                        >
                          {c.name}
                        </th>
                      ))}

                      {/* Wallet Columns */}
                      {wallets.map((w, wIdx) => (
                        <th
                          key={`th-w-${w.id}`}
                          className={`p-2 text-right whitespace-nowrap bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 font-bold min-w-[110px] ${
                            wIdx === wallets.length - 1 ? 'border-r border-slate-300 dark:border-slate-700' : ''
                          }`}
                        >
                          {w.name}
                        </th>
                      ))}

                      <th className="p-2 text-right whitespace-nowrap bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 min-w-[100px]">ကော်မရှင်</th>
                      <th className="p-2 whitespace-nowrap min-w-[130px]">မှတ်ချက်</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sortedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6 + cashAccounts.length + wallets.length} className="p-6 text-center text-slate-400 dark:text-slate-500">
                        ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော ဒေတာ မရှိပါ။
                      </td>
                    </tr>
                  ) : (
                    sortedTransactions.map((tx, idx) => {
                      const isCashOut = tx.type === 'ထုတ်';
                      const isTransfer = tx.type === 'လွှဲပြောင်း';

                      return (
                        <tr key={`matrix-row-${tx.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-2 text-slate-500 dark:text-slate-400 font-medium">{idx + 1}</td>
                          <td className="p-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            <div>{tx.date}</div>
                            {tx.time && <div className="text-[10px] text-slate-400">{tx.time}</div>}
                          </td>
                          <td className="p-2 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{tx.customerName}</td>
                          <td className="p-2 whitespace-nowrap border-r border-slate-300 dark:border-slate-700">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isTransfer
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                  : isCashOut
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {isTransfer ? '🔄 လွှဲပြောင်း' : isCashOut ? 'ထုတ်' : 'သွင်း'}
                            </span>
                          </td>

                          {/* Cash Account Deltas */}
                          {cashAccounts.map((c) => {
                            const delta = getCashDeltaForTx(tx, c.name);
                            return (
                              <td
                                key={`td-c-${tx.id}-${c.id}`}
                                className={`p-2 text-right font-mono whitespace-nowrap ${
                                  delta > 0
                                    ? 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/20 dark:bg-emerald-950/20'
                                    : delta < 0
                                    ? 'text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20'
                                    : 'text-slate-300 dark:text-slate-600'
                                }`}
                              >
                                {delta !== 0 ? (delta > 0 ? `+${formatKs(delta)}` : formatKs(delta)) : '-'}
                              </td>
                            );
                          })}

                          {/* Wallet Deltas */}
                          {wallets.map((w, wIdx) => {
                            const delta = getWalletDeltaForTx(tx, w.name);
                            return (
                              <td
                                key={`td-w-${tx.id}-${w.id}`}
                                className={`p-2 text-right font-mono whitespace-nowrap ${
                                  wIdx === wallets.length - 1 ? 'border-r border-slate-300 dark:border-slate-700' : ''
                                } ${
                                  delta > 0
                                    ? 'text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50/20 dark:bg-indigo-950/20'
                                    : delta < 0
                                    ? 'text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20'
                                    : 'text-slate-300 dark:text-slate-600'
                                }`}
                              >
                                {delta !== 0 ? (delta > 0 ? `+${formatKs(delta)}` : formatKs(delta)) : '-'}
                              </td>
                            );
                          })}

                          <td className="p-2 text-right font-bold text-amber-800 dark:text-amber-300 bg-amber-50/40 dark:bg-amber-950/20 whitespace-nowrap">
                            {tx.commission > 0 ? `+${formatKs(tx.commission)}` : '-'}
                          </td>
                          <td className="p-2 text-slate-500 dark:text-slate-400 italic text-[11px] truncate max-w-[150px]">
                            {tx.note || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {sortedTransactions.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 sticky bottom-0 z-20 shadow-md">
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        စုစုပေါင်း Net Total:
                      </td>
                      {cashAccounts.map((c, i) => {
                        const total = cashAccountTotals[i];
                        return (
                          <td
                            key={`tf-c-${c.id}`}
                            className={`p-2.5 text-right font-mono whitespace-nowrap bg-emerald-100/50 dark:bg-emerald-950/40 ${
                              total > 0
                                ? 'text-emerald-800 dark:text-emerald-300'
                                : total < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {total !== 0 ? (total > 0 ? `+${formatKs(total)}` : formatKs(total)) : '-'}
                          </td>
                        );
                      })}
                      {wallets.map((w, wIdx) => {
                        const total = walletTotals[wIdx];
                        return (
                          <td
                            key={`tf-w-${w.id}`}
                            className={`p-2.5 text-right font-mono whitespace-nowrap bg-indigo-100/50 dark:bg-indigo-950/40 ${
                              wIdx === wallets.length - 1 ? 'border-r border-slate-300 dark:border-slate-700' : ''
                            } ${
                              total > 0
                                ? 'text-indigo-800 dark:text-indigo-300'
                                : total < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {total !== 0 ? (total > 0 ? `+${formatKs(total)}` : formatKs(total)) : '-'}
                          </td>
                        );
                      })}
                      <td className="p-2.5 text-right font-bold text-amber-900 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/50 whitespace-nowrap">
                        +{formatKs(totalCommission)}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                        ကော်မရှင်စုစုပေါင်း
                      </td>
                    </tr>
                  </tfoot>
                )}
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
