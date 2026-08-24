import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Search,
  Download,
  Printer,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
  Eye,
  Banknote,
  Wallet,
  TrendingUp,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Transaction, WalletItem, CashAccountItem } from '../types';
import { getTodayFormatted, formatKs } from '../utils/formatters';
import { PaginationControls } from './PaginationControls';

interface ReportModalProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  selectedReportDate: string;
  setSelectedReportDate: (date: string) => void;
  wallets?: WalletItem[];
  selectedWalletFilter?: string;
  setSelectedWalletFilter?: (w: string) => void;
  cashAccounts?: CashAccountItem[];
  selectedCashFilter?: string;
  setSelectedCashFilter?: (c: string) => void;
  data: Transaction[];
  onDeleteTransaction?: (id: number) => void;
  onViewReceipt?: (transaction: Transaction) => void;
}

// Helper to get actual cash amount handed out/in
export const getActualCashAmount = (item: Transaction): number => {
  if (item.type === 'လွှဲပြောင်း') {
    return 0; // E-money between wallets; cash account gets commission only
  }
  if (item.type === 'ထုတ်') {
    if (item.netPayout !== undefined) return item.netPayout;
    if (item.commissionMode === 'deduct') return Math.max(0, item.amount - item.commission);
    return item.amount;
  }
  return item.amount;
};

// Helper to get Cash Commission vs Wallet Commission
export const getCommissionBreakdown = (item: Transaction): { cashComm: number; walletComm: number } => {
  const comm = item.commission || 0;
  if (item.commissionChannel === 'Wallet') {
    return { cashComm: 0, walletComm: comm };
  }
  if (item.commissionChannel === 'Cash') {
    return { cashComm: comm, walletComm: 0 };
  }
  if (item.type === 'ထုတ်' && item.commissionMode === 'deduct') {
    return { cashComm: 0, walletComm: comm };
  }
  return { cashComm: comm, walletComm: 0 };
};

export const ReportModal: React.FC<ReportModalProps> = ({
  title,
  icon,
  onClose,
  selectedReportDate,
  setSelectedReportDate,
  wallets,
  selectedWalletFilter = 'all',
  setSelectedWalletFilter,
  cashAccounts,
  selectedCashFilter = 'all',
  setSelectedCashFilter,
  data,
  onDeleteTransaction,
  onViewReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [showSummaryChips, setShowSummaryChips] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const todayStr = getTodayFormatted();

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedReportDate, selectedWalletFilter, selectedCashFilter, searchQuery]);

  // Filter with date, wallet filter, cash filter, and search query
  const filteredData = data.filter((item) => {
    // 1. Date Filter
    if (selectedReportDate !== 'ALL' && item.date !== selectedReportDate) {
      return false;
    }

    // 2. Wallet Filter (All / None / Specific)
    if (selectedWalletFilter === 'none') {
      if (item.walletName && item.walletName !== 'None' && item.walletName !== '-') {
        return false;
      }
    } else if (selectedWalletFilter !== 'all') {
      if (item.walletName !== selectedWalletFilter && item.targetWalletName !== selectedWalletFilter) {
        return false;
      }
    }

    // 3. Cash Account Filter (All / None / Specific)
    if (selectedCashFilter === 'none') {
      if (item.cashAccountName && item.cashAccountName !== 'None' && item.cashAccountName !== '-') {
        return false;
      }
    } else if (selectedCashFilter !== 'all') {
      if (item.cashAccountName !== selectedCashFilter) return false;
    }

    // 4. Search Query Filter
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(query) ||
      item.phone.toLowerCase().includes(query) ||
      item.walletName.toLowerCase().includes(query) ||
      (item.targetWalletName && item.targetWalletName.toLowerCase().includes(query)) ||
      (item.cashAccountName && item.cashAccountName.toLowerCase().includes(query)) ||
      (item.note && item.note.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  // Calculate actual cash flows
  const totalIn = filteredData
    .filter((t) => t.type === 'သွင်း')
    .reduce((sum, item) => sum + getActualCashAmount(item), 0);

  const totalOut = filteredData
    .filter((t) => t.type === 'ထုတ်')
    .reduce((sum, item) => sum + getActualCashAmount(item), 0);

  const totalTransferVolume = filteredData
    .filter((t) => t.type === 'လွှဲပြောင်း')
    .reduce((sum, item) => sum + item.amount, 0);

  const netAmount = totalIn - totalOut;

  // Calculate Cash Commission vs Wallet Commission vs Total Commission
  const totalCashComm = filteredData.reduce((sum, item) => sum + getCommissionBreakdown(item).cashComm, 0);
  const totalWalletComm = filteredData.reduce((sum, item) => sum + getCommissionBreakdown(item).walletComm, 0);
  const grandTotalComm = totalCashComm + totalWalletComm;

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert('ဒေါင်းလုဒ်ဆွဲရန် ဒေတာ မရှိပါ။');
      return;
    }
    const headers = [
      'စဉ်,နေ့စွဲ,အချိန်,ဖောက်သည်အမည်,အမျိုးအစား,လက်ငင်းပေး/ရငွေ(Ks),မူလလွှဲငွေ(Ks),လက်ငင်းကော်မရှင်(Ks),Walletကော်မရှင်(Ks),ကော်မရှင်စုစုပေါင်း(Ks),ကော်မရှင်ပုံစံ,ဖုန်း,Wallet/လွှဲထုတ်,လက်ခံWallet,ငွေသားအကောင့်,မှတ်ချက်',
    ];
    const rows = filteredData.map((d, index) => {
      const actualCash = getActualCashAmount(d);
      const { cashComm, walletComm } = getCommissionBreakdown(d);
      const isCashOut = d.type === 'ထုတ်';
      const isTransfer = d.type === 'လွှဲပြောင်း';
      const commModeLabel = isTransfer
        ? 'Wallet လွှဲပြောင်း (ငွေသား ကော်မရှင်)'
        : isCashOut
        ? d.commissionMode === 'deduct'
          ? 'မူလငွေမှ နုတ်ယူ (Wallet ကော်မရှင်)'
          : 'သက်သက်ပေး (ငွေသား ကော်မရှင်)'
        : 'ငွေသား ကော်မရှင်';

      return [
        index + 1,
        `"${d.date}"`,
        `"${d.time || '-'}"`,
        `"${d.customerName}"`,
        `"${d.type}"`,
        actualCash,
        d.amount,
        cashComm,
        walletComm,
        d.commission,
        `"${commModeLabel}"`,
        `"${d.phone}"`,
        `"${d.walletName}"`,
        `"${d.targetWalletName || '-'}"`,
        `"${d.cashAccountName || '-'}"`,
        `"${d.note || '-'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `commission_report_${selectedReportDate}_${Date.now()}.csv`);
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
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon ? (
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">{icon}</div>
            ) : (
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-800 dark:text-slate-100 truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                စာရင်းပေါင်း: <span className="font-bold text-slate-700 dark:text-slate-200">{filteredData.length}</span> ခု
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
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
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="ဇယားပုံစံ (Table View)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">ဇယား</span>
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="CSV ဒေါင်းလုဒ်"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Print ထုတ်မည်"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 pr-0.5 space-y-3">
          {/* Filter Controls Bar */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            {/* Date Picker */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={selectedReportDate === 'ALL' ? todayStr : selectedReportDate}
                onChange={(e) => setSelectedReportDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            {/* Quick Date Buttons */}
            <button
              onClick={() => setSelectedReportDate(todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedReportDate === todayStr
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ယနေ့
            </button>

            <button
              onClick={() => setSelectedReportDate('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedReportDate === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              အားလုံး (All)
            </button>

            {/* Wallet Filter Dropdown */}
            {wallets && setSelectedWalletFilter && (
              <div className="flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                <select
                  value={selectedWalletFilter}
                  onChange={(e) => setSelectedWalletFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none max-w-[130px]"
                >
                  <option value="all">Wallet အားလုံး</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cash Account Filter Dropdown */}
            {cashAccounts && setSelectedCashFilter && (
              <div className="flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <select
                  value={selectedCashFilter}
                  onChange={(e) => setSelectedCashFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none max-w-[130px]"
                >
                  <option value="all">ငွေသား အားလုံး</option>
                  {cashAccounts.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="flex-1 min-w-[140px] relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="အမည်၊ ဖုန်း၊ အကောင့် ရှာရန်..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="text-[11px] font-bold text-slate-700">📊 ငွေကြေးစီးဆင်းမှု နှင့် ကော်မရှင် အကျဉ်းချုပ်</span>
              <button
                onClick={() => setShowSummaryChips(!showSummaryChips)}
                className="text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                {showSummaryChips ? 'ဖျောက်မည်' : 'ကြည့်မည်'}
                {showSummaryChips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSummaryChips && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                <div className="p-2 bg-emerald-50/90 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">ငွေသွင်း (In)</span>
                  <div className="text-xs sm:text-sm font-black text-emerald-700 truncate">+{formatKs(totalIn)}</div>
                </div>

                <div className="p-2 bg-red-50/90 border border-red-200 rounded-lg">
                  <span className="text-[10px] font-bold text-red-800 uppercase block">ငွေထုတ် (Out)</span>
                  <div className="text-xs sm:text-sm font-black text-red-700 truncate">-{formatKs(totalOut)}</div>
                </div>

                <div className="p-2 bg-sky-50/90 border border-sky-200 rounded-lg">
                  <span className="text-[10px] font-bold text-sky-800 uppercase block truncate">🔄 Wallet လွှဲပြောင်း</span>
                  <div className="text-xs sm:text-sm font-black text-sky-700 truncate">{formatKs(totalTransferVolume)}</div>
                </div>

                <div className="p-2 bg-amber-50/90 border border-amber-200 rounded-lg">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block truncate">💵 ကော်မရှင် ငွေသား</span>
                  <div className="text-xs sm:text-sm font-black text-amber-800 truncate">+{formatKs(totalCashComm)}</div>
                </div>

                <div className="p-2 bg-purple-50/90 border border-purple-200 rounded-lg">
                  <span className="text-[10px] font-bold text-purple-800 uppercase block truncate">📱 ကော်မရှင် Wallet</span>
                  <div className="text-xs sm:text-sm font-black text-purple-800 truncate">+{formatKs(totalWalletComm)}</div>
                </div>

                <div className="p-2 bg-indigo-50/90 border border-indigo-300 rounded-lg shadow-xs">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase block truncate">📈 ကော်မရှင် စုစုပေါင်း</span>
                  <div className="text-xs sm:text-sm font-black text-indigo-700 truncate">+{formatKs(grandTotalComm)}</div>
                </div>
              </div>
            )}
          </div>

          {/* VIEW 1: RESPONSIVE CARDS VIEW */}
          {viewMode === 'card' && (
            <div className="space-y-2.5">
              {filteredData.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 font-medium text-xs">
                  ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော ဒေတာ မရှိပါ။
                </div>
              ) : (
                pagedData.map((item, index) => {
                  const globalIndex = (page - 1) * pageSize + index;
                  const isCashOut = item.type === 'ထုတ်';
                  const isTransfer = item.type === 'လွှဲပြောင်း';
                  const actualCash = getActualCashAmount(item);
                  const { cashComm, walletComm } = getCommissionBreakdown(item);

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-xs space-y-2 transition-all"
                    >
                      {/* Top row: Customer Name, Type badge, and Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {globalIndex + 1}. {item.customerName}
                            </span>
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                isTransfer
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : isCashOut
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isTransfer ? (
                                <ArrowLeftRight className="w-3 h-3" />
                              ) : isCashOut ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {item.type}
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
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
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

                      {/* Middle row: Amounts & Commissions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            {isTransfer ? 'လွှဲပြောင်းငွေ:' : 'လက်ငင်းငွေ:'}
                          </span>
                          <span
                            className={`font-black ${
                              isTransfer
                                ? 'text-sky-700'
                                : isCashOut
                                ? 'text-red-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {isTransfer
                              ? formatKs(item.amount)
                              : isCashOut
                              ? `- ${actualCash.toLocaleString()} Ks`
                              : `+ ${actualCash.toLocaleString()} Ks`}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            {isTransfer ? 'ဝန်ဆောင်ခ/လွှဲခ:' : 'မူလလွှဲငွေ:'}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {isTransfer ? `+${formatKs(item.commission)}` : `${item.amount.toLocaleString()} Ks`}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-amber-800 font-bold block">💵 ငွေသားကော်မရှင်:</span>
                          <span className="font-bold text-amber-800">
                            {cashComm > 0 ? `+${cashComm.toLocaleString()} Ks` : '-'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-purple-800 font-bold block">📱 Walletကော်မရှင်:</span>
                          <span className="font-bold text-purple-800">
                            {walletComm > 0 ? `+${walletComm.toLocaleString()} Ks` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Accounts Used & Note */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          {isTransfer ? (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded font-semibold flex items-center gap-1">
                              🔄 <b>{item.walletName}</b> ➔ <b>{item.targetWalletName || '-'}</b>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-semibold">
                              🏦 {item.walletName}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
                            💵 {item.cashAccountName || 'ဆိုင်ရှေ့ငွေပုံး'}
                          </span>
                        </div>
                        {item.note && (
                          <span className="text-slate-400 italic text-[10px] truncate max-w-[200px]">
                            {item.note}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {filteredData.length > 0 && (
                <div className="p-3 bg-slate-900 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-300">📊 စုစုပေါင်း ({filteredData.length} ခု) Total:</span>
                    <span className={`font-black ${netAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {netAmount >= 0 ? `+${formatKs(netAmount)}` : `-${formatKs(Math.abs(netAmount))}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-300 font-bold">💵 ငွေသား: +{formatKs(totalCashComm)}</span>
                    <span className="text-purple-300 font-bold">📱 Wallet: +{formatKs(totalWalletComm)}</span>
                    <span className="text-emerald-300 font-black bg-white/10 px-2 py-0.5 rounded-lg border border-white/20">
                      စုစုပေါင်း ကော်မရှင်: +{formatKs(grandTotalComm)}
                    </span>
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {filteredData.length > 0 && (
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={filteredData.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          )}

          {/* VIEW 2: FULL TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="space-y-2">
              {/* Horizontal Scroll Hint for Mobile/Tablet */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-[11px] bg-indigo-50/90 px-2.5 py-1 rounded-lg border border-indigo-100">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  <span>👉 ဘေးသို့ ဆွဲရွှေ့ပြီး ဇယားအပြည့်အစုံ ကြည့်ရှုနိုင်ပါသည် (Swipe left/right to view full table)</span>
                </div>
                <span className="text-slate-400 font-medium text-[11px] hidden sm:inline">
                  စုစုပေါင်း: {filteredData.length} ခု
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[56vh] sm:max-h-[62vh] overscroll-contain border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-xs text-left border-collapse min-w-[880px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                    <tr>
                      <th className="p-2.5 whitespace-nowrap min-w-[48px]">စဉ်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[120px]">နေ့စွဲ/အချိန်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px]">ဖောက်သည် အမည်</th>
                      <th className="p-2.5 text-center whitespace-nowrap min-w-[90px]">အမျိုးအစား</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[130px]">လက်ငင်း/လွှဲငွေ (Ks)</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[110px]">မူလလွှဲငွေ (Ks)</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[120px] bg-amber-50/70 text-amber-900">
                        💵 ငွေသားကော်မရှင်
                      </th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[120px] bg-purple-50/70 text-purple-900">
                        📱 Walletကော်မရှင်
                      </th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px]">Wallet အကောင့်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[120px]">ငွေသား အကောင့်</th>
                      <th className="p-2.5 text-center whitespace-nowrap min-w-[90px]">လုပ်ဆောင်ချက်</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-400 font-medium">
                        ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော ဒေတာ မရှိပါ။
                      </td>
                    </tr>
                  ) : (
                    pagedData.map((item, index) => {
                      const globalIndex = (page - 1) * pageSize + index;
                      const isCashOut = item.type === 'ထုတ်';
                      const isTransfer = item.type === 'လွှဲပြောင်း';
                      const actualCash = getActualCashAmount(item);
                      const { cashComm, walletComm } = getCommissionBreakdown(item);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-slate-500 font-medium">{globalIndex + 1}</td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{item.date}</div>
                            {item.time && <div className="text-[10px] text-slate-400">{item.time}</div>}
                          </td>
                          <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                            {item.customerName}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isTransfer
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : isCashOut
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>

                          {/* Actual Cash / Transfer */}
                          <td
                            className={`p-2.5 text-right font-bold whitespace-nowrap ${
                              isTransfer
                                ? 'text-sky-700'
                                : isCashOut
                                ? 'text-red-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {isTransfer
                              ? formatKs(item.amount)
                              : isCashOut
                              ? `- ${actualCash.toLocaleString()} Ks`
                              : `${actualCash.toLocaleString()} Ks`}
                          </td>

                          {/* Original Amount */}
                          <td className="p-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            {item.amount.toLocaleString()} Ks
                          </td>

                          {/* Cash Commission */}
                          <td className="p-2.5 text-right font-bold whitespace-nowrap bg-amber-50/30 text-amber-800">
                            {cashComm > 0 ? `+${cashComm.toLocaleString()} Ks` : '-'}
                          </td>

                          {/* Wallet Commission */}
                          <td className="p-2.5 text-right font-bold whitespace-nowrap bg-purple-50/30 text-purple-800">
                            {walletComm > 0 ? `+${walletComm.toLocaleString()} Ks` : '-'}
                          </td>

                          <td className="p-2.5 text-slate-700 whitespace-nowrap">
                            {isTransfer ? (
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded font-semibold text-[10px]">
                                {item.walletName} ➔ {item.targetWalletName || '-'}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-semibold text-[10px]">
                                {item.walletName}
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 text-slate-700 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold text-[10px]">
                              {item.cashAccountName || 'ဆိုင်ရှေ့ငွေပုံး'}
                            </span>
                          </td>

                          <td className="p-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {onViewReceipt && (
                                <button
                                  onClick={() => onViewReceipt(item)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="ဘောက်ချာ"
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
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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

                {filteredData.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 sticky bottom-0 z-20 shadow-md">
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right font-bold text-slate-900">
                        စုစုပေါင်း Total:
                      </td>
                      <td
                        className={`p-2.5 text-right whitespace-nowrap ${
                          netAmount >= 0 ? 'text-indigo-700' : 'text-red-600'
                        }`}
                      >
                        {netAmount >= 0 ? `+${formatKs(netAmount)}` : `-${formatKs(Math.abs(netAmount))}`}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap text-slate-600">-</td>
                      <td className="p-2.5 text-right whitespace-nowrap text-amber-800 bg-amber-100/50">
                        +{formatKs(totalCashComm)}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap text-purple-800 bg-purple-100/50">
                        +{formatKs(totalWalletComm)}
                      </td>
                      <td colSpan={3} className="p-2.5 whitespace-nowrap text-indigo-900">
                        👉 စုစုပေါင်း ကော်မရှင်: <b>+{formatKs(grandTotalComm)}</b>
                      </td>
                    </tr>
                  </tfoot>
                )}
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredData.length > 0 && (
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  totalCount={filteredData.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
