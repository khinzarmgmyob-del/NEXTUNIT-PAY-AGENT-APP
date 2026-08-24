import React, { useState } from 'react';
import {
  X,
  Calendar,
  Search,
  Download,
  Printer,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
} from 'lucide-react';
import { Transaction, WalletItem, ShopProfile } from '../types';
import { getTodayFormatted, formatKs } from '../utils/formatters';

interface WalletReconcileModalProps {
  onClose: () => void;
  wallets: WalletItem[];
  transactions: Transaction[];
  shopProfile?: ShopProfile;
  selectedReportDate: string;
  setSelectedReportDate: (date: string) => void;
  onDeleteTransaction?: (id: number) => void;
  onViewReceipt?: (transaction: Transaction) => void;
}

export const WalletReconcileModal: React.FC<WalletReconcileModalProps> = ({
  onClose,
  wallets,
  transactions,
  shopProfile,
  selectedReportDate,
  setSelectedReportDate,
  onDeleteTransaction,
  onViewReceipt,
}) => {
  const [selectedWalletAccountFilter, setSelectedWalletAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [showSummaryChips, setShowSummaryChips] = useState(true);
  const todayStr = getTodayFormatted();

  // Helper to compute wallet inflow (+) or outflow (-) for a transaction
  const getWalletFlow = (tx: Transaction, targetFilter: string) => {
    if (tx.type === 'ထုတ်') {
      // Cash Out: customer sends e-money to shop wallet => Wallet IN (+)
      return {
        direction: 'in' as const,
        amount: tx.amount,
        commission: tx.commission || 0,
      };
    }
    if (tx.type === 'သွင်း') {
      // Cash In: shop sends e-money from wallet to customer => Wallet OUT (-)
      return {
        direction: 'out' as const,
        amount: tx.amount,
        commission: tx.commission || 0,
      };
    }
    if (tx.type === 'လွှဲပြောင်း') {
      // Wallet to Wallet transfer
      if (targetFilter !== 'all') {
        if (tx.targetWalletName === targetFilter) {
          return {
            direction: 'in' as const,
            amount: tx.amount,
            commission: tx.commission || 0,
          };
        }
        if (tx.walletName === targetFilter) {
          return {
            direction: 'out' as const,
            amount: tx.amount,
            commission: tx.commission || 0,
          };
        }
      }
      return {
        direction: 'transfer' as const,
        amount: tx.amount,
        commission: tx.commission || 0,
      };
    }
    return {
      direction: 'neutral' as const,
      amount: 0,
      commission: tx.commission || 0,
    };
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((item) => {
    // 1. Date Filter
    if (selectedReportDate !== 'ALL' && item.date !== selectedReportDate) {
      return false;
    }

    // 2. Wallet Account Filter ONLY (No Cash Filter)
    if (selectedWalletAccountFilter !== 'all') {
      if (item.walletName !== selectedWalletAccountFilter && item.targetWalletName !== selectedWalletAccountFilter) {
        return false;
      }
    }

    // 3. Search Query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      (item.walletName && item.walletName.toLowerCase().includes(q)) ||
      (item.targetWalletName && item.targetWalletName.toLowerCase().includes(q)) ||
      (item.cashAccountName && item.cashAccountName.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      item.amount.toString().includes(q)
    );
  });

  // Sort chronological
  const sortedTransactions = [...filteredTransactions].sort((a, b) => b.id - a.id);

  // Calculate totals
  let totalWalletIn = 0;
  let totalWalletOut = 0;
  let totalCommissionEarned = 0;

  filteredTransactions.forEach((tx) => {
    const flow = getWalletFlow(tx, selectedWalletAccountFilter);
    if (flow.direction === 'in') {
      totalWalletIn += flow.amount;
    } else if (flow.direction === 'out') {
      totalWalletOut += flow.amount;
    }
    totalCommissionEarned += tx.commission || 0;
  });

  const netWalletAmount = totalWalletIn - totalWalletOut;

  // Export CSV
  const handleExportCSV = () => {
    if (sortedTransactions.length === 0) {
      alert('ဒေါင်းလုဒ်ဆွဲရန် ဒေတာ မရှိပါ။');
      return;
    }

    const headers = [
      'စဉ်',
      'နေ့စွဲ',
      'အချိန်',
      'ဖောက်သည်',
      'ဖုန်းနံပါတ်',
      'Wallet အကောက်',
      'ငွေအမောက်/စီးဆင်းမှု',
      'ဝင်/ထွက် ပုံစံ',
      'ကော်မရှင်ရငွေ (Ks)',
      'ငွေသားအကောက်',
      'မှတ်ချက်',
    ].join(',');

    const rows = sortedTransactions.map((tx, idx) => {
      const flow = getWalletFlow(tx, selectedWalletAccountFilter);
      const sign = flow.direction === 'in' ? '+' : flow.direction === 'out' ? '-' : '';
      const dirText = flow.direction === 'in' ? 'Wallet ဝင် (+)' : flow.direction === 'out' ? 'Wallet ထွက် (-)' : 'Wallet လွှဲပြောင်း';

      return [
        idx + 1,
        `"${tx.date}"`,
        `"${tx.time || '-'}"`,
        `"${tx.customerName}"`,
        `"${tx.phone}"`,
        `"${tx.walletName || '-'}"`,
        `"${sign}${flow.amount}"`,
        `"${dirText}"`,
        tx.commission || 0,
        `"${tx.cashAccountName || '-'}"`,
        `"${tx.note || '-'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wallet_reconcile_report_${selectedReportDate}_${Date.now()}.csv`);
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
        className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-5 md:p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                🏦 Wallet Reconcile စာရင်း (Wallet Reconcile)
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                Wallet များ၏ ဝင်ငွေ (+)၊ ထွက်ငွေ (-) နှင့် အသားတင် Net Amount ရှင်းတမ်း
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
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
                <span className="hidden sm:inline text-[11px]">ဇယား</span>
              </button>
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
                <span className="hidden sm:inline text-[11px]">Card</span>
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

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1 pr-0.5 space-y-3">
          {/* Summary Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-xl p-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                📊 Wallet စီးဆင်းမှု နှင့် Net Amount အကျဉ်းချုပ်
              </span>
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
                    <ArrowDownRight className="w-3 h-3" />
                    Wallet ဝင်ငွေပေါင်း (+)
                  </div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    +{formatKs(totalWalletIn)}
                  </div>
                </div>

                <div className="p-2.5 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
                  <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    Wallet ထွက်ငွေပေါင်း (-)
                  </div>
                  <div className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    -{formatKs(totalWalletOut)}
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    📈 ကော်မရှင် စုစုပေါင်း
                  </div>
                  <div className="text-sm sm:text-base font-black text-amber-800 dark:text-amber-400 mt-0.5">
                    +{formatKs(totalCommissionEarned)}
                  </div>
                </div>

                <div className="p-2.5 bg-gradient-to-tr from-indigo-900 to-indigo-800 dark:from-indigo-950 dark:to-indigo-900 text-white rounded-xl shadow-xs border border-indigo-700">
                  <div className="text-[10px] font-bold text-indigo-200">
                    🌐 အသားတင် Wallet Net Amount
                  </div>
                  <div className={`text-sm sm:text-base font-black mt-0.5 ${netWalletAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netWalletAmount >= 0 ? `+${formatKs(netWalletAmount)}` : `-${formatKs(Math.abs(netWalletAmount))}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Bar (Date + Wallet Account Filter ONLY) */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
            {/* Date Picker */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <input
                type="date"
                value={selectedReportDate === 'ALL' ? todayStr : selectedReportDate}
                onChange={(e) => setSelectedReportDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            {/* Quick Date Buttons */}
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

            {/* Wallet Account Filter ONLY */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">🏦 Wallet အကောက်:</span>
              <select
                value={selectedWalletAccountFilter}
                onChange={(e) => setSelectedWalletAccountFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none max-w-[160px]"
              >
                <option value="all">Wallet အကောက် အားလုံး</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ဖောက်သည်၊ ဖုန်း၊ Wallet၊ မှတ်ချက် ရှာရန်..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* VIEW 1: FULL TABLE VIEW (Natural Touch Scrolling) */}
          {viewMode === 'table' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] bg-indigo-50/90 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  <span>👉 ဘေးသို့ဆွဲပြီး ဇယားအပြည့်ကြည့်နိုင်ပါသည်။ အပေါ်အောက် တိုက်ရိုက်ဆွဲရွှေ့နိုင်ပါသည်။</span>
                </div>
                <span className="text-slate-400 font-medium text-[11px] hidden sm:inline">
                  စာရင်းပေါင်း: {sortedTransactions.length} ခု
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[58vh] sm:max-h-[64vh] overscroll-contain border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                    <tr>
                      <th className="p-2.5 whitespace-nowrap min-w-[44px]">စဉ်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[110px]">နေ့စွဲ / အချိန်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px]">ဖောက်သည်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[110px]">ဖုန်းနံပါတ်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px] bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300">
                        🏦 Wallet အကောက်
                      </th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[130px]">
                        ငွေအမောက် / စီးဆင်းမှု
                      </th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[100px] bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">
                        ကော်မရှင်ရငွေ
                      </th>
                      <th className="p-2.5 whitespace-nowrap min-w-[120px]">ငွေသားအကောက်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[140px]">မှတ်ချက်</th>
                      <th className="p-2.5 text-center whitespace-nowrap min-w-[80px]">လုပ်ဆောင်ချက်</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sortedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                          ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော Wallet စာရင်း မရှိပါ။
                        </td>
                      </tr>
                    ) : (
                      sortedTransactions.map((item, index) => {
                        const flow = getWalletFlow(item, selectedWalletAccountFilter);
                        const isWalletIn = flow.direction === 'in';
                        const isWalletOut = flow.direction === 'out';
                        const isTransfer = flow.direction === 'transfer';

                        return (
                          <tr key={`wallet-rec-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">{index + 1}</td>
                            <td className="p-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                              <div className="font-semibold text-slate-800 dark:text-slate-100">{item.date}</div>
                              {item.time && <div className="text-[10px] text-slate-400">{item.time}</div>}
                            </td>
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {item.customerName}
                            </td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                              {item.phone || '-'}
                            </td>
                            <td className="p-2.5 font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 whitespace-nowrap">
                              {item.type === 'လွှဲပြောင်း'
                                ? `${item.walletName} ➔ ${item.targetWalletName || '-'}`
                                : item.walletName || '-'}
                            </td>

                            {/* Inflow (+) Green / Outflow (-) Red */}
                            <td className="p-2.5 text-right font-black font-mono whitespace-nowrap">
                              {isWalletIn ? (
                                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                                  +{formatKs(flow.amount)}
                                </span>
                              ) : isWalletOut ? (
                                <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-0.5">
                                  -{formatKs(flow.amount)}
                                </span>
                              ) : isTransfer ? (
                                <span className="text-sky-600 dark:text-sky-400 inline-flex items-center gap-0.5">
                                  🔄 {formatKs(flow.amount)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Commission */}
                            <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/20 whitespace-nowrap">
                              {item.commission > 0 ? `+${formatKs(item.commission)}` : '-'}
                            </td>

                            {/* Cash Account */}
                            <td className="p-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {item.cashAccountName || '-'}
                            </td>

                            {/* Note */}
                            <td className="p-2.5 text-slate-500 dark:text-slate-400 italic text-[11px] truncate max-w-[160px]">
                              {item.note || '-'}
                            </td>

                            {/* Action */}
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {onViewReceipt && (
                                  <button
                                    onClick={() => onViewReceipt(item)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors cursor-pointer"
                                    title="ဘောက်ချာ ကြည့်မည်"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteTransaction && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`ဖောက်သည် '${item.customerName}' ၏ စာရင်းကို ဖျက်ရန် သေချာပါသလား?`)) {
                                        onDeleteTransaction(item.id);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors cursor-pointer"
                                    title="ဖျက်မည်"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {sortedTransactions.length > 0 && (
                    <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 sticky bottom-0 z-20 shadow-md">
                      <tr>
                        <td colSpan={5} className="p-2.5 text-right font-black text-slate-900 dark:text-slate-100">
                          စုစုပေါင်း (Total Summary):
                        </td>
                        <td className="p-2.5 text-right font-black font-mono whitespace-nowrap">
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            ဝင်: +{formatKs(totalWalletIn)}
                          </div>
                          <div className="text-[10px] text-rose-600 dark:text-rose-400">
                            ထွက်: -{formatKs(totalWalletOut)}
                          </div>
                          <div className={`text-xs pt-0.5 border-t border-slate-300 dark:border-slate-600 font-black ${netWalletAmount >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            Net: {netWalletAmount >= 0 ? `+${formatKs(netWalletAmount)}` : `-${formatKs(Math.abs(netWalletAmount))}`}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-black text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/40 whitespace-nowrap">
                          +{formatKs(totalCommissionEarned)}
                        </td>
                        <td colSpan={3} className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          Wallet စာရင်း စုစုပေါင်း အသားတင် ရှင်းတမ်း
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: RESPONSIVE CARDS VIEW */}
          {viewMode === 'card' && (
            <div className="space-y-2.5">
              {sortedTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-xs">
                  ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော ဒေတာ မရှိပါ။
                </div>
              ) : (
                sortedTransactions.map((item, index) => {
                  const flow = getWalletFlow(item, selectedWalletAccountFilter);
                  const isWalletIn = flow.direction === 'in';
                  const isWalletOut = flow.direction === 'out';
                  const isTransfer = flow.direction === 'transfer';

                  return (
                    <div
                      key={`card-wallet-rec-${item.id}`}
                      className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl shadow-xs space-y-2 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                              {index + 1}. {item.customerName}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isWalletIn
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : isWalletOut
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              }`}
                            >
                              {isWalletIn ? 'Wallet ဝင် (+)' : isWalletOut ? 'Wallet ထွက် (-)' : 'Wallet လွှဲပြောင်း'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.date} {item.time && `• ${item.time}`} {item.phone && `• ${item.phone}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onViewReceipt && (
                            <button
                              onClick={() => onViewReceipt(item)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              ဘောက်ချာ
                            </button>
                          )}
                          {onDeleteTransaction && (
                            <button
                              onClick={() => {
                                if (confirm(`ဖောက်သည် '${item.customerName}' ၏ စာရင်းကို ဖျက်ရန် သေချာပါသလား?`)) {
                                  onDeleteTransaction(item.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Wallet:</span>
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            {item.type === 'လွှဲပြောင်း'
                              ? `${item.walletName} ➔ ${item.targetWalletName || '-'}`
                              : item.walletName || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">စီးဆင်းငွေ:</span>
                          <span className={`font-black font-mono ${isWalletIn ? 'text-emerald-600 dark:text-emerald-400' : isWalletOut ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}`}>
                            {isWalletIn ? `+${formatKs(flow.amount)}` : isWalletOut ? `-${formatKs(flow.amount)}` : `🔄 ${formatKs(flow.amount)}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">ကော်မရှင်:</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">+{formatKs(item.commission)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">ငွေသားအကောက်:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{item.cashAccountName || '-'}</span>
                        </div>
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
                    <span className={`font-black ${netWalletAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Net: {netWalletAmount >= 0 ? `+${formatKs(netWalletAmount)}` : `-${formatKs(Math.abs(netWalletAmount))}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-300 font-bold">ဝင်: +{formatKs(totalWalletIn)}</span>
                    <span className="text-rose-300 font-bold">ထွက်: -{formatKs(totalWalletOut)}</span>
                    <span className="text-amber-300 font-bold">ကော်မရှင်: +{formatKs(totalCommissionEarned)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
