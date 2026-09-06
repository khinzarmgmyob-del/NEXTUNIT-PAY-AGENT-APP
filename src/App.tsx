import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Banknote,
  Wallet,
  Globe,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Edit,
  ShieldCheck,
  Search,
  Calendar,
  History,
  RotateCcw,
  Printer,
  Sparkles,
  Store,
  Settings,
  Coins,
  LayoutGrid,
  Table as TableIcon,
  Filter,
  Share2,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  Archive,
  Sun,
  Moon,
  Database,
  Wifi,
  FileText,
  ScanLine,
} from 'lucide-react';
import { Transaction, WalletItem, CashAccountItem, BackupData, TransactionType, ShopProfile, NetworkConfig, NetworkMode } from './types';
import { getDeviceId, generateActivationKey, verifyActivationKey, getAppLicenseStatus, LicenseStatus } from './utils/license';
import { getTodayFormatted, getCurrentTimeFormatted, formatKs, formatLakh } from './utils/formatters';
import { exportBackupData, readBackupFromFile } from './utils/backupManager';
import { getAccountColorStyle, getPresetByColor } from './utils/colors';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { TransactionModal } from './components/TransactionModal';
import { WalletModal } from './components/WalletModal';
import { CashEditModal } from './components/CashEditModal';
import { ReportModal, getCommissionBreakdown } from './components/ReportModal';
import { TransactionReceiptModal } from './components/TransactionReceiptModal';
import { ShopProfileModal } from './components/ShopProfileModal';
import { TotalAccountsReportModal } from './components/TotalAccountsReportModal';
import { RestoreConfirmModal } from './components/RestoreConfirmModal';
import { ArchiveMaintenanceModal } from './components/ArchiveMaintenanceModal';
import { CashReconcileModal } from './components/CashReconcileModal';
import { WalletReconcileModal } from './components/WalletReconcileModal';
import { MonthlyCashWalletFlowReportModal } from './components/MonthlyCashWalletFlowReportModal';
import { PaginationControls } from './components/PaginationControls';
import { NetworkSettingsModal } from './components/NetworkSettingsModal';
import { LicenseDashboardModal } from './components/LicenseDashboardModal';
import { MetallicWaveBackground } from './components/MetallicWaveBackground';
import { CloudBackupModal } from './components/CloudBackupModal';
import { BluetoothPrinterModal } from './components/BluetoothPrinterModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { OcrSlipScannerModal } from './components/OcrSlipScannerModal';
import { exportToPdfNative, exportToExcelNative } from './utils/nativeFileExporter';
import { PrintReportOptions } from './utils/exportAndPrint';
import { triggerAutoCloudBackup, subscribeCloudBackup } from './services/cloudBackupService';
import { getBluetoothConnectionStatus } from './utils/bluetoothPrinter';
import {
  initDataService as initSQLiteDatabase,
  getTransactionsPaged,
  getAllFilteredTransactions,
  insertTransaction,
  deleteTransactionById,
  saveCashAccountsToDB,
  getCashAccountsFromDB,
  saveWalletsToDB,
  getWalletsFromDB,
  saveShopProfileToDB,
  getShopProfileFromDB,
  purgeOldTransactionsDB,
  resetAllDataDB,
  restoreDatabasePayload,
  PagedTransactionsResult,
  getNetworkConfig,
  subscribeNetworkStatus,
} from './services/dataService';

// Initial Clean Cash Accounts (0 Balance)
const INITIAL_CASH_ACCOUNTS: CashAccountItem[] = [
  { id: 1, name: 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)', balance: 0, updatedDate: getTodayFormatted(), note: 'ကောင်တာ ၁' },
  { id: 2, name: 'ကာတာငွေသေတ္တာ (Safe Box)', balance: 0, updatedDate: getTodayFormatted(), note: 'အနောက်ခန်း' },
  { id: 3, name: 'အရန်ငွေသေတ္တာ (Backup Cash)', balance: 0, updatedDate: getTodayFormatted(), note: 'အရန်' },
];

// Initial Clean Wallets (0 Balance)
const INITIAL_WALLETS: WalletItem[] = [
  { id: 1, name: 'KPay', balance: 0, updatedDate: getTodayFormatted(), accountNumber: '09798001122' },
  { id: 2, name: 'WaveMoney', balance: 0, updatedDate: getTodayFormatted(), accountNumber: '09971234567' },
  { id: 3, name: 'CB Pay', balance: 0, updatedDate: getTodayFormatted(), accountNumber: '0012903829' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [];

export default function App() {
  const todayStr = getTodayFormatted();

  // License State
  const [deviceId, setDeviceId] = useState<string>('');
  const [isActivated, setIsActivated] = useState<boolean>(false);

  // Shop Profile State
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { shopName: 'Money Agent POS', address: '', phone: '' };
      }
    }
    return { shopName: 'Money Agent POS', address: '', phone: '' };
  });

  // Cash Accounts State (Multiple Cash Drawers / Boxes)
  const [cashAccounts, setCashAccounts] = useState<CashAccountItem[]>(() => {
    const saved = localStorage.getItem('app_cash_accounts');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_CASH_ACCOUNTS;
      }
    }
    const legacyCash = localStorage.getItem('app_cash_balance');
    if (legacyCash !== null) {
      const parsedVal = JSON.parse(legacyCash);
      return [
        { id: 1, name: 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)', balance: parsedVal, updatedDate: todayStr, note: 'ကောင်တာ ၁' },
      ];
    }
    return INITIAL_CASH_ACCOUNTS;
  });

  // Wallets State
  const [wallets, setWallets] = useState<WalletItem[]>(() => {
    const saved = localStorage.getItem('app_wallets');
    return saved !== null ? JSON.parse(saved) : INITIAL_WALLETS;
  });

  // Full transactions for aggregated calculations & report modals
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('app_transactions');
    return saved !== null ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Database Initialization State
  const [isDBReady, setIsDBReady] = useState<boolean>(false);
  const [isDBLoading, setIsDBLoading] = useState<boolean>(false);

  // Pagination & Paged Transactions for Main Dashboard
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [pagedTransactions, setPagedTransactions] = useState<Transaction[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Main Dashboard Aggregates from Database
  const [mainTotalAmount, setMainTotalAmount] = useState<number>(0);
  const [mainTotalIn, setMainTotalIn] = useState<number>(0);
  const [mainTotalOut, setMainTotalOut] = useState<number>(0);
  const [mainTotalTransfer, setMainTotalTransfer] = useState<number>(0);
  const [mainNetCash, setMainNetCash] = useState<number>(0);
  const [mainTotalCashComm, setMainTotalCashComm] = useState<number>(0);
  const [mainTotalWalletComm, setMainTotalWalletComm] = useState<number>(0);
  const [mainGrandTotalComm, setMainGrandTotalComm] = useState<number>(0);

  // Modal Controls
  const [showTransactionModal, setShowTransactionModal] = useState<boolean>(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>('သွင်း');

  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showCashEditModal, setShowCashEditModal] = useState<boolean>(false);
  const [showShopProfileModal, setShowShopProfileModal] = useState<boolean>(false);

  const [showCommissionReport, setShowCommissionReport] = useState<boolean>(false);
  const [showWalletReport, setShowWalletReport] = useState<boolean>(false);
  const [showCashReport, setShowCashReport] = useState<boolean>(false);
  const [showAllTransactionsModal, setShowAllTransactionsModal] = useState<boolean>(false);
  const [showTotalAccountsReport, setShowTotalAccountsReport] = useState<boolean>(false);
  const [showCashReconcileReport, setShowCashReconcileReport] = useState<boolean>(false);
  const [showWalletReconcileReport, setShowWalletReconcileReport] = useState<boolean>(false);
  const [showMonthlyFlowReport, setShowMonthlyFlowReport] = useState<boolean>(false);
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [showNetworkModal, setShowNetworkModal] = useState<boolean>(false);
  const [showLicenseModal, setShowLicenseModal] = useState<boolean>(false);
  const [showCloudBackupModal, setShowCloudBackupModal] = useState<boolean>(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState<boolean>(false);

  // Bottom Transaction Ledger Export & Print & OCR States
  const [showLedgerPrintPreview, setShowLedgerPrintPreview] = useState<boolean>(false);
  const [ledgerReportOptions, setLedgerReportOptions] = useState<PrintReportOptions | null>(null);
  const [showLedgerOcrScanner, setShowLedgerOcrScanner] = useState<boolean>(false);
  const [isLedgerExportingPdf, setIsLedgerExportingPdf] = useState<boolean>(false);
  const [isLedgerExportingExcel, setIsLedgerExportingExcel] = useState<boolean>(false);

  // License & 3-Day Trial State
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() => getAppLicenseStatus());

  // Cloud Auto-Backup state
  const [cloudLastBackupTime, setCloudLastBackupTime] = useState<string>('');

  // Bluetooth Printer connection status
  const [btStatus, setBtStatus] = useState(() => getBluetoothConnectionStatus());

  // Subscribe to Cloud Backup updates
  useEffect(() => {
    const unsub = subscribeCloudBackup((_snapshots, lastTime) => {
      setCloudLastBackupTime(lastTime);
    });
    return unsub;
  }, []);

  // Update Bluetooth status periodically
  useEffect(() => {
    const updateBt = () => setBtStatus(getBluetoothConnectionStatus());
    updateBt();
    const interval = setInterval(updateBt, 5000);
    return () => clearInterval(interval);
  }, []);

  // Wi-Fi Network Mode (Master / Client) State
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>(() => getNetworkConfig());
  const [networkStatus, setNetworkStatus] = useState<{
    isClient: boolean;
    isConnected: boolean;
    error?: string;
    mode: NetworkMode;
  }>({
    isClient: getNetworkConfig().mode === 'client',
    isConnected: true,
    mode: getNetworkConfig().mode,
  });

  // Subscribe to real-time Network Status and Wi-Fi alerts
  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((status) => {
      setNetworkStatus(status);
      if (status.error && status.isClient) {
        showToast(`⚠️ Master Server ချိတ်ဆက်မှု: ${status.error}`, 'error');
      }
    });
    return unsubscribe;
  }, []);

  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  // Backup & Restore & Toast States
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<BackupData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal Filter States
  const [selectedReportDate, setSelectedReportDate] = useState<string>(todayStr);
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>('all');
  const [selectedCashFilter, setSelectedCashFilter] = useState<string>('all');

  // Main Dashboard Filter States
  const [mainDateFilter, setMainDateFilter] = useState<string>('ALL');
  const [mainWalletFilter, setMainWalletFilter] = useState<string>('all');
  const [mainCashFilter, setMainCashFilter] = useState<string>('all');
  const [mainTypeFilter, setMainTypeFilter] = useState<string>('all');
  const [mainSearchQuery, setMainSearchQuery] = useState<string>('');
  const [mainViewMode, setMainViewMode] = useState<'card' | 'table'>('card');

  // Dark / Light Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // License & 3-Day Trial Verification Effect
  useEffect(() => {
    const checkLicense = () => {
      const status = getAppLicenseStatus();
      setLicenseStatus(status);
      setDeviceId(status.deviceId);
      setIsActivated(status.canAccessApp);
    };

    checkLicense();
    const interval = setInterval(checkLicense, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize SQLite Database and perform sync
  useEffect(() => {
    let isMounted = true;

    async function initDB() {
      try {
        setIsDBLoading(true);
        await initSQLiteDatabase();

        const [dbCash, dbWallets, dbProfile, allTx] = await Promise.all([
          getCashAccountsFromDB(),
          getWalletsFromDB(),
          getShopProfileFromDB(),
          getAllFilteredTransactions(),
        ]);

        if (isMounted) {
          if (dbCash && dbCash.length > 0) setCashAccounts(dbCash);
          if (dbWallets && dbWallets.length > 0) setWallets(dbWallets);
          if (dbProfile) setShopProfile(dbProfile);
          if (allTx && allTx.length > 0) setTransactions(allTx);
          setIsDBReady(true);
        }
      } catch (err) {
        console.error('Failed to initialize SQLite:', err);
      } finally {
        if (isMounted) setIsDBLoading(false);
      }
    }

    initDB();

    return () => {
      isMounted = false;
    };
  }, []);

  // Function to load paged transactions from SQLite using indexed queries
  const fetchPagedTransactions = useCallback(
    async (page: number, currentLimit: number) => {
      setIsDBLoading(true);
      try {
        const result: PagedTransactionsResult = await getTransactionsPaged({
          page,
          pageSize: currentLimit,
          dateFilter: mainDateFilter,
          walletFilter: mainWalletFilter,
          cashFilter: mainCashFilter,
          typeFilter: mainTypeFilter,
          searchQuery: mainSearchQuery,
          todayDate: todayStr,
        });

        setPagedTransactions(result.transactions);
        setTotalFilteredCount(result.totalCount);
        setTotalPages(result.totalPages);
        setMainTotalAmount(result.totalAmount || 0);
        setMainTotalIn(result.totalInAmount || 0);
        setMainTotalOut(result.totalOutAmount || 0);
        setMainTotalTransfer(result.totalTransferAmount || 0);
        setMainNetCash(result.netCash);
        setMainTotalCashComm(result.totalCashComm);
        setMainTotalWalletComm(result.totalWalletComm);
        setMainGrandTotalComm(result.totalCashComm + result.totalWalletComm);
      } catch (error) {
        console.error('Error querying SQLite transactions:', error);
      } finally {
        setIsDBLoading(false);
      }
    },
    [mainDateFilter, mainWalletFilter, mainCashFilter, mainTypeFilter, mainSearchQuery, todayStr]
  );

  // Trigger query whenever filters or pagination change
  useEffect(() => {
    fetchPagedTransactions(currentPage, pageSize);
  }, [fetchPagedTransactions, currentPage, pageSize]);

  // Reset to page 1 whenever any filter criteria changes
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  // Helper for actual cash amount
  const getActualCash = (item: Transaction): number => {
    if (item.type === 'လွှဲပြောင်း') {
      return 0; // Transfer happens directly between wallets; cash account gets commission
    }
    if (item.type === 'ထုတ်') {
      if (item.netPayout !== undefined) return item.netPayout;
      if (item.commissionMode === 'deduct') return Math.max(0, item.amount - item.commission);
      return item.amount;
    }
    return item.amount;
  };

  // Aggregate Calculations for balances
  const totalCashBalance = cashAccounts.reduce((sum, c) => sum + c.balance, 0);
  const totalWalletBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalCapital = totalCashBalance + totalWalletBalance;

  // Today Statistics
  const todayTransactions = transactions.filter((t) => t.date === todayStr);
  const todayCashComm = todayTransactions.reduce((sum, item) => sum + getCommissionBreakdown(item).cashComm, 0);
  const todayWalletComm = todayTransactions.reduce((sum, item) => sum + getCommissionBreakdown(item).walletComm, 0);
  const todayCommission = todayCashComm + todayWalletComm;

  const todayIn = todayTransactions
    .filter((t) => t.type === 'သွင်း')
    .reduce((sum, item) => sum + getActualCash(item), 0);
  const todayOut = todayTransactions
    .filter((t) => t.type === 'ထုတ်')
    .reduce((sum, item) => sum + getActualCash(item), 0);
  const todayTransfer = todayTransactions
    .filter((t) => t.type === 'လွှဲပြောင်း')
    .reduce((sum, item) => sum + item.amount, 0);

  // Filter Transactions for Reports
  const filterList = () => {
    return transactions.filter((t) => {
      const matchDate = selectedReportDate === 'ALL' ? true : t.date === selectedReportDate;
      let matchWallet = true;
      if (selectedWalletFilter === 'none') {
        matchWallet = !t.walletName || t.walletName === 'None' || t.walletName === '-';
      } else if (selectedWalletFilter !== 'all') {
        matchWallet = t.walletName === selectedWalletFilter || t.targetWalletName === selectedWalletFilter;
      }

      let matchCash = true;
      if (selectedCashFilter === 'none') {
        matchCash = !t.cashAccountName || t.cashAccountName === 'None' || t.cashAccountName === '-';
      } else if (selectedCashFilter !== 'all') {
        matchCash = t.cashAccountName === selectedCashFilter;
      }

      return matchDate && matchWallet && matchCash;
    });
  };

  // Prepare ledger export data for PDF, Excel, and Print Preview
  const prepareLedgerExportData = async () => {
    let dataset: Transaction[] = [];
    try {
      dataset = await getAllFilteredTransactions({
        dateFilter: mainDateFilter,
        walletFilter: mainWalletFilter,
        cashFilter: mainCashFilter,
        typeFilter: mainTypeFilter,
        searchQuery: mainSearchQuery,
        todayDate: todayStr,
      });
    } catch (e) {
      console.warn('Fallback to paged transactions for ledger export:', e);
    }

    if (!dataset || dataset.length === 0) {
      dataset = pagedTransactions;
    }

    const headersList = [
      'စဉ် (No.)',
      'နေ့စွဲ (Date)',
      'အချိန် (Time)',
      'ဖောက်သည်အမည် (Customer)',
      'အမျိုးအစား (Type)',
      'လက်ငင်းပေး/ရငွေ (Actual)',
      'မူလလွှဲငွေ (Amount)',
      'ငွေသားကော်မရှင် (Cash Comm)',
      'Walletကော်မရှင် (Wallet Comm)',
      'စုစုပေါင်းကော်မရှင် (Total Comm)',
      'ကော်မရှင်ပုံစံ (Mode)',
      'ဖုန်း (Phone)',
      'Wallet/လွှဲထုတ် (Wallet)',
      'လက်ခံWallet (Target)',
      'ငွေသားအကောင့် (Cash Box)',
      'OCR/ပြေစာအမှတ် (Voucher Ref)',
      'မှတ်ချက် (Notes)',
    ];

    let sumCashComm = 0;
    let sumWalletComm = 0;
    let sumIn = 0;
    let sumOut = 0;
    let sumTransfer = 0;
    let sumNet = 0;

    const rows = dataset.map((item, index) => {
      const isCashOut = item.type === 'ထုတ်';
      const isTransfer = item.type === 'လွှဲပြောင်း';
      const isCashIn = item.type === 'သွင်း';

      const actualCash = isTransfer
        ? item.amount
        : isCashOut
        ? item.netPayout !== undefined
          ? item.netPayout
          : item.commissionMode === 'deduct'
          ? item.amount - item.commission
          : item.amount
        : item.amount;

      let cComm = 0;
      let wComm = 0;
      if (isTransfer) {
        if (item.commissionChannel === 'Wallet') wComm = item.commission;
        else cComm = item.commission;
        sumTransfer += item.amount;
      } else if (isCashIn) {
        cComm = item.commission;
        sumIn += actualCash;
        sumNet += actualCash;
      } else {
        if (item.commissionMode === 'deduct') {
          wComm = item.commission;
        } else {
          cComm = item.commission;
        }
        sumOut += actualCash;
        sumNet -= actualCash;
      }

      sumCashComm += cComm;
      sumWalletComm += wComm;

      return [
        index + 1,
        item.date,
        item.time || '-',
        item.customerName,
        item.type,
        actualCash.toLocaleString('en-US'),
        item.amount.toLocaleString('en-US'),
        cComm > 0 ? `+${cComm.toLocaleString('en-US')}` : '-',
        wComm > 0 ? `+${wComm.toLocaleString('en-US')}` : '-',
        `+${(cComm + wComm).toLocaleString('en-US')}`,
        item.commissionMode === 'deduct' ? 'မူလငွေမှနုတ်' : 'သီးသန့်ပေး',
        item.phone || '-',
        item.walletName,
        item.targetWalletName || '-',
        item.cashAccountName || '-',
        item.ocrRef || `TXN-${item.id}`,
        item.note || '-',
      ];
    });

    const summaryRow = [
      'စုစုပေါင်း Total',
      '',
      '',
      '',
      '',
      `${sumNet >= 0 ? '+' : '-'}${Math.abs(sumNet).toLocaleString('en-US')}`,
      (sumIn + sumOut + sumTransfer).toLocaleString('en-US'),
      `+${sumCashComm.toLocaleString('en-US')}`,
      `+${sumWalletComm.toLocaleString('en-US')}`,
      `+${(sumCashComm + sumWalletComm).toLocaleString('en-US')}`,
      '',
      '',
      '',
      '',
      '',
      '',
      `စာရင်းပေါင်း ${dataset.length} ခု`,
    ];

    const title = 'အရောင်းအဝယ် စာရင်းမှတ်တမ်းများ (Transactions Ledger)';
    const subtitle = `ရက်စွဲ: ${mainDateFilter === 'ALL' ? 'ရက်စွဲအားလုံး' : mainDateFilter === 'TODAY' ? todayStr : mainDateFilter} • စုစုပေါင်း: ${dataset.length} ခု`;

    return {
      dataset,
      headersList,
      rows,
      summaryRow,
      title,
      subtitle,
      summaryCards: [
        { label: 'ငွေသွင်း (Cash In)', value: `+${formatKs(sumIn)}`, note: 'လက်ငင်းငွေသားဝင်' },
        { label: 'ငွေထုတ် (Cash Out)', value: `-${formatKs(sumOut)}`, note: 'လက်ငင်းငွေသားထုတ်' },
        { label: 'ကော်မရှင်စုစုပေါင်း', value: `+${formatKs(sumCashComm + sumWalletComm)}`, note: `Cash:${formatKs(sumCashComm)} | W:${formatKs(sumWalletComm)}` },
        { label: 'စာရင်း အရေအတွက်', value: `${dataset.length} ခု`, note: `လွှဲပြောင်း: ${formatKs(sumTransfer)}` },
      ],
    };
  };

  // Direct Page Setup & Print Preview for Ledger
  const handleLedgerPrint = async () => {
    try {
      const data = await prepareLedgerExportData();
      if (data.dataset.length === 0) {
        showToast('ပရင့်ထုတ်ရန် ဒေတာ မရှိပါ။', 'info');
        return;
      }
      setLedgerReportOptions({
        title: data.title,
        subtitle: data.subtitle,
        shopProfile,
        summaryCards: data.summaryCards,
        tableHeaders: data.headersList,
        tableRows: data.rows,
        summaryRow: data.summaryRow,
        filename: `Transactions_Ledger_${todayStr}_${Date.now()}.pdf`,
      });
      setShowLedgerPrintPreview(true);
    } catch (e: any) {
      showToast(`ပရင့် ပြင်ဆင်ရာတွင် အမှား: ${e?.message || e}`, 'error');
    }
  };

  // Direct PDF Export & Native Share for Ledger
  const handleLedgerExportPdf = async () => {
    setIsLedgerExportingPdf(true);
    try {
      const data = await prepareLedgerExportData();
      if (data.dataset.length === 0) {
        showToast('PDF ထုတ်ရန် ဒေတာ မရှိပါ။', 'info');
        return;
      }
      await exportToPdfNative({
        title: data.title,
        subtitle: data.subtitle,
        shopProfile,
        summaryCards: data.summaryCards,
        tableHeaders: data.headersList,
        tableRows: data.rows,
        summaryRow: data.summaryRow,
        filename: `Transactions_Ledger_${todayStr}_${Date.now()}.pdf`,
      });
    } catch (e: any) {
      showToast(`PDF ထုတ်ယူရာတွင် အမှား: ${e?.message || e}`, 'error');
    } finally {
      setIsLedgerExportingPdf(false);
    }
  };

  // Direct Excel (.xlsx) Export for Ledger with Myanmar Unicode
  const handleLedgerExportExcel = async () => {
    setIsLedgerExportingExcel(true);
    try {
      const data = await prepareLedgerExportData();
      if (data.dataset.length === 0) {
        showToast('Excel ထုတ်ရန် ဒေတာ မရှိပါ။', 'info');
        return;
      }
      await exportToExcelNative({
        filename: `Transactions_Ledger_${todayStr}_${Date.now()}.xlsx`,
        sheetName: 'Ledger',
        headers: data.headersList,
        rows: data.rows,
        summaryRow: data.summaryRow,
      });
    } catch (e: any) {
      showToast(`Excel ထုတ်ယူရာတွင် အမှား: ${e?.message || e}`, 'error');
    } finally {
      setIsLedgerExportingExcel(false);
    }
  };

  // Transaction Save Handler with Double-Entry Balance Updates & SQLite Insert
  const handleSaveTransaction = async (
    txData: Omit<Transaction, 'id'>,
    updateBalances: boolean
  ) => {
    try {
      const newTransaction: Transaction = {
        ...txData,
        id: Date.now(),
      };

      // 1. Update transactions state immediately
      setTransactions((prev) => [newTransaction, ...prev]);
      setPagedTransactions((prev) => [newTransaction, ...prev.filter((t) => t.id !== newTransaction.id)]);
      setTotalFilteredCount((prev) => prev + 1);

      let updatedWalletsList = [...wallets];
      let updatedCashList = [...cashAccounts];

      if (updateBalances) {
        if (txData.type === 'လွှဲပြောင်း') {
          const commChannel = txData.commissionChannel || 'Cash';
          const commWallet = txData.commissionWalletName || txData.targetWalletName || txData.walletName;
          const commAmount = txData.commission || 0;

          // Ensure source and target wallets exist
          if (!updatedWalletsList.some((w) => w.name === txData.walletName)) {
            updatedWalletsList.push({
              id: Date.now() + 1,
              name: txData.walletName,
              balance: 0,
              updatedDate: txData.date,
            });
          }
          if (txData.targetWalletName && !updatedWalletsList.some((w) => w.name === txData.targetWalletName)) {
            updatedWalletsList.push({
              id: Date.now() + 2,
              name: txData.targetWalletName,
              balance: 0,
              updatedDate: txData.date,
            });
          }

          // 1. Dual Wallet Update for Transfer
          updatedWalletsList = updatedWalletsList.map((w) => {
            let newBal = w.balance;
            let changed = false;

            if (w.name === txData.walletName) {
              newBal -= txData.amount;
              changed = true;
            }
            if (txData.targetWalletName && w.name === txData.targetWalletName) {
              newBal += txData.amount;
              changed = true;
            }
            if (commChannel === 'Wallet' && commAmount > 0 && w.name === commWallet) {
              newBal += commAmount;
              changed = true;
            }

            if (changed) {
              return { ...w, balance: newBal, updatedDate: txData.date };
            }
            return w;
          });

          // 2. Cash Account Update (if commission is received in Cash)
          if (commChannel === 'Cash' && commAmount > 0) {
            const cashTargetName = txData.cashAccountName || updatedCashList[0]?.name || 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)';
            if (!updatedCashList.some((c) => c.name === cashTargetName)) {
              updatedCashList.push({
                id: Date.now() + 3,
                name: cashTargetName,
                balance: 0,
                updatedDate: txData.date,
              });
            }
            updatedCashList = updatedCashList.map((c) => {
              if (c.name === cashTargetName) {
                return { ...c, balance: c.balance + commAmount, updatedDate: txData.date };
              }
              return c;
            });
          }
        } else {
          const isCashOut = txData.type === 'ထုတ်';
          const walletTarget = txData.walletName || updatedWalletsList[0]?.name || 'KPay';
          const cashTarget = txData.cashAccountName || updatedCashList[0]?.name || 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)';

          // Ensure wallet exists
          if (!updatedWalletsList.some((w) => w.name === walletTarget)) {
            updatedWalletsList.push({
              id: Date.now() + 1,
              name: walletTarget,
              balance: 0,
              updatedDate: txData.date,
            });
          }
          // Ensure cash account exists
          if (!updatedCashList.some((c) => c.name === cashTarget)) {
            updatedCashList.push({
              id: Date.now() + 2,
              name: cashTarget,
              balance: 0,
              updatedDate: txData.date,
            });
          }

          // 1. Update Selected Wallet
          updatedWalletsList = updatedWalletsList.map((w) => {
            if (w.name === walletTarget) {
              const newBal = isCashOut
                ? w.balance + txData.amount
                : w.balance - txData.amount;
              return { ...w, balance: newBal, updatedDate: txData.date };
            }
            return w;
          });

          // 2. Update Selected Cash Account
          const cashDelta = isCashOut
            ? -(txData.amount - (txData.commission || 0))
            : txData.amount + (txData.commission || 0);

          updatedCashList = updatedCashList.map((c) => {
            if (c.name === cashTarget) {
              return { ...c, balance: c.balance + cashDelta, updatedDate: txData.date };
            }
            return c;
          });
        }

        setWallets(updatedWalletsList);
        setCashAccounts(updatedCashList);
      }

      // Close modal and refresh paged view
      setShowTransactionModal(false);

      // Persist to SQLite / Local Storage
      await insertTransaction(newTransaction);
      if (updateBalances) {
        await Promise.all([
          saveWalletsToDB(updatedWalletsList),
          saveCashAccountsToDB(updatedCashList),
        ]);
      }

      // Trigger Cloud Auto-Backup asynchronously without blocking
      try {
        triggerAutoCloudBackup({
          cashAccounts: updateBalances ? updatedCashList : cashAccounts,
          cashBalance: (updateBalances ? updatedCashList : cashAccounts).reduce((sum, c) => sum + c.balance, 0),
          wallets: updateBalances ? updatedWalletsList : wallets,
          transactions: [newTransaction, ...transactions],
          shopProfile,
          exportedAt: new Date().toISOString(),
          version: '2.0.0',
        });
      } catch (backupErr) {
        console.warn('Auto cloud backup notice:', backupErr);
      }

      setCurrentPage(1);
      fetchPagedTransactions(1, pageSize);
      showToast('အရောင်းအဝယ် စာရင်းကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။', 'success');
    } catch (err: any) {
      console.error('Error in handleSaveTransaction:', err);
      showToast(`စာရင်းသိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err?.message || 'အချက်အလက်များကို စစ်ဆေးပါ'}`, 'error');
    }
  };

  // Delete Transaction Handler
  const handleDeleteTransaction = async (id: number) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setPagedTransactions((prev) => prev.filter((t) => t.id !== id));
    setTotalFilteredCount((prev) => Math.max(0, prev - 1));
    await deleteTransactionById(id);
    fetchPagedTransactions(currentPage, pageSize);
    showToast('စာရင်းကို ဖျက်ပြီးပါပြီ။', 'info');
  };

  // Cash Account Management Handlers
  const handleAddCashAccount = async (newAcc: Omit<CashAccountItem, 'id'>) => {
    const item: CashAccountItem = {
      ...newAcc,
      id: Date.now(),
    };
    const nextList = [...cashAccounts, item];
    setCashAccounts(nextList);
    await saveCashAccountsToDB(nextList);
  };

  const handleUpdateCashAccount = async (updated: CashAccountItem) => {
    const nextList = cashAccounts.map((c) => (c.id === updated.id ? updated : c));
    setCashAccounts(nextList);
    await saveCashAccountsToDB(nextList);
  };

  const handleDeleteCashAccount = async (id: number) => {
    const nextList = cashAccounts.filter((c) => c.id !== id);
    setCashAccounts(nextList);
    await saveCashAccountsToDB(nextList);
  };

  // Wallet Management Handlers
  const handleAddWallet = async (newWallet: Omit<WalletItem, 'id'>) => {
    const item: WalletItem = {
      ...newWallet,
      id: Date.now(),
    };
    const nextList = [...wallets, item];
    setWallets(nextList);
    await saveWalletsToDB(nextList);
  };

  const handleUpdateWallet = async (updated: WalletItem) => {
    const nextList = wallets.map((w) => (w.id === updated.id ? updated : w));
    setWallets(nextList);
    await saveWalletsToDB(nextList);
  };

  const handleDeleteWallet = async (id: number) => {
    const nextList = wallets.filter((w) => w.id !== id);
    setWallets(nextList);
    await saveWalletsToDB(nextList);
  };

  // Shop Profile Save Handler
  const handleSaveShopProfile = async (newProfile: ShopProfile) => {
    setShopProfile(newProfile);
    await saveShopProfileToDB(newProfile);
    localStorage.setItem('app_shop_profile', JSON.stringify(newProfile));
  };

  const handleResetToZero = async () => {
    if (
      confirm(
        '⚠️ သတိပေးချက်: စာရင်းမှတ်တမ်း (Transactions) အားလုံးကို ဖျက်ပစ်ပြီး လက်ငင်းငွေသားနှင့် Wallet လက်ကျန်ငွေများ အားလုံးကို 0 ချပါမည်။ သေချာပါသလား?'
      )
    ) {
      await resetAllDataDB(todayStr);
      const resetCash = cashAccounts.map((c) => ({ ...c, balance: 0, updatedDate: todayStr }));
      const resetWallets = wallets.map((w) => ({ ...w, balance: 0, updatedDate: todayStr }));
      setCashAccounts(resetCash);
      setWallets(resetWallets);
      setTransactions([]);
      setPagedTransactions([]);
      setTotalFilteredCount(0);
      setTotalPages(1);
      showToast('ဒေတာများ အားလုံးကို ရှင်းလင်းပြီး လက်ကျန်ငွေများ 0 သို့ သတ်မှတ်ပြီးပါပြီ။', 'success');
    }
  };

  // Capacitor & Web Backup Export Handler
  const handleBackup = async (shareDirectly: boolean = false) => {
    setIsExporting(true);
    try {
      const backupData: BackupData = {
        cashAccounts,
        cashBalance: totalCashBalance,
        wallets,
        transactions,
        shopProfile,
        exportedAt: new Date().toISOString(),
        version: '2.0.0',
      };

      const result = await exportBackupData(backupData, shareDirectly);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast('Backup လုပ်ဆောင်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ' + (err?.message || ''), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readBackupFromFile(file);
      setPendingRestoreData(data);
    } catch (err: any) {
      showToast('Restore ဖိုင်ဖတ်၍ မရပါ: ' + (err?.message || ''), 'error');
    }
  };

  const handleConfirmRestore = async (data: BackupData) => {
    try {
      await restoreDatabasePayload(data);

      setCashAccounts(data.cashAccounts || []);
      setWallets(data.wallets || []);
      setTransactions(data.transactions || []);
      if (data.shopProfile) setShopProfile(data.shopProfile);

      setPendingRestoreData(null);
      fetchPagedTransactions(1, pageSize);
      showToast('Backup ဒေတာများကို အောင်မြင်စွာ Restore ပြန်လည်ထည့်သွင်းပြီးပါပြီ။', 'success');
    } catch (e: any) {
      showToast('Restore ပြုလုပ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ' + (e?.message || ''), 'error');
    }
  };

  const handlePurgeArchived = async (retainedTransactions: Transaction[], purgedCount: number) => {
    setTransactions(retainedTransactions);
    setShowArchiveModal(false);
    fetchPagedTransactions(1, pageSize);
    showToast(`စာရင်းဟောင်း (${purgedCount}) ခု အား ဖျက်ထုတ်ပြီး SQLite Database ကို Compact ရှင်းလင်းပြီးပါပြီ။`, 'success');
  };

  // If Not Activated, Show License Screen
  if (!isActivated) {
    return (
      <LicenseLockScreen
        deviceId={deviceId}
        onActivated={() => {
          setIsActivated(true);
          const savedProfile = localStorage.getItem('app_shop_profile');
          if (savedProfile) {
            try {
              setShopProfile(JSON.parse(savedProfile));
            } catch (e) {}
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased p-2.5 sm:p-4 md:p-6 lg:p-8 flex flex-col justify-start transition-colors duration-200 relative overflow-x-hidden">
      <MetallicWaveBackground />
      <div className="w-full max-w-7xl mx-auto space-y-4 md:space-y-6 flex-1 flex flex-col relative z-10">
        {/* TOP HEADER */}
        <header className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 md:gap-4 transition-colors">
          <div className="flex items-center gap-3 md:gap-3.5">
            {shopProfile.logoUrl ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                <img src={shopProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>{shopProfile.shopName || 'Money Agent POS'}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                  PRO
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>
                  {shopProfile.phone
                    ? `${shopProfile.phone} • ${todayStr}`
                    : `ငွေသွင်း/ငွေထုတ် & Wallet လွှဲပြောင်း စီမံခန့်ခွဲမှုစနစ် • ${todayStr}`}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                  <Database className="w-2.5 h-2.5" /> SQLite Indexed DB
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* 1. License & 3-Day Free Trial Badge Button */}
            <button
              onClick={() => setShowLicenseModal(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                licenseStatus.isPermanent
                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700 ring-1 ring-amber-300/50 animate-pulse'
              }`}
              title="လိုင်စင်နှင့် အစမ်းသုံးစွဲမှု အခြေအနေ (License Dashboard)"
            >
              {licenseStatus.isPermanent ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Full License</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    အစမ်း ၃ ရက် (
                    {licenseStatus.remainingDays > 0
                      ? `${licenseStatus.remainingDays}ရက်ကျန်`
                      : `${licenseStatus.remainingHours || 0}နာရီကျန်`}
                    )
                  </span>
                </>
              )}
            </button>

            {/* 2. Bluetooth Thermal Printer Button */}
            <button
              onClick={() => setShowBluetoothModal(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                btStatus.isConnected
                  ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60'
              }`}
              title="Bluetooth Thermal Receipt Printer ချိတ်ဆက်ရန်"
            >
              <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{btStatus.isConnected ? 'BT Printer ချိတ်ပြီး' : 'BT Printer'}</span>
            </button>

            <button
              onClick={() => setShowShopProfileModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
              title="ဆိုင် / လုပ်ငန်း Profile ပြင်ဆင်ရန်"
            >
              <Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>ဆိုင် Profile</span>
            </button>

            <button
              onClick={() => {
                setSelectedReportDate(todayStr);
                setSelectedWalletFilter('all');
                setSelectedCashFilter('all');
                setShowAllTransactionsModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>စာရင်းချုပ် အားလုံး</span>
            </button>

            {/* Dark / Light Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
              title={theme === 'dark' ? 'Light Theme သို့ ပြောင်းရန်' : 'Dark Theme သို့ ပြောင်းရန်'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* PRIMARY ACTION BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <button
            onClick={() => {
              setTransactionModalType('သွင်း');
              setShowTransactionModal(true);
            }}
            className="flex items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer border border-emerald-400/30 text-sm sm:text-base"
          >
            <ArrowDownRight className="w-5 h-5" />
            <span>ငွေသွင်း (Cash In)</span>
          </button>

          <button
            onClick={() => {
              setTransactionModalType('ထုတ်');
              setShowTransactionModal(true);
            }}
            className="flex items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold shadow-lg shadow-red-600/20 active:scale-[0.99] transition-all cursor-pointer border border-red-400/30 text-sm sm:text-base"
          >
            <ArrowUpRight className="w-5 h-5" />
            <span>ငွေထုတ် (Cash Out)</span>
          </button>
        </div>

        {/* SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* 1. Total Physical Cash in Hand */}
          <div
            onClick={() => {
              setSelectedReportDate(todayStr);
              setSelectedCashFilter('all');
              setShowCashReport(true);
            }}
            className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-600 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">💵 လက်ငင်းငွေသား စုစုပေါင်း</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {formatKs(totalCashBalance)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                ငွေပုံး {cashAccounts.length} ခု • {formatLakh(totalCashBalance)}
              </div>
            </div>
          </div>

          {/* 2. Total E-Money Wallets */}
          <div
            onClick={() => {
              setSelectedReportDate(todayStr);
              setSelectedWalletFilter('all');
              setShowWalletReport(true);
            }}
            className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🏦 Wallet လက်ကျန် စုစုပေါင်း</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {formatKs(totalWalletBalance)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                အကောင့် {wallets.length} ခု • {formatLakh(totalWalletBalance)}
              </div>
            </div>
          </div>

          {/* 3. Total Combined Capital */}
          <div
            onClick={() => {
              setSelectedReportDate(todayStr);
              setShowTotalAccountsReport(true);
            }}
            className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">💎 မတည်ရင်းနှီးငွေ စုစုပေါင်း</span>
              <div className="p-2 bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-xl group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {formatKs(totalCapital)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                ငွေသား + Wallet • {formatLakh(totalCapital)}
              </div>
            </div>
          </div>

          {/* 4. Today Total Commission */}
          <div
            onClick={() => {
              setSelectedReportDate(todayStr);
              setShowCommissionReport(true);
            }}
            className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-600 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">📈 ယနေ့ရရှိသော ကော်မရှင်</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl md:text-2xl font-black text-amber-800 dark:text-amber-400 tracking-tight">
                +{formatKs(todayCommission)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                💵 ငွေသား: +{formatKs(todayCashComm)} • 📱 Wallet: +{formatKs(todayWalletComm)}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: CASH DRAWERS & WALLETS DETAIL LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Cash In Hand Drawers & Safe Boxes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    လက်ငင်းငွေသား အကောင့်များ (Cash Drawers & Boxes)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    စုစုပေါင်း {cashAccounts.length} ခု • {formatKs(totalCashBalance)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCashEditModal(true)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700 flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>စီမံရန်</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cashAccounts.map((account) => {
                const colorStyle = getAccountColorStyle(account.colorTheme || 'emerald');
                return (
                  <div
                    key={account.id}
                    className={`p-3 rounded-xl border ${colorStyle.className} flex flex-col justify-between space-y-1.5 transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-black ${colorStyle.textClass} truncate`}>{account.name}</span>
                      {account.note && (
                        <span className="text-[10px] text-slate-400 bg-white/70 dark:bg-slate-800/70 px-1.5 py-0.5 rounded shrink-0">
                          {account.note}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm sm:text-base font-black ${colorStyle.textClass}`}>
                        {formatKs(account.balance)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatLakh(account.balance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Wallets Accounts List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Wallet အကောင့်များ (E-Money Accounts)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    စုစုပေါင်း {wallets.length} ခု • {formatKs(totalWalletBalance)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWalletModal(true)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700 flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>စီမံရန်</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {wallets.map((wallet) => {
                const colorStyle = getAccountColorStyle(wallet.colorTheme || 'indigo');
                return (
                  <div
                    key={wallet.id}
                    className={`p-3 rounded-xl border ${colorStyle.className} flex flex-col justify-between space-y-1.5 transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-black ${colorStyle.textClass} truncate`}>{wallet.name}</span>
                      {wallet.accountNumber && (
                        <span className="text-[10px] text-slate-400 font-mono bg-white/70 dark:bg-slate-800/70 px-1.5 py-0.5 rounded shrink-0">
                          {wallet.accountNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm sm:text-base font-black ${colorStyle.textClass}`}>
                        {formatKs(wallet.balance)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatLakh(wallet.balance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION: TODAY / FILTERED RECENT TRANSACTIONS (PAGINATED WITH SQLITE) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5 transition-colors">
          {/* Header & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>အရောင်းအဝယ် စာရင်းမှတ်တမ်းများ (Transactions Ledger)</span>
                  {isDBLoading && <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
                </h3>
                <p className="text-[11px] text-slate-400">
                  SQLite Index ဖြင့် ရှာဖွေမှု အမြန်နှုန်း မြှင့်တင်ထားပြီး တစ်ကြိမ်လျှင် <b>{pageSize}</b> စင်း စီ ထုတ်ပြသနေပါသည်
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Export PDF & Share */}
              <button
                onClick={handleLedgerExportPdf}
                disabled={isLedgerExportingPdf}
                className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 sm:gap-1.5"
                title="PDF ဖိုင်အဖြစ် ထုတ်ယူပြီး ဖုန်းထဲသိမ်းဆည်း / Share လုပ်မည်"
              >
                {isLedgerExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span className="inline sm:hidden">PDF</span>
                <span className="hidden sm:inline">Export PDF</span>
                <Share2 className="w-3 h-3 opacity-80 hidden md:inline" />
              </button>

              {/* Excel (.xlsx) */}
              <button
                onClick={handleLedgerExportExcel}
                disabled={isLedgerExportingExcel}
                className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 disabled:opacity-50"
                title="Excel (.xlsx) Unicode ဖြင့် ထုတ်ယူမည်"
              >
                {isLedgerExportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>Excel</span>
              </button>

              {/* Print (Page Setup) */}
              <button
                onClick={handleLedgerPrint}
                className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5"
                title="ပရင့်ထုတ်ရန် Page Setup ဖွင့်မည်"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Print</span>
              </button>

              {/* OCR Slip Scanner */}
              <button
                onClick={() => setShowLedgerOcrScanner(true)}
                className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5"
                title="OCR Slip Voucher Scanner"
              >
                <ScanLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="inline md:hidden">OCR</span>
                <span className="hidden md:inline">OCR Slip</span>
              </button>

              {/* View Switcher: Card vs Table */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                <button
                  onClick={() => setMainViewMode('card')}
                  className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    mainViewMode === 'card'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="ကတ်ပြားပုံစံ"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Card</span>
                </button>
                <button
                  onClick={() => setMainViewMode('table')}
                  className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    mainViewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="ဇယားပုံစံ"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">ဇယား</span>
                </button>
              </div>
            </div>
          </div>

          {/* FILTER TOOLBAR */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs">
            {/* 1. Date Filter */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <select
                value={mainDateFilter}
                onChange={(e) => handleFilterChange(setMainDateFilter, e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="ALL">📅 ရက်စွဲ အားလုံး (All)</option>
                <option value="TODAY">ယနေ့ ({todayStr})</option>
              </select>
            </div>

            {/* 2. Wallet Filter */}
            <div className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <select
                value={mainWalletFilter}
                onChange={(e) => handleFilterChange(setMainWalletFilter, e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="all">🏦 Wallet အားလုံး</option>
                <option value="none">မပါဝင်သော စာရင်းများ</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Cash Filter */}
            <div className="flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <select
                value={mainCashFilter}
                onChange={(e) => handleFilterChange(setMainCashFilter, e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="all">💵 ငွေသားပုံး အားလုံး</option>
                <option value="none">မပါဝင်သော စာရင်းများ</option>
                {cashAccounts.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Type Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <select
                value={mainTypeFilter}
                onChange={(e) => handleFilterChange(setMainTypeFilter, e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="all">အမျိုးအစား အားလုံး</option>
                <option value="သွင်း">ငွေသွင်း</option>
                <option value="ထုတ်">ငွေထုတ်</option>
                <option value="လွှဲပြောင်း">လွှဲပြောင်း</option>
              </select>
            </div>

            {/* 5. Search Bar */}
            <div className="relative flex-1 min-w-[150px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ဖောက်သည်၊ ဖုန်း၊ အကောက် ရှာရန်..."
                value={mainSearchQuery}
                onChange={(e) => handleFilterChange(setMainSearchQuery, e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* VIEW 1: RESPONSIVE CARDS VIEW */}
          {mainViewMode === 'card' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pagedTransactions.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-xs">
                    ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော အရောင်းအဝယ် စာရင်း မရှိပါ။
                  </div>
                ) : (
                  pagedTransactions.map((item, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index;
                    const isCashOut = item.type === 'ထုတ်';
                    const isTransfer = item.type === 'လွှဲပြောင်း';
                    const actualCash = getActualCash(item);
                    const { cashComm, walletComm } = getCommissionBreakdown(item);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl shadow-xs space-y-2.5 transition-all flex flex-col justify-between"
                      >
                        {/* Top Row: Customer & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                                {globalIndex + 1}. {item.customerName}
                              </span>
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                  isTransfer
                                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                    : isCashOut
                                    ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
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

                          <button
                            onClick={() => setActiveReceipt(item)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                          >
                            ဘောက်ချာ
                          </button>
                        </div>

                        {/* Amounts */}
                        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                              {isTransfer ? 'လွှဲပြောင်းငွေ:' : 'လက်ငင်းငွေ:'}
                            </span>
                            <span
                              className={`text-sm font-black ${
                                isTransfer
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : isCashOut
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {isTransfer
                                ? formatKs(item.amount)
                                : isCashOut
                                ? `- ${actualCash.toLocaleString('en-US')}`
                                : `+ ${actualCash.toLocaleString('en-US')}`}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                              {isTransfer ? 'လွှဲခ/ဝန်ဆောင်ခ:' : 'မူလလွှဲငွေ:'}
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {isTransfer ? `+${formatKs(item.commission)}` : item.amount.toLocaleString('en-US')}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">💵 ငွေသားကော်မရှင်:</span>
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {cashComm > 0 ? `+${cashComm.toLocaleString('en-US')}` : '-'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold block">📱 Walletကော်မရှင်:</span>
                            <span className="font-bold text-purple-700 dark:text-purple-400">
                              {walletComm > 0 ? `+${walletComm.toLocaleString('en-US')}` : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Accounts Used */}
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-1">
                            {isTransfer ? (
                              <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded font-semibold text-[10px]">
                                🔄 {item.walletName} ➔ {item.targetWalletName || '-'}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold text-[10px]">
                                🏦 {item.walletName}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded font-semibold text-[10px]">
                              💵 {item.cashAccountName || 'ဆိုင်ရှေ့ငွေပုံး'}
                            </span>
                          </div>

                          {item.note && (
                            <span className="text-[10px] text-slate-400 italic truncate max-w-[120px]">
                              {item.note}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalFilteredCount > 0 && (
                <div className="p-3.5 bg-slate-900 dark:bg-slate-950 text-white rounded-xl shadow-lg border border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-300">📊 စာရင်းမှတ်တမ်းပေါင်း:</span>
                      <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold text-xs">{totalFilteredCount} ခု</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">စုစုပေါင်း Amount ပေါင်း (Total Volume):</span>
                      <span className="font-black text-indigo-300 text-sm">{formatKs(mainTotalAmount)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-emerald-300 block">📥 စုစုပေါင်း ငွေသွင်း Amount:</span>
                      <span className="font-black text-emerald-400">+{formatKs(mainTotalIn)}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-rose-300 block">📤 စုစုပေါင်း ငွေထုတ် Amount:</span>
                      <span className="font-black text-rose-400">-{formatKs(mainTotalOut)}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-sky-300 block">🔄 စုစုပေါင်း လွှဲပြောင်း Amount:</span>
                      <span className="font-black text-sky-400">{formatKs(mainTotalTransfer)}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-amber-300 block">💵 ငွေသား ကော်မရှင်:</span>
                      <span className="font-bold text-amber-300">+{formatKs(mainTotalCashComm)}</span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-purple-300 block">📱 Wallet ကော်မရှင်:</span>
                      <span className="font-bold text-purple-300">+{formatKs(mainTotalWalletComm)}</span>
                    </div>
                    <div className="bg-indigo-950/90 p-2 rounded-lg border border-indigo-500/40">
                      <span className="text-[10px] text-emerald-300 font-bold block">✨ စုစုပေါင်း ကော်မရှင်:</span>
                      <span className="font-black text-emerald-300">+{formatKs(mainGrandTotalComm)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGINATION CONTROLS (30 Items Per Page Default) */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalFilteredCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                isLoading={isDBLoading}
              />
            </div>
          )}

          {/* VIEW 2: TABLE VIEW */}
          {mainViewMode === 'table' && (
            <div className="space-y-2">
              {/* Horizontal Scroll Hint for Mobile/Tablet */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] bg-indigo-50/90 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  <span>👉 ဘေးသို့ ဆွဲရွှေ့ပြီး ဇယားအပြည့်အစုံ ကြည့်ရှုနိုင်ပါသည် (Swipe left/right)</span>
                </div>
                <span className="text-slate-400 font-medium text-[11px] hidden sm:inline">
                  စာရင်း စုစုပေါင်း: {totalFilteredCount} ခု
                </span>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[58vh] sm:max-h-[64vh] overscroll-contain border border-slate-200/80 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-xs text-left border-collapse min-w-[850px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-2xs">
                    <tr>
                      <th className="p-2.5 whitespace-nowrap min-w-[44px]">စဉ်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[120px]">နေ့စွဲ/အချိန်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px]">ဖောက်သည် အမည်</th>
                      <th className="p-2.5 text-center whitespace-nowrap min-w-[90px]">အမျိုးအစား</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[130px]">လက်ငင်း/လွှဲငွေ (Ks)</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[120px] bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">💵 ငွေသားကော်မရှင်</th>
                      <th className="p-2.5 text-right whitespace-nowrap min-w-[120px] bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300">📱 Walletကော်မရှင်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[110px]">ဖုန်းနံပါတ်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[130px]">Wallet အကောက်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[120px]">ငွေသားအကောက်</th>
                      <th className="p-2.5 whitespace-nowrap min-w-[105px]">OCR/Ref</th>
                      <th className="p-2.5 text-center whitespace-nowrap min-w-[80px]">ပြေစာ</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pagedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-slate-400 dark:text-slate-500 font-medium">
                        ရွေးချယ်ထားသော စံနှုန်းများနှင့် ကိုက်ညီသော ဒေတာ မရှိပါ။
                      </td>
                    </tr>
                  ) : (
                    pagedTransactions.map((item, index) => {
                      const globalIndex = (currentPage - 1) * pageSize + index;
                      const isCashOut = item.type === 'ထုတ်';
                      const isTransfer = item.type === 'လွှဲပြောင်း';
                      const actualCash = getActualCash(item);
                      const { cashComm, walletComm } = getCommissionBreakdown(item);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 text-slate-500 dark:text-slate-400">{globalIndex + 1}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.date}</span>
                            {item.time && (
                              <span className="ml-1 text-[10px] text-slate-400">({item.time})</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {item.customerName}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                isTransfer
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                  : isCashOut
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
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
                          </td>

                          {/* Actual cash given / received / transfer */}
                          <td
                            className={`p-3 text-right font-bold whitespace-nowrap ${
                              isTransfer
                                ? 'text-sky-700 dark:text-sky-400'
                                : isCashOut
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            <div>
                              {isTransfer
                                ? formatKs(item.amount)
                                : isCashOut
                                ? `- ${actualCash.toLocaleString('en-US')}`
                                : `+ ${actualCash.toLocaleString('en-US')}`}
                            </div>
                          </td>

                          {/* Cash Commission */}
                          <td className="p-3 text-right text-amber-800 dark:text-amber-300 font-bold whitespace-nowrap bg-amber-50/30 dark:bg-amber-950/20">
                            {cashComm > 0 ? `+${cashComm.toLocaleString('en-US')}` : '-'}
                          </td>

                          {/* Wallet Commission */}
                          <td className="p-3 text-right text-purple-800 dark:text-purple-300 font-bold whitespace-nowrap bg-purple-50/30 dark:bg-purple-950/20">
                            {walletComm > 0 ? `+${walletComm.toLocaleString('en-US')}` : '-'}
                          </td>

                          <td className="p-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{item.phone}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {isTransfer ? (
                              <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded font-semibold text-[11px]">
                                {item.walletName} ➔ {item.targetWalletName || '-'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold text-[11px]">
                                {item.walletName}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded font-semibold text-[11px]">
                              {item.cashAccountName || 'ဆိုင်ရှေ့ငွေပုံး'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-mono text-[11px]">
                              {item.ocrRef || `TXN-${item.id}`}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setActiveReceipt(item)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-750 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-750"
                            >
                              ဘောက်ချာ
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {totalFilteredCount > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 sticky bottom-0 z-20 shadow-md">
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        📊 စုစုပေါင်း ({totalFilteredCount} ခု) Total:
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {formatKs(mainTotalAmount)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          (သွင်း: +{formatKs(mainTotalIn)} | ထုတ်: -{formatKs(mainTotalOut)} | လွှဲ: {formatKs(mainTotalTransfer)})
                        </div>
                        <div className={`text-[10px] font-bold ${mainNetCash >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                          ငွေသားစီးဆင်းမှု: {mainNetCash >= 0 ? `+${formatKs(mainNetCash)}` : `-${formatKs(Math.abs(mainNetCash))}`}
                        </div>
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/30 font-black">
                        +{formatKs(mainTotalCashComm)}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap text-purple-800 dark:text-purple-300 bg-purple-100/50 dark:bg-purple-950/30 font-black">
                        +{formatKs(mainTotalWalletComm)}
                      </td>
                      <td colSpan={4} className="p-2.5 whitespace-nowrap text-indigo-950 dark:text-indigo-200">
                        👉 စုစုပေါင်း ကော်မရှင်: <b className="text-emerald-600 dark:text-emerald-400 text-xs">+{formatKs(mainGrandTotalComm)}</b>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* PAGINATION CONTROLS */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalFilteredCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              isLoading={isDBLoading}
            />
          </div>
        )}
        </div>

        {/* DATA MAINTENANCE, ARCHIVE & BACKUP / RESTORE FOOTER CARD */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                💾 စနစ်ထိန်းသိမ်းမှု၊ အစီရင်ခံစာနှင့် Backup / Restore စနစ်
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                Reconcile ရှင်းတမ်းများ၊ လချုပ် Flow၊ စာရင်းဟောင်း Archive နှင့် Backup/Restore များကို တနေရာတည်းတွင် ဆောင်ရွက်နိုင်ပါသည်
              </p>
            </div>
          </div>

          {/* UNIFIED COMPACT TOOLBAR: 1 ROW ON DESKTOP (LG:GRID-COLS-8), 4 COLS ON TABLET, 2 COLS ON MOBILE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
            {/* 1. Cash Reconcile */}
            <button
              onClick={() => {
                setSelectedReportDate(todayStr);
                setShowCashReconcileReport(true);
              }}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="ငွေသားအကောင့်များ၏ ဝင်ငွေ/ထွက်ငွေ နှင့် Net Amount အသေးစိတ် ရှင်းတမ်း"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Cash Reconcile</span>
            </button>

            {/* 2. Wallet Reconcile */}
            <button
              onClick={() => {
                setSelectedReportDate(todayStr);
                setShowWalletReconcileReport(true);
              }}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="Wallet များ၏ ဝင်ငွေ/ထွက်ငွေ နှင့် Net Amount အသေးစိတ် ရှင်းတမ်း"
            >
              <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Wallet Reconcile</span>
            </button>

            {/* 3. Monthly Flow */}
            <button
              onClick={() => setShowMonthlyFlowReport(true)}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="SUMMARY OF MONTHLY CASH FLOW STATEMENT - တစ်လချင်းစီ၏ ရက်အလိုက် ငွေသား နှင့် Wallet ဝင်/ထွက် ရှင်းတမ်း"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Monthly Flow</span>
            </button>

            {/* 4. Archive */}
            <button
              onClick={() => setShowArchiveModal(true)}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="လွန်ခဲ့သော ၆ လ/၁ နှစ် စာရင်းဟောင်းများကို ခွဲထုတ်သိမ်းဆည်းပြီး Database ကို Compact ရှင်းလင်းမည်"
            >
              <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Archive</span>
            </button>

            {/* 5. Full Backup */}
            <button
              onClick={() => handleBackup(false)}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap disabled:opacity-50"
              title="JSON Backup ဖိုင်ကို ဒေါင်းလုဒ်/သိမ်းဆည်းမည်"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" /> : <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              <span>Backup</span>
            </button>

            {/* 6. Share Backup */}
            <button
              onClick={() => handleBackup(true)}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap disabled:opacity-50"
              title="Drive, Telegram, Viber, Files သို့ တိုက်ရိုက် Share လုပ်မည်"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />}
              <span>Share</span>
            </button>

            {/* 7. Restore */}
            <button
              onClick={handleRestoreClick}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="သိမ်းဆည်းထားသော JSON Backup ဖိုင်ကို ရွေးချယ်ပြီး Restore ပြန်သွင်းမည်"
            >
              <Upload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Restore</span>
            </button>

            {/* 8. Reset to Zero */}
            <button
              onClick={handleResetToZero}
              className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[40px] whitespace-nowrap"
              title="အရောင်းအဝယ် စာရင်းအားလုံး ရှင်းထုတ်ပြီး လက်ကျန်ငွေ 0 သို့ Reset ချမည်"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Reset (၀)</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION CONTAINER */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}
          <div className="text-xs font-medium leading-relaxed flex-1">{toast.message}</div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Restore Confirmation Modal */}
      {pendingRestoreData && (
        <RestoreConfirmModal
          data={pendingRestoreData}
          onConfirm={handleConfirmRestore}
          onCancel={() => setPendingRestoreData(null)}
        />
      )}

      {/* 1. Transaction Modal (Cash In / Cash Out / Wallet to Wallet) */}
      {showTransactionModal && (
        <TransactionModal
          initialType={transactionModalType}
          wallets={wallets}
          cashAccounts={cashAccounts}
          onClose={() => setShowTransactionModal(false)}
          onSave={handleSaveTransaction}
        />
      )}

      {/* 2. Wallet Management Modal */}
      {showWalletModal && (
        <WalletModal
          wallets={wallets}
          onClose={() => setShowWalletModal(false)}
          onAddWallet={handleAddWallet}
          onUpdateWallet={handleUpdateWallet}
          onDeleteWallet={handleDeleteWallet}
        />
      )}

      {/* 3. Cash In Hand / Drawers Management Modal */}
      {showCashEditModal && (
        <CashEditModal
          cashAccounts={cashAccounts}
          onClose={() => setShowCashEditModal(false)}
          onAddAccount={handleAddCashAccount}
          onUpdateAccount={handleUpdateCashAccount}
          onDeleteAccount={handleDeleteCashAccount}
        />
      )}

      {/* 4. Shop Profile Modal */}
      {showShopProfileModal && (
        <ShopProfileModal
          initialProfile={shopProfile}
          onSave={handleSaveShopProfile}
          onClose={() => setShowShopProfileModal(false)}
        />
      )}

      {/* 5. Wallet Report Modal */}
      {showWalletReport && (
        <ReportModal
          title="🏦 Wallet Transaction အသေးစိတ် Report"
          icon={<Wallet className="w-5 h-5" />}
          onClose={() => setShowWalletReport(false)}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          wallets={wallets}
          selectedWalletFilter={selectedWalletFilter}
          setSelectedWalletFilter={setSelectedWalletFilter}
          cashAccounts={cashAccounts}
          selectedCashFilter={selectedCashFilter}
          setSelectedCashFilter={setSelectedCashFilter}
          data={filterList()}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 6. Cash Report Modal */}
      {showCashReport && (
        <ReportModal
          title="💵 လက်ငင်းငွေသား (Cash) Transaction Report"
          icon={<Banknote className="w-5 h-5" />}
          onClose={() => setShowCashReport(false)}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          wallets={wallets}
          selectedWalletFilter={selectedWalletFilter}
          setSelectedWalletFilter={setSelectedWalletFilter}
          cashAccounts={cashAccounts}
          selectedCashFilter={selectedCashFilter}
          setSelectedCashFilter={setSelectedCashFilter}
          data={filterList()}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 7. Commission Report Modal */}
      {showCommissionReport && (
        <ReportModal
          title="📈 ကော်မရှင်ခ စာရင်း အသေးစိတ် Report"
          icon={<TrendingUp className="w-5 h-5" />}
          onClose={() => setShowCommissionReport(false)}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          wallets={wallets}
          selectedWalletFilter={selectedWalletFilter}
          setSelectedWalletFilter={setSelectedWalletFilter}
          cashAccounts={cashAccounts}
          selectedCashFilter={selectedCashFilter}
          setSelectedCashFilter={setSelectedCashFilter}
          data={filterList()}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 8. All Transactions Modal */}
      {showAllTransactionsModal && (
        <ReportModal
          title="📋 စာရင်းချုပ် အားလုံး (All Transactions Ledger)"
          icon={<FileSpreadsheet className="w-5 h-5" />}
          onClose={() => setShowAllTransactionsModal(false)}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          wallets={wallets}
          selectedWalletFilter={selectedWalletFilter}
          setSelectedWalletFilter={setSelectedWalletFilter}
          cashAccounts={cashAccounts}
          selectedCashFilter={selectedCashFilter}
          setSelectedCashFilter={setSelectedCashFilter}
          data={filterList()}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 9. Voucher Receipt View */}
      {activeReceipt && (
        <TransactionReceiptModal
          transaction={activeReceipt}
          shopProfile={shopProfile}
          onClose={() => setActiveReceipt(null)}
          onOpenBluetoothModal={() => setShowBluetoothModal(true)}
        />
      )}

      {/* 10. Total All Accounts Balance Comprehensive Ledger Report Modal */}
      {showTotalAccountsReport && (
        <TotalAccountsReportModal
          onClose={() => setShowTotalAccountsReport(false)}
          wallets={wallets}
          cashAccounts={cashAccounts}
          transactions={transactions}
          shopProfile={shopProfile}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
        />
      )}

      {/* 11. Cash Reconcile Report Modal */}
      {showCashReconcileReport && (
        <CashReconcileModal
          onClose={() => setShowCashReconcileReport(false)}
          cashAccounts={cashAccounts}
          transactions={transactions}
          shopProfile={shopProfile}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 12. Wallet Reconcile Report Modal */}
      {showWalletReconcileReport && (
        <WalletReconcileModal
          onClose={() => setShowWalletReconcileReport(false)}
          wallets={wallets}
          transactions={transactions}
          shopProfile={shopProfile}
          selectedReportDate={selectedReportDate}
          setSelectedReportDate={setSelectedReportDate}
          onDeleteTransaction={handleDeleteTransaction}
          onViewReceipt={(tx) => setActiveReceipt(tx)}
        />
      )}

      {/* 13. Monthly Cash and Wallet Flow Report Modal */}
      {showMonthlyFlowReport && (
        <MonthlyCashWalletFlowReportModal
          onClose={() => setShowMonthlyFlowReport(false)}
          wallets={wallets}
          cashAccounts={cashAccounts}
          transactions={transactions}
          shopProfile={shopProfile}
        />
      )}

      {/* 14. Archive & Maintenance Modal */}
      {showArchiveModal && (
        <ArchiveMaintenanceModal
          transactions={transactions}
          onClose={() => setShowArchiveModal(false)}
          onPurgeArchived={handlePurgeArchived}
          onShowToast={showToast}
        />
      )}

      {/* 15. Wi-Fi Network Mode (Master / Client) Settings Modal */}
      {showNetworkModal && (
        <NetworkSettingsModal
          onClose={() => setShowNetworkModal(false)}
          onShowToast={showToast}
          onConfigChanged={async (newCfg) => {
            setNetworkConfig(newCfg);
            setIsDBLoading(true);
            try {
              await initSQLiteDatabase();
              const [dbCash, dbWallets, dbProfile, allTx] = await Promise.all([
                getCashAccountsFromDB(),
                getWalletsFromDB(),
                getShopProfileFromDB(),
                getAllFilteredTransactions(),
              ]);
              if (dbCash && dbCash.length > 0) setCashAccounts(dbCash);
              if (dbWallets && dbWallets.length > 0) setWallets(dbWallets);
              if (dbProfile) setShopProfile(dbProfile);
              setTransactions(allTx || []);
              await fetchPagedTransactions(1, pageSize);
              setCurrentPage(1);
              showToast(
                newCfg.mode === 'server'
                  ? '🟢 Master Server Mode သို့ ပြောင်းလဲပြီး ဒေတာများ ချိတ်ဆက်ပြီးပါပြီ'
                  : `🔵 Client Mode: ${newCfg.masterServerIp} သို့ ချိတ်ဆက်ပြီးပါပြီ`,
                'success'
              );
            } catch (err: any) {
              showToast(err?.message || 'ဒေတာ ဆွဲယူမှု မအောင်မြင်ပါ', 'error');
            } finally {
              setIsDBLoading(false);
            }
          }}
        />
      )}

      {/* 16. App License & 3-Day Free Trial Dashboard Modal */}
      {showLicenseModal && (
        <LicenseDashboardModal
          onClose={() => setShowLicenseModal(false)}
          licenseStatus={licenseStatus}
          onActivated={() => {
            const status = getAppLicenseStatus();
            setLicenseStatus(status);
            setIsActivated(status.canAccessApp);
            showToast('လိုင်စင် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။', 'success');
          }}
          onShowToast={showToast}
        />
      )}

      {/* 17. Cloud Auto-Backup & Sync Management Modal */}
      {showCloudBackupModal && (
        <CloudBackupModal
          onClose={() => setShowCloudBackupModal(false)}
          currentBackupData={{
            cashAccounts,
            cashBalance: totalCashBalance,
            wallets,
            transactions,
            shopProfile,
            exportedAt: new Date().toISOString(),
            version: '2.0.0',
          }}
          onRestoreSnapshot={async (snapshot) => {
            try {
              await restoreDatabasePayload(snapshot.data);
              setCashAccounts(snapshot.data.cashAccounts || []);
              setWallets(snapshot.data.wallets || []);
              setTransactions(snapshot.data.transactions || []);
              if (snapshot.data.shopProfile) setShopProfile(snapshot.data.shopProfile);
              await fetchPagedTransactions(1, pageSize);
              setCurrentPage(1);
              showToast(`Cloud Backup Snapshot (${snapshot.timestamp}) အား အောင်မြင်စွာ Restore ပြန်လည်ရယူပြီးပါပြီ။`, 'success');
            } catch (err: any) {
              showToast('Cloud Snapshot Restore ပြုလုပ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ' + (err?.message || ''), 'error');
            }
          }}
          onShowToast={showToast}
        />
      )}

      {/* 18. Bluetooth Thermal Receipt Printer Modal */}
      {showBluetoothModal && (
        <BluetoothPrinterModal
          onClose={() => {
            setShowBluetoothModal(false);
            setBtStatus(getBluetoothConnectionStatus());
          }}
          shopProfile={shopProfile}
          onShowToast={showToast}
        />
      )}

      {/* 19. Bottom Transaction Ledger Print Preview Modal */}
      {showLedgerPrintPreview && ledgerReportOptions && (
        <PrintPreviewModal
          isOpen={showLedgerPrintPreview}
          onClose={() => setShowLedgerPrintPreview(false)}
          reportOptions={ledgerReportOptions}
        />
      )}

      {/* 20. Bottom Transaction Ledger OCR Slip Scanner Modal */}
      {showLedgerOcrScanner && (
        <OcrSlipScannerModal
          isOpen={showLedgerOcrScanner}
          onClose={() => setShowLedgerOcrScanner(false)}
          onApplyTransaction={(data) => {
            showToast(
              `OCR Slip အချက်အလက်များ ဖတ်ရှုပြီးပါပြီ: ${data.amount ? formatKs(data.amount) + ' Ks' : ''} ${data.txnId ? `(Ref: ${data.txnId})` : ''}`,
              'success'
            );
          }}
        />
      )}
    </div>
  );
}
