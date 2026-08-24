import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Download,
  Printer,
  Banknote,
  Wallet,
  TrendingUp,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Transaction, WalletItem, CashAccountItem, ShopProfile } from '../types';
import { formatKs, getTodayFormatted } from '../utils/formatters';

interface MonthlyCashWalletFlowReportModalProps {
  onClose: () => void;
  wallets: WalletItem[];
  cashAccounts: CashAccountItem[];
  transactions: Transaction[];
  shopProfile?: ShopProfile;
}

interface DailyAccountFlow {
  in: number;
  out: number;
}

interface DailyRowData {
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // DD-MM-YY
  cashFlows: { [cashAccountName: string]: DailyAccountFlow };
  walletFlows: { [walletName: string]: DailyAccountFlow };
  totalIn: number;
  totalOut: number;
  netFlow: number;
}

export const MonthlyCashWalletFlowReportModal: React.FC<MonthlyCashWalletFlowReportModalProps> = ({
  onClose,
  wallets,
  cashAccounts,
  transactions,
  shopProfile,
}) => {
  const todayStr = getTodayFormatted(); // e.g. 2026-08-23
  const defaultMonth = todayStr.substring(0, 7); // e.g. 2026-08

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState<boolean>(true);

  // Quick next / previous month handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevM);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextM);
  };

  // Generate an extensive list of past, current and future months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(selectedMonth);
    monthsSet.add(defaultMonth);

    // Collect from transactions
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthsSet.add(tx.date.substring(0, 7));
      }
    });

    // Populate recent 3 years and next 2 years
    const currentYear = parseInt(defaultMonth.substring(0, 4), 10) || 2026;
    for (let yr = currentYear - 2; yr <= currentYear + 2; yr++) {
      for (let m = 1; m <= 12; m++) {
        monthsSet.add(`${yr}-${String(m).padStart(2, '0')}`);
      }
    }

    return Array.from(monthsSet).sort().reverse();
  }, [transactions, defaultMonth, selectedMonth]);

  // Compute daily rows for selected month
  const { dailyRows, grandTotals, cashNames, walletNames } = useMemo(() => {
    // Collect active cash account names and wallet names
    const activeCashNames = cashAccounts.map((c) => c.name);
    const activeWalletNames = wallets.map((w) => w.name);

    // Also include any cash or wallet name from transactions in this month if not in current list
    transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(selectedMonth)) {
        if (tx.cashAccountName && !activeCashNames.includes(tx.cashAccountName) && tx.cashAccountName !== '-' && tx.cashAccountName !== 'None') {
          activeCashNames.push(tx.cashAccountName);
        }
        if (tx.walletName && !activeWalletNames.includes(tx.walletName) && tx.walletName !== '-' && tx.walletName !== 'None') {
          activeWalletNames.push(tx.walletName);
        }
        if (tx.targetWalletName && !activeWalletNames.includes(tx.targetWalletName) && tx.targetWalletName !== '-' && tx.targetWalletName !== 'None') {
          activeWalletNames.push(tx.targetWalletName);
        }
      }
    });

    // Determine days to display
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Map of date string (YYYY-MM-DD) to transactions
    const dateTxMap: { [dateStr: string]: Transaction[] } = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dateTxMap[dStr] = [];
    }

    transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(selectedMonth)) {
        if (!dateTxMap[tx.date]) {
          dateTxMap[tx.date] = [];
        }
        dateTxMap[tx.date].push(tx);
      }
    });

    const rows: DailyRowData[] = [];

    // Grand totals accumulators
    const grandTotals = {
      cash: {} as { [name: string]: { in: number; out: number } },
      wallets: {} as { [name: string]: { in: number; out: number } },
      totalIn: 0,
      totalOut: 0,
      netFlow: 0,
    };

    activeCashNames.forEach((c) => {
      grandTotals.cash[c] = { in: 0, out: 0 };
    });
    activeWalletNames.forEach((w) => {
      grandTotals.wallets[w] = { in: 0, out: 0 };
    });

    // Iterate through all days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTxs = dateTxMap[dateStr] || [];

      // Format date like 01-08-26
      const yrShort = yearStr.length === 4 ? yearStr.substring(2) : yearStr;
      const displayDate = `${String(d).padStart(2, '0')}-${String(month).padStart(2, '0')}-${yrShort}`;

      const cashFlows: { [name: string]: DailyAccountFlow } = {};
      const walletFlows: { [name: string]: DailyAccountFlow } = {};

      activeCashNames.forEach((c) => {
        cashFlows[c] = { in: 0, out: 0 };
      });
      activeWalletNames.forEach((w) => {
        walletFlows[w] = { in: 0, out: 0 };
      });

      let dayTotalIn = 0;
      let dayTotalOut = 0;

      dayTxs.forEach((tx) => {
        // --- 1. CASH FLOWS ---
        if (tx.cashAccountName && cashFlows[tx.cashAccountName]) {
          if (tx.type === 'သွင်း') {
            // Customer gives physical cash to shop
            const commCash =
              tx.commissionChannel === 'Cash'
                ? tx.commission || 0
                : tx.commissionMode !== 'deduct'
                ? tx.commission || 0
                : 0;
            const inAmt = tx.amount + commCash;
            cashFlows[tx.cashAccountName].in += inAmt;
            dayTotalIn += inAmt;
          } else if (tx.type === 'ထုတ်') {
            // Shop pays physical cash to customer
            const actualPayout =
              tx.netPayout !== undefined
                ? tx.netPayout
                : tx.commissionMode === 'deduct'
                ? Math.max(0, tx.amount - (tx.commission || 0))
                : tx.amount;
            cashFlows[tx.cashAccountName].out += actualPayout;
            dayTotalOut += actualPayout;
          } else if (tx.type === 'လွှဲပြောင်း') {
            // Cash commission received
            const commCash = tx.commission || 0;
            if (commCash > 0) {
              cashFlows[tx.cashAccountName].in += commCash;
              dayTotalIn += commCash;
            }
          }
        }

        // --- 2. WALLET FLOWS ---
        if (tx.type === 'ထုတ်') {
          // Cash out: customer sends digital balance into shop's wallet
          if (tx.walletName && walletFlows[tx.walletName]) {
            walletFlows[tx.walletName].in += tx.amount;
            dayTotalIn += tx.amount;
          }
        } else if (tx.type === 'သွင်း') {
          // Cash in: shop transfers digital balance out of wallet to customer
          if (tx.walletName && walletFlows[tx.walletName]) {
            walletFlows[tx.walletName].out += tx.amount;
            dayTotalOut += tx.amount;
          }
        } else if (tx.type === 'လွှဲပြောင်း') {
          // Wallet to wallet transfer
          if (tx.walletName && walletFlows[tx.walletName]) {
            walletFlows[tx.walletName].out += tx.amount;
            dayTotalOut += tx.amount;
          }
          if (tx.targetWalletName && walletFlows[tx.targetWalletName]) {
            walletFlows[tx.targetWalletName].in += tx.amount;
            dayTotalIn += tx.amount;
          }
        }
      });

      const dayNet = dayTotalIn - dayTotalOut;

      const hasActivity = dayTxs.length > 0 || dayTotalIn > 0 || dayTotalOut > 0;

      if (!showOnlyActiveDays || hasActivity) {
        rows.push({
          dateStr,
          displayDate,
          cashFlows,
          walletFlows,
          totalIn: dayTotalIn,
          totalOut: dayTotalOut,
          netFlow: dayNet,
        });

        // Accumulate grand totals
        activeCashNames.forEach((c) => {
          grandTotals.cash[c].in += cashFlows[c].in;
          grandTotals.cash[c].out += cashFlows[c].out;
        });
        activeWalletNames.forEach((w) => {
          grandTotals.wallets[w].in += walletFlows[w].in;
          grandTotals.wallets[w].out += walletFlows[w].out;
        });
        grandTotals.totalIn += dayTotalIn;
        grandTotals.totalOut += dayTotalOut;
        grandTotals.netFlow += dayNet;
      }
    }

    return {
      dailyRows: rows,
      grandTotals,
      cashNames: activeCashNames,
      walletNames: activeWalletNames,
    };
  }, [cashAccounts, wallets, transactions, selectedMonth, showOnlyActiveDays]);

  // Export to Excel (HTML table format compatible with all versions of Excel)
  const handleExportExcel = () => {
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #777777; padding: 6px 10px; text-align: right; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          .title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
          .subtitle { font-size: 11pt; text-align: center; margin-bottom: 12px; }
          .date-col { text-align: center; font-weight: bold; }
          .total-row { background-color: #e6e6e6; font-weight: bold; }
          .header-group { background-color: #d9e1f2; font-size: 11pt; }
          .net-positive { color: #047857; font-weight: bold; }
          .net-negative { color: #b91c1c; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="title">SUMMARY OF MONTHLY CASH FLOW STATEMENT</div>
        <div class="subtitle">Month: ${selectedMonth} | Shop: ${shopProfile?.shopName || 'Money Agent POS'}</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" class="header-group">Date</th>
              ${cashNames.map((c) => `<th colspan="2" class="header-group">${c} (ငွေသား)</th>`).join('')}
              ${walletNames.map((w) => `<th colspan="2" class="header-group">${w}</th>`).join('')}
              <th colspan="3" class="header-group">စုစုပေါင်း</th>
            </tr>
            <tr>
              ${cashNames.map(() => `<th>ဝင်</th><th>ထွက်</th>`).join('')}
              ${walletNames.map(() => `<th>ဝင်</th><th>ထွက်</th>`).join('')}
              <th>ဝင်</th>
              <th>ထွက်</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRows
              .map(
                (row) => `
              <tr>
                <td class="date-col">${row.displayDate}</td>
                ${cashNames.map((c) => `<td>${row.cashFlows[c]?.in || 0}</td><td>${row.cashFlows[c]?.out || 0}</td>`).join('')}
                ${walletNames.map((w) => `<td>${row.walletFlows[w]?.in || 0}</td><td>${row.walletFlows[w]?.out || 0}</td>`).join('')}
                <td>${row.totalIn}</td>
                <td>${row.totalOut}</td>
                <td class="${row.netFlow >= 0 ? 'net-positive' : 'net-negative'}">${row.netFlow >= 0 ? '+' + row.netFlow : row.netFlow}</td>
              </tr>
            `
              )
              .join('')}
            <tr class="total-row">
              <td class="date-col">စုစုပေါင်း</td>
              ${cashNames.map((c) => `<td>${grandTotals.cash[c]?.in || 0}</td><td>${grandTotals.cash[c]?.out || 0}</td>`).join('')}
              ${walletNames.map((w) => `<td>${grandTotals.wallets[w]?.in || 0}</td><td>${grandTotals.wallets[w]?.out || 0}</td>`).join('')}
              <td>${grandTotals.totalIn}</td>
              <td>${grandTotals.totalOut}</td>
              <td class="${grandTotals.netFlow >= 0 ? 'net-positive' : 'net-negative'}">${grandTotals.netFlow >= 0 ? '+' + grandTotals.netFlow : grandTotals.netFlow}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Monthly_Cash_Wallet_Flow_Statement_${selectedMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="monthly-flow-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-colors print:border-none print:shadow-none print:max-h-none print:rounded-none">
        {/* MODAL HEADER - Hidden when printing */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-850 dark:to-indigo-950/20 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Monthly Cash and Wallet Flow Report</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                SUMMARY OF MONTHLY CASH FLOW STATEMENT • ရက်အလိုက် ငွေသား နှင့် Wallet ဝင်/ထွက် ရှင်းတမ်း
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export to Excel Button */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Excel (.xls) ဖိုင်အဖြစ် ဒေါင်းလုဒ်ရယူမည်"
            >
              <Download className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="စာရွက် Print တန်းထုတ်မည်"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ပိတ်ရန်"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS BAR - Hidden when printing */}
        <div className="p-3.5 sm:px-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month Navigation & Picker */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="ယခင်လသို့"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-1.5 font-bold text-slate-700 dark:text-slate-200">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) setSelectedMonth(e.target.value);
                  }}
                  className="bg-transparent font-bold font-mono outline-hidden cursor-pointer text-slate-900 dark:text-slate-100 text-xs py-0.5"
                />
              </div>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold font-mono py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-600 outline-hidden cursor-pointer"
                title="လအလိုက် ရွေးချယ်ရန်"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {m}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="နောက်လသို့"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedMonth !== defaultMonth && (
              <button
                onClick={() => setSelectedMonth(defaultMonth)}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all border border-indigo-200/60 dark:border-indigo-800 cursor-pointer"
              >
                ယခုလ ({defaultMonth})
              </button>
            )}

            {/* Active days toggle */}
            <button
              onClick={() => setShowOnlyActiveDays(!showOnlyActiveDays)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showOnlyActiveDays
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showOnlyActiveDays ? 'အရောင်းအဝယ်ရှိသော ရက်များသာ' : 'တစ်လလုံး (ရက်အားလုံး)'}</span>
            </button>
          </div>

          {/* Quick Summary Chips */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200/60 dark:border-emerald-800 font-bold">
              ဝင်ငွေ စုစုပေါင်း: +{formatKs(grandTotals.totalIn)}
            </div>
            <div className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200/60 dark:border-rose-800 font-bold">
              ထွက်ငွေ စုစုပေါင်း: -{formatKs(grandTotals.totalOut)}
            </div>
            <div
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                grandTotals.netFlow >= 0
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800'
              }`}
            >
              Net Flow: {grandTotals.netFlow >= 0 ? `+${formatKs(grandTotals.netFlow)}` : `-${formatKs(Math.abs(grandTotals.netFlow))}`}
            </div>
          </div>
        </div>

        {/* PRINTABLE STATEMENT CONTAINER */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-50 dark:bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
          {/* PRINT-ONLY HEADER - exactly matching paper layout */}
          <div className="hidden print:block mb-4 text-slate-900">
            <div className="text-center font-black text-lg tracking-wide uppercase">
              SUMMARY OF MONTHLY CASH FLOW STATEMENT
            </div>
            <div className="flex justify-between items-center text-xs font-semibold mt-2 border-b-2 border-slate-900 pb-1">
              <div>
                <span>Months: </span>
                <span className="font-bold">{selectedMonth}</span>
              </div>
              <div>
                <span>{shopProfile?.shopName || 'Money Agent POS'}</span>
                {shopProfile?.phone && <span className="ml-2">({shopProfile.phone})</span>}
              </div>
            </div>
          </div>

          {/* MAIN STATEMENT TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs overflow-x-auto print:border-black print:shadow-none print:rounded-none">
            <table className="w-full text-xs text-slate-800 dark:text-slate-200 border-collapse print:text-[10px] print:text-black">
              <thead>
                {/* Header Row 1: Account Groups */}
                <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-300 dark:border-slate-700 print:bg-slate-200 print:border-black">
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap min-w-[75px] font-black"
                  >
                    Date
                  </th>
                  {cashNames.map((c) => (
                    <th
                      key={`h1-cash-${c}`}
                      colSpan={2}
                      className="p-2 text-center border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap bg-emerald-100/60 dark:bg-emerald-950/40 print:bg-slate-200 font-black text-emerald-900 dark:text-emerald-200 print:text-black"
                    >
                      {c}
                    </th>
                  ))}
                  {walletNames.map((w) => (
                    <th
                      key={`h1-wallet-${w}`}
                      colSpan={2}
                      className="p-2 text-center border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap bg-indigo-100/60 dark:bg-indigo-950/40 print:bg-slate-200 font-black text-indigo-900 dark:text-indigo-200 print:text-black"
                    >
                      {w}
                    </th>
                  ))}
                  <th
                    colSpan={3}
                    className="p-2 text-center font-black whitespace-nowrap bg-slate-300 dark:bg-slate-700 print:bg-slate-300 text-slate-950 dark:text-white print:text-black"
                  >
                    စုစုပေါင်း
                  </th>
                </tr>

                {/* Header Row 2: In / Out Subcolumns & Net Column */}
                <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 font-bold border-b-2 border-slate-300 dark:border-slate-700 print:border-black text-[11px] print:text-[9px]">
                  {cashNames.map((c) => (
                    <React.Fragment key={`h2-cash-${c}`}>
                      <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[65px] text-emerald-700 dark:text-emerald-400 print:text-black">
                        ဝင်
                      </th>
                      <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[65px] text-rose-700 dark:text-rose-400 print:text-black">
                        ထွက်
                      </th>
                    </React.Fragment>
                  ))}
                  {walletNames.map((w) => (
                    <React.Fragment key={`h2-wallet-${w}`}>
                      <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[65px] text-emerald-700 dark:text-emerald-400 print:text-black">
                        ဝင်
                      </th>
                      <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[65px] text-rose-700 dark:text-rose-400 print:text-black">
                        ထွက်
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[75px] text-emerald-800 dark:text-emerald-300 print:text-black font-black">
                    ဝင်
                  </th>
                  <th className="p-1.5 text-right border-r border-slate-300 dark:border-slate-700 print:border-black min-w-[75px] text-rose-800 dark:text-rose-300 print:text-black font-black">
                    ထွက်
                  </th>
                  <th className="p-1.5 text-right min-w-[80px] text-indigo-900 dark:text-indigo-200 print:text-black font-black bg-indigo-50/50 dark:bg-indigo-950/30">
                    Net
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px] print:text-[9px] print:divide-black">
                {dailyRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + cashNames.length * 2 + walletNames.length * 2 + 3}
                      className="p-8 text-center text-slate-400 dark:text-slate-500 font-sans"
                    >
                      ဤလအတွင်း အရောင်းအဝယ် စာရင်းမှတ်တမ်းများ မရှိသေးပါ
                    </td>
                  </tr>
                ) : (
                  dailyRows.map((row, idx) => (
                    <tr
                      key={row.dateStr}
                      className={`hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-850/40 print:bg-slate-50' : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Date */}
                      <td className="p-2 text-center font-bold border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap text-slate-800 dark:text-slate-200 print:text-black">
                        {row.displayDate}
                      </td>

                      {/* Cash Account In / Out */}
                      {cashNames.map((c) => {
                        const inVal = row.cashFlows[c]?.in || 0;
                        const outVal = row.cashFlows[c]?.out || 0;
                        return (
                          <React.Fragment key={`row-${row.dateStr}-cash-${c}`}>
                            <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap">
                              {inVal > 0 ? inVal.toLocaleString('en-US') : '-'}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap">
                              {outVal > 0 ? outVal.toLocaleString('en-US') : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Wallet In / Out */}
                      {walletNames.map((w) => {
                        const inVal = row.walletFlows[w]?.in || 0;
                        const outVal = row.walletFlows[w]?.out || 0;
                        return (
                          <React.Fragment key={`row-${row.dateStr}-wallet-${w}`}>
                            <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap">
                              {inVal > 0 ? inVal.toLocaleString('en-US') : '-'}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap">
                              {outVal > 0 ? outVal.toLocaleString('en-US') : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Total In / Out on that day */}
                      <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap font-bold text-slate-900 dark:text-slate-100 print:text-black bg-slate-100/40 dark:bg-slate-800/30">
                        {row.totalIn > 0 ? row.totalIn.toLocaleString('en-US') : '-'}
                      </td>
                      <td className="p-2 text-right border-r border-slate-200 dark:border-slate-800 print:border-black whitespace-nowrap font-bold text-slate-900 dark:text-slate-100 print:text-black bg-slate-100/40 dark:bg-slate-800/30">
                        {row.totalOut > 0 ? row.totalOut.toLocaleString('en-US') : '-'}
                      </td>

                      {/* Daily Net Flow (In - Out) */}
                      <td
                        className={`p-2 text-right whitespace-nowrap font-bold print:text-black bg-indigo-50/30 dark:bg-indigo-950/20 ${
                          row.netFlow > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.netFlow < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.netFlow !== 0
                          ? row.netFlow > 0
                            ? `+${row.netFlow.toLocaleString('en-US')}`
                            : `-${Math.abs(row.netFlow).toLocaleString('en-US')}`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* FOOTER GRAND TOTAL ROW */}
              <tfoot className="bg-slate-200 dark:bg-slate-800 font-bold border-t-2 border-slate-400 dark:border-slate-600 text-slate-950 dark:text-slate-100 print:bg-slate-200 print:border-black font-mono text-[11px] print:text-[9px]">
                <tr>
                  <td className="p-2.5 text-center font-black border-r border-slate-300 dark:border-slate-700 print:border-black font-sans">
                    စုစုပေါင်း
                  </td>

                  {/* Grand total per Cash Account */}
                  {cashNames.map((c) => (
                    <React.Fragment key={`foot-cash-${c}`}>
                      <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black">
                        {(grandTotals.cash[c]?.in || 0).toLocaleString('en-US')}
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black">
                        {(grandTotals.cash[c]?.out || 0).toLocaleString('en-US')}
                      </td>
                    </React.Fragment>
                  ))}

                  {/* Grand total per Wallet */}
                  {walletNames.map((w) => (
                    <React.Fragment key={`foot-wallet-${w}`}>
                      <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black">
                        {(grandTotals.wallets[w]?.in || 0).toLocaleString('en-US')}
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black">
                        {(grandTotals.wallets[w]?.out || 0).toLocaleString('en-US')}
                      </td>
                    </React.Fragment>
                  ))}

                  {/* Overall In / Out & Overall Net */}
                  <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black bg-slate-300 dark:bg-slate-700 print:bg-slate-300 text-slate-950 dark:text-white print:text-black">
                    {grandTotals.totalIn.toLocaleString('en-US')}
                  </td>
                  <td className="p-2 text-right border-r border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap font-black bg-slate-300 dark:bg-slate-700 print:bg-slate-300 text-slate-950 dark:text-white print:text-black">
                    {grandTotals.totalOut.toLocaleString('en-US')}
                  </td>
                  <td
                    className={`p-2 text-right whitespace-nowrap font-black bg-slate-300 dark:bg-slate-700 print:bg-slate-300 print:text-black ${
                      grandTotals.netFlow >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {grandTotals.netFlow >= 0
                      ? `+${grandTotals.netFlow.toLocaleString('en-US')}`
                      : `-${Math.abs(grandTotals.netFlow).toLocaleString('en-US')}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* NET DIFFERENCE FOOTNOTE */}
          {dailyRows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 print:text-black">
              <div className="flex items-center gap-3">
                <span>
                  တစ်လလုံး အသားတင် စုစုပေါင်း (Net Flow = ဝင်ငွေ - ထွက်ငွေ):{' '}
                  <strong
                    className={`font-mono text-sm ${
                      grandTotals.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {grandTotals.netFlow >= 0
                      ? `+${grandTotals.netFlow.toLocaleString('en-US')} Ks`
                      : `-${Math.abs(grandTotals.netFlow).toLocaleString('en-US')} Ks`}
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 print:hidden">
                * ငွေသားအကောင့်များနှင့် Wallet အားလုံး၏ တကယ့်ဝင်ငွေ/ထွက်ငွေ ပမာဏများကို အခြေခံ၍ အလိုအလျောက် တွက်ချက်ထားပါသည်
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
