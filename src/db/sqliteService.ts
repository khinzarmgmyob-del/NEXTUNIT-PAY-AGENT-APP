import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { Transaction, CashAccountItem, WalletItem, ShopProfile, BackupData } from '../types';

const DB_NAME = 'money_agent_pos_db';
const DB_VERSION = 1;

let sqliteConnection: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

// Initial Fallback / Default Data
const DEFAULT_CASH_ACCOUNTS: CashAccountItem[] = [
  { id: 1, name: 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'ကောင်တာ ၁' },
  { id: 2, name: 'ကာတာငွေသေတ္တာ (Safe Box)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'အနောက်ခန်း' },
  { id: 3, name: 'အရန်ငွေသေတ္တာ (Backup Cash)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'အရန်' },
];

const DEFAULT_WALLETS: WalletItem[] = [
  { id: 1, name: 'KPay', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '09798001122' },
  { id: 2, name: 'WaveMoney', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '09971234567' },
  { id: 3, name: 'CB Pay', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '0012903829' },
];

/**
 * Initialize SQLite Web Component if running in browser
 */
async function setupWebStore(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    try {
      if (typeof window !== 'undefined') {
        jeepSqlite(window);
        let jeepEl = document.querySelector('jeep-sqlite');
        if (!jeepEl) {
          jeepEl = document.createElement('jeep-sqlite');
          jeepEl.setAttribute('wasmPath', '/assets');
          document.body.appendChild(jeepEl);
          await customElements.whenDefined('jeep-sqlite');
        }
      }
    } catch (e) {
      console.warn('Web SQLite custom element setup note:', e);
    }
  }
}

/**
 * Initialize the SQLite database connection, tables and high-performance indexes
 */
export async function initSQLiteDatabase(): Promise<boolean> {
  if (isInitialized && dbConnection) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await setupWebStore();

      sqliteConnection = new SQLiteConnection(CapacitorSQLite);

      if (Capacitor.getPlatform() === 'web') {
        try {
          await sqliteConnection.initWebStore();
        } catch (e) {
          console.warn('initWebStore warning:', e);
        }
      }

      // Check if connection already exists
      const isConn = (await sqliteConnection.isConnection(DB_NAME, false)).result;
      if (isConn) {
        dbConnection = await sqliteConnection.retrieveConnection(DB_NAME, false);
      } else {
        dbConnection = await sqliteConnection.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          DB_VERSION,
          false
        );
      }

      await dbConnection.open();

      // Create Tables & High-Performance Indexes for Millions of Transactions
      const schemaSql = `
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY,
          date TEXT NOT NULL,
          time TEXT,
          customerName TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          commission REAL NOT NULL DEFAULT 0,
          commissionMode TEXT DEFAULT 'separate',
          commissionChannel TEXT DEFAULT 'Cash',
          commissionWalletName TEXT,
          netPayout REAL,
          phone TEXT,
          walletName TEXT NOT NULL,
          targetWalletName TEXT,
          cashAccountName TEXT,
          accountType TEXT,
          note TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cash_accounts (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          balance REAL NOT NULL DEFAULT 0,
          updatedDate TEXT,
          note TEXT,
          color TEXT
        );

        CREATE TABLE IF NOT EXISTS wallets (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          balance REAL NOT NULL DEFAULT 0,
          updatedDate TEXT,
          accountNumber TEXT,
          color TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Performance Indexes for Millions of Records
        CREATE INDEX IF NOT EXISTS idx_tx_date_id ON transactions(date DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_id ON transactions(id);
        CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(walletName, date DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_target_wallet ON transactions(targetWalletName, date DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_cash ON transactions(cashAccountName, date DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type, date DESC);
        CREATE INDEX IF NOT EXISTS idx_tx_phone ON transactions(phone);
        CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customerName);
        CREATE INDEX IF NOT EXISTS idx_tx_date_type ON transactions(date, type);
      `;

      await dbConnection.execute(schemaSql);

      // Check if migration from localStorage is needed
      await migrateLocalStorageIfEmpty();

      if (Capacitor.getPlatform() === 'web') {
        try {
          await sqliteConnection.saveToStore(DB_NAME);
        } catch (e) {
          // ignore
        }
      }

      isInitialized = true;
      return true;
    } catch (err) {
      console.error('Failed to initialize SQLite Database:', err);
      // Even if native SQLite fails on non-supported environments, we keep fallback
      isInitialized = false;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Migrate existing localStorage data into SQLite database on first initialization
 */
async function migrateLocalStorageIfEmpty(): Promise<void> {
  if (!dbConnection) return;

  try {
    const txCountRes = await dbConnection.query('SELECT COUNT(*) as count FROM transactions');
    const existingTxCount = txCountRes.values?.[0]?.count || 0;

    const cashRes = await dbConnection.query('SELECT COUNT(*) as count FROM cash_accounts');
    const existingCashCount = cashRes.values?.[0]?.count || 0;

    const walletRes = await dbConnection.query('SELECT COUNT(*) as count FROM wallets');
    const existingWalletCount = walletRes.values?.[0]?.count || 0;

    // 1. Migrate Cash Accounts if empty in DB
    if (existingCashCount === 0) {
      const savedCash = localStorage.getItem('app_cash_accounts');
      let accountsToInsert = DEFAULT_CASH_ACCOUNTS;
      if (savedCash) {
        try {
          const parsed = JSON.parse(savedCash);
          if (Array.isArray(parsed) && parsed.length > 0) {
            accountsToInsert = parsed;
          }
        } catch (e) {
          // ignore
        }
      }
      for (const acc of accountsToInsert) {
        await dbConnection.run(
          `INSERT OR REPLACE INTO cash_accounts (id, name, balance, updatedDate, note, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [acc.id, acc.name, acc.balance, acc.updatedDate || '', acc.note || '', acc.color || '']
        );
      }
    }

    // 2. Migrate Wallets if empty in DB
    if (existingWalletCount === 0) {
      const savedWallets = localStorage.getItem('app_wallets');
      let walletsToInsert = DEFAULT_WALLETS;
      if (savedWallets) {
        try {
          const parsed = JSON.parse(savedWallets);
          if (Array.isArray(parsed) && parsed.length > 0) {
            walletsToInsert = parsed;
          }
        } catch (e) {
          // ignore
        }
      }
      for (const w of walletsToInsert) {
        await dbConnection.run(
          `INSERT OR REPLACE INTO wallets (id, name, balance, updatedDate, accountNumber, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [w.id, w.name, w.balance, w.updatedDate || '', w.accountNumber || '', w.color || '']
        );
      }
    }

    // 3. Migrate Shop Profile
    const profileRes = await dbConnection.query(`SELECT value FROM settings WHERE key = 'shop_profile'`);
    if (!profileRes.values || profileRes.values.length === 0) {
      const savedProfile = localStorage.getItem('app_shop_profile');
      if (savedProfile) {
        await dbConnection.run(
          `INSERT OR REPLACE INTO settings (key, value) VALUES ('shop_profile', ?)`,
          [savedProfile]
        );
      }
    }

    // 4. Migrate Existing Transactions if empty in DB
    if (existingTxCount === 0) {
      const savedTx = localStorage.getItem('app_transactions');
      if (savedTx) {
        try {
          const parsed: Transaction[] = JSON.parse(savedTx);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await insertTransactionsBatch(parsed);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('Migration check error:', err);
  }
}

/**
 * Filter and Pagination options for querying transactions
 */
export interface QueryTransactionsOptions {
  page?: number;
  pageSize?: number;
  dateFilter?: string; // 'ALL' | 'TODAY' | 'YYYY-MM-DD'
  walletFilter?: string; // 'all' | 'none' | walletName
  cashFilter?: string; // 'all' | 'none' | cashAccountName
  typeFilter?: string; // 'all' | 'သွင်း' | 'ထုတ်' | 'လွှဲပြောင်း'
  searchQuery?: string;
  todayDate?: string;
}

export interface PagedTransactionsResult {
  transactions: Transaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  // Filtered Aggregate Stats
  totalAmount: number;
  totalCommission: number;
  netCash: number;
  totalCashComm: number;
  totalWalletComm: number;
}

/**
 * Helper to build SQL WHERE clause from filter parameters
 */
function buildWhereClause(
  options: QueryTransactionsOptions
): { whereSql: string; params: any[] } {
  const whereClauses: string[] = [];
  const params: any[] = [];
  const today = options.todayDate || new Date().toISOString().split('T')[0];

  // 1. Date Filter
  if (options.dateFilter === 'TODAY') {
    whereClauses.push('date = ?');
    params.push(today);
  } else if (options.dateFilter && options.dateFilter !== 'ALL') {
    whereClauses.push('date = ?');
    params.push(options.dateFilter);
  }

  // 2. Wallet Filter
  if (options.walletFilter === 'none') {
    whereClauses.push("(walletName IS NULL OR walletName = 'None' OR walletName = '-' OR walletName = '')");
  } else if (options.walletFilter && options.walletFilter !== 'all') {
    whereClauses.push('(walletName = ? OR targetWalletName = ?)');
    params.push(options.walletFilter, options.walletFilter);
  }

  // 3. Cash Account Filter
  if (options.cashFilter === 'none') {
    whereClauses.push("(cashAccountName IS NULL OR cashAccountName = 'None' OR cashAccountName = '-' OR cashAccountName = '')");
  } else if (options.cashFilter && options.cashFilter !== 'all') {
    whereClauses.push('cashAccountName = ?');
    params.push(options.cashFilter);
  }

  // 4. Type Filter
  if (options.typeFilter && options.typeFilter !== 'all') {
    whereClauses.push('type = ?');
    params.push(options.typeFilter);
  }

  // 5. Search Query
  if (options.searchQuery && options.searchQuery.trim()) {
    const q = `%${options.searchQuery.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(customerName) LIKE ? OR
      LOWER(phone) LIKE ? OR
      LOWER(walletName) LIKE ? OR
      LOWER(IFNULL(targetWalletName, '')) LIKE ? OR
      LOWER(IFNULL(cashAccountName, '')) LIKE ? OR
      LOWER(IFNULL(note, '')) LIKE ?
    )`);
    params.push(q, q, q, q, q, q);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, params };
}

/**
 * Query transactions with Database Pagination (default 30 rows/page) and Aggregates
 */
export async function getTransactionsPaged(
  options: QueryTransactionsOptions = {}
): Promise<PagedTransactionsResult> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 30);
  const offset = (page - 1) * pageSize;

  await initSQLiteDatabase();

  if (!dbConnection) {
    // LocalStorage Fallback if SQLite connection is unavailable
    return getTransactionsPagedFallback(options);
  }

  try {
    const { whereSql, params } = buildWhereClause(options);

    // 1. Fetch total count
    const countSql = `SELECT COUNT(*) as count FROM transactions ${whereSql}`;
    const countRes = await dbConnection.query(countSql, params);
    const totalCount = Number(countRes.values?.[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // 2. Fetch paginated records using SQLite Indexing (date DESC, id DESC)
    const selectSql = `
      SELECT * FROM transactions 
      ${whereSql} 
      ORDER BY date DESC, id DESC 
      LIMIT ? OFFSET ?
    `;
    const rowsRes = await dbConnection.query(selectSql, [...params, pageSize, offset]);
    const transactions: Transaction[] = (rowsRes.values || []).map((row: any) => ({
      id: Number(row.id),
      date: String(row.date),
      time: row.time ? String(row.time) : undefined,
      customerName: String(row.customerName),
      type: row.type as any,
      amount: Number(row.amount),
      commission: Number(row.commission || 0),
      commissionMode: row.commissionMode as any,
      commissionChannel: row.commissionChannel as any,
      commissionWalletName: row.commissionWalletName ? String(row.commissionWalletName) : undefined,
      netPayout: row.netPayout !== null && row.netPayout !== undefined ? Number(row.netPayout) : undefined,
      phone: String(row.phone || ''),
      walletName: String(row.walletName || ''),
      targetWalletName: row.targetWalletName ? String(row.targetWalletName) : undefined,
      cashAccountName: row.cashAccountName ? String(row.cashAccountName) : undefined,
      accountType: row.accountType as any,
      note: row.note ? String(row.note) : undefined,
    }));

    // 3. Compute Aggregate Stats directly via SQLite for instant speed on millions of rows
    const statsSql = `
      SELECT 
        SUM(amount) as totalAmount,
        SUM(commission) as totalCommission,
        SUM(CASE 
          WHEN type = 'သွင်း' THEN amount 
          WHEN type = 'ထုတ်' THEN -(CASE WHEN netPayout IS NOT NULL THEN netPayout WHEN commissionMode = 'deduct' THEN (amount - commission) ELSE amount END)
          ELSE 0 
        END) as netCash,
        SUM(CASE 
          WHEN commissionChannel = 'Cash' OR (commissionChannel IS NULL AND commissionMode != 'deduct') THEN commission 
          ELSE 0 
        END) as totalCashComm,
        SUM(CASE 
          WHEN commissionChannel = 'Wallet' OR (commissionChannel IS NULL AND commissionMode = 'deduct') THEN commission 
          ELSE 0 
        END) as totalWalletComm
      FROM transactions 
      ${whereSql}
    `;
    const statsRes = await dbConnection.query(statsSql, params);
    const stats = statsRes.values?.[0] || {};

    return {
      transactions,
      totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      totalAmount: Number(stats.totalAmount || 0),
      totalCommission: Number(stats.totalCommission || 0),
      netCash: Number(stats.netCash || 0),
      totalCashComm: Number(stats.totalCashComm || 0),
      totalWalletComm: Number(stats.totalWalletComm || 0),
    };
  } catch (err) {
    console.error('getTransactionsPaged SQLite Error:', err);
    return getTransactionsPagedFallback(options);
  }
}

/**
 * Fallback memory-based pagination for transactions
 */
function getTransactionsPagedFallback(options: QueryTransactionsOptions): PagedTransactionsResult {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 30);
  const saved = localStorage.getItem('app_transactions');
  const allTx: Transaction[] = saved ? JSON.parse(saved) : [];
  const today = options.todayDate || new Date().toISOString().split('T')[0];

  const filtered = allTx.filter((t) => {
    if (options.dateFilter === 'TODAY' && t.date !== today) return false;
    if (options.dateFilter && options.dateFilter !== 'ALL' && options.dateFilter !== 'TODAY' && t.date !== options.dateFilter) return false;

    if (options.walletFilter === 'none') {
      if (t.walletName && t.walletName !== 'None' && t.walletName !== '-') return false;
    } else if (options.walletFilter && options.walletFilter !== 'all') {
      if (t.walletName !== options.walletFilter && t.targetWalletName !== options.walletFilter) return false;
    }

    if (options.cashFilter === 'none') {
      if (t.cashAccountName && t.cashAccountName !== 'None' && t.cashAccountName !== '-') return false;
    } else if (options.cashFilter && options.cashFilter !== 'all') {
      if (t.cashAccountName !== options.cashFilter) return false;
    }

    if (options.typeFilter && options.typeFilter !== 'all') {
      if (t.type !== options.typeFilter) return false;
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      const match =
        t.customerName.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.walletName.toLowerCase().includes(q) ||
        (t.targetWalletName && t.targetWalletName.toLowerCase().includes(q)) ||
        (t.cashAccountName && t.cashAccountName.toLowerCase().includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedList = filtered.slice(offset, offset + pageSize);

  let totalAmount = 0;
  let totalCommission = 0;
  let netCash = 0;
  let totalCashComm = 0;
  let totalWalletComm = 0;

  for (const item of filtered) {
    totalAmount += item.amount;
    totalCommission += item.commission || 0;
    const comm = item.commission || 0;
    const isCashComm = item.commissionChannel === 'Cash' || (!item.commissionChannel && item.commissionMode !== 'deduct');
    if (isCashComm) totalCashComm += comm;
    else totalWalletComm += comm;

    if (item.type === 'သွင်း') {
      netCash += item.amount;
    } else if (item.type === 'ထုတ်') {
      const actual = item.netPayout !== undefined ? item.netPayout : item.commissionMode === 'deduct' ? item.amount - comm : item.amount;
      netCash -= actual;
    }
  }

  return {
    transactions: pagedList,
    totalCount,
    totalPages,
    currentPage: page,
    pageSize,
    totalAmount,
    totalCommission,
    netCash,
    totalCashComm,
    totalWalletComm,
  };
}

/**
 * Fetch all filtered transactions without limit (Used for Reports, CSV Export, Charts)
 */
export async function getAllFilteredTransactions(
  options: Omit<QueryTransactionsOptions, 'page' | 'pageSize'> = {}
): Promise<Transaction[]> {
  await initSQLiteDatabase();

  if (!dbConnection) {
    const saved = localStorage.getItem('app_transactions');
    const all: Transaction[] = saved ? JSON.parse(saved) : [];
    return all;
  }

  try {
    const { whereSql, params } = buildWhereClause(options);
    const sql = `SELECT * FROM transactions ${whereSql} ORDER BY date DESC, id DESC`;
    const res = await dbConnection.query(sql, params);
    return (res.values || []).map((row: any) => ({
      id: Number(row.id),
      date: String(row.date),
      time: row.time ? String(row.time) : undefined,
      customerName: String(row.customerName),
      type: row.type as any,
      amount: Number(row.amount),
      commission: Number(row.commission || 0),
      commissionMode: row.commissionMode as any,
      commissionChannel: row.commissionChannel as any,
      commissionWalletName: row.commissionWalletName ? String(row.commissionWalletName) : undefined,
      netPayout: row.netPayout !== null && row.netPayout !== undefined ? Number(row.netPayout) : undefined,
      phone: String(row.phone || ''),
      walletName: String(row.walletName || ''),
      targetWalletName: row.targetWalletName ? String(row.targetWalletName) : undefined,
      cashAccountName: row.cashAccountName ? String(row.cashAccountName) : undefined,
      accountType: row.accountType as any,
      note: row.note ? String(row.note) : undefined,
    }));
  } catch (err) {
    console.error('getAllFilteredTransactions error:', err);
    return [];
  }
}

/**
 * Add a new transaction into SQLite
 */
export async function insertTransaction(tx: Transaction): Promise<boolean> {
  await initSQLiteDatabase();

  if (dbConnection) {
    try {
      const sql = `
        INSERT OR REPLACE INTO transactions (
          id, date, time, customerName, type, amount, commission,
          commissionMode, commissionChannel, commissionWalletName, netPayout,
          phone, walletName, targetWalletName, cashAccountName, accountType, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await dbConnection.run(sql, [
        tx.id,
        tx.date,
        tx.time || '',
        tx.customerName,
        tx.type,
        tx.amount,
        tx.commission || 0,
        tx.commissionMode || 'separate',
        tx.commissionChannel || 'Cash',
        tx.commissionWalletName || '',
        tx.netPayout !== undefined ? tx.netPayout : null,
        tx.phone || '',
        tx.walletName,
        tx.targetWalletName || '',
        tx.cashAccountName || '',
        tx.accountType || 'Wallet',
        tx.note || '',
      ]);

      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('insertTransaction SQLite error:', e);
    }
  }

  // Also sync to localStorage as secondary backup
  try {
    const saved = localStorage.getItem('app_transactions');
    const list: Transaction[] = saved ? JSON.parse(saved) : [];
    const updated = [tx, ...list.filter((t) => t.id !== tx.id)];
    localStorage.setItem('app_transactions', JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  return true;
}

/**
 * Batch insert multiple transactions (Used for restore and initial migration)
 */
export async function insertTransactionsBatch(transactions: Transaction[]): Promise<boolean> {
  if (transactions.length === 0) return true;
  await initSQLiteDatabase();

  if (dbConnection) {
    try {
      await dbConnection.execute('BEGIN TRANSACTION');
      const stmt = `
        INSERT OR REPLACE INTO transactions (
          id, date, time, customerName, type, amount, commission,
          commissionMode, commissionChannel, commissionWalletName, netPayout,
          phone, walletName, targetWalletName, cashAccountName, accountType, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const tx of transactions) {
        await dbConnection.run(stmt, [
          tx.id,
          tx.date,
          tx.time || '',
          tx.customerName,
          tx.type,
          tx.amount,
          tx.commission || 0,
          tx.commissionMode || 'separate',
          tx.commissionChannel || 'Cash',
          tx.commissionWalletName || '',
          tx.netPayout !== undefined ? tx.netPayout : null,
          tx.phone || '',
          tx.walletName,
          tx.targetWalletName || '',
          tx.cashAccountName || '',
          tx.accountType || 'Wallet',
          tx.note || '',
        ]);
      }
      await dbConnection.execute('COMMIT');

      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('insertTransactionsBatch error:', e);
      try {
        await dbConnection.execute('ROLLBACK');
      } catch (r) {}
    }
  }

  return true;
}

/**
 * Delete a transaction by ID
 */
export async function deleteTransactionById(id: number): Promise<boolean> {
  await initSQLiteDatabase();

  if (dbConnection) {
    try {
      await dbConnection.run('DELETE FROM transactions WHERE id = ?', [id]);
      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('deleteTransaction SQLite error:', e);
    }
  }

  try {
    const saved = localStorage.getItem('app_transactions');
    if (saved) {
      const list: Transaction[] = JSON.parse(saved);
      const filtered = list.filter((t) => t.id !== id);
      localStorage.setItem('app_transactions', JSON.stringify(filtered));
    }
  } catch (e) {}

  return true;
}

/**
 * Save Cash Accounts list to SQLite
 */
export async function saveCashAccountsToDB(accounts: CashAccountItem[]): Promise<void> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      await dbConnection.execute('DELETE FROM cash_accounts');
      for (const acc of accounts) {
        await dbConnection.run(
          `INSERT INTO cash_accounts (id, name, balance, updatedDate, note, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [acc.id, acc.name, acc.balance, acc.updatedDate || '', acc.note || '', acc.color || '']
        );
      }
      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('saveCashAccountsToDB error:', e);
    }
  }
  localStorage.setItem('app_cash_accounts', JSON.stringify(accounts));
}

/**
 * Fetch Cash Accounts from SQLite
 */
export async function getCashAccountsFromDB(): Promise<CashAccountItem[]> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      const res = await dbConnection.query('SELECT * FROM cash_accounts ORDER BY id ASC');
      if (res.values && res.values.length > 0) {
        return res.values.map((r: any) => ({
          id: Number(r.id),
          name: String(r.name),
          balance: Number(r.balance || 0),
          updatedDate: String(r.updatedDate || ''),
          note: r.note ? String(r.note) : undefined,
          color: r.color ? String(r.color) : undefined,
        }));
      }
    } catch (e) {
      console.error('getCashAccountsFromDB error:', e);
    }
  }
  const saved = localStorage.getItem('app_cash_accounts');
  return saved ? JSON.parse(saved) : DEFAULT_CASH_ACCOUNTS;
}

/**
 * Save Wallets list to SQLite
 */
export async function saveWalletsToDB(wallets: WalletItem[]): Promise<void> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      await dbConnection.execute('DELETE FROM wallets');
      for (const w of wallets) {
        await dbConnection.run(
          `INSERT INTO wallets (id, name, balance, updatedDate, accountNumber, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [w.id, w.name, w.balance, w.updatedDate || '', w.accountNumber || '', w.color || '']
        );
      }
      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('saveWalletsToDB error:', e);
    }
  }
  localStorage.setItem('app_wallets', JSON.stringify(wallets));
}

/**
 * Fetch Wallets from SQLite
 */
export async function getWalletsFromDB(): Promise<WalletItem[]> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      const res = await dbConnection.query('SELECT * FROM wallets ORDER BY id ASC');
      if (res.values && res.values.length > 0) {
        return res.values.map((r: any) => ({
          id: Number(r.id),
          name: String(r.name),
          balance: Number(r.balance || 0),
          updatedDate: String(r.updatedDate || ''),
          accountNumber: r.accountNumber ? String(r.accountNumber) : undefined,
          color: r.color ? String(r.color) : undefined,
        }));
      }
    } catch (e) {
      console.error('getWalletsFromDB error:', e);
    }
  }
  const saved = localStorage.getItem('app_wallets');
  return saved ? JSON.parse(saved) : DEFAULT_WALLETS;
}

/**
 * Save Shop Profile to SQLite
 */
export async function saveShopProfileToDB(profile: ShopProfile): Promise<void> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      await dbConnection.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('shop_profile', ?)`,
        [JSON.stringify(profile)]
      );
      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('saveShopProfileToDB error:', e);
    }
  }
  localStorage.setItem('app_shop_profile', JSON.stringify(profile));
}

/**
 * Get Shop Profile from SQLite
 */
export async function getShopProfileFromDB(): Promise<ShopProfile> {
  await initSQLiteDatabase();
  if (dbConnection) {
    try {
      const res = await dbConnection.query(`SELECT value FROM settings WHERE key = 'shop_profile'`);
      if (res.values && res.values.length > 0) {
        return JSON.parse(res.values[0].value);
      }
    } catch (e) {
      console.error('getShopProfileFromDB error:', e);
    }
  }
  const saved = localStorage.getItem('app_shop_profile');
  return saved ? JSON.parse(saved) : { shopName: 'Money Agent POS', address: '', phone: '' };
}

/**
 * Purge transactions older than cutoff date and run VACUUM to compact SQLite DB
 */
export async function purgeOldTransactionsDB(cutoffDate: string): Promise<number> {
  await initSQLiteDatabase();
  let deletedCount = 0;

  if (dbConnection) {
    try {
      const countRes = await dbConnection.query('SELECT COUNT(*) as count FROM transactions WHERE date < ?', [cutoffDate]);
      deletedCount = Number(countRes.values?.[0]?.count || 0);

      await dbConnection.run('DELETE FROM transactions WHERE date < ?', [cutoffDate]);
      // Compact SQLite storage
      await dbConnection.execute('VACUUM');

      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('purgeOldTransactionsDB error:', e);
    }
  }

  // Sync to localStorage
  try {
    const saved = localStorage.getItem('app_transactions');
    if (saved) {
      const list: Transaction[] = JSON.parse(saved);
      const retained = list.filter((t) => t.date >= cutoffDate);
      localStorage.setItem('app_transactions', JSON.stringify(retained));
    }
  } catch (e) {}

  return deletedCount;
}

/**
 * Reset all transactions and set account balances to 0 in SQLite
 */
export async function resetAllDataDB(todayDate?: string): Promise<void> {
  await initSQLiteDatabase();
  const today = todayDate || new Date().toISOString().split('T')[0];
  if (dbConnection) {
    try {
      await dbConnection.execute('DELETE FROM transactions');
      await dbConnection.run('UPDATE cash_accounts SET balance = 0, updatedDate = ?', [today]);
      await dbConnection.run('UPDATE wallets SET balance = 0, updatedDate = ?', [today]);
      await dbConnection.execute('VACUUM');

      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('resetAllDataDB error:', e);
    }
  }
}

/**
 * Restore Full Database from BackupData payload
 */
export async function restoreDatabasePayload(backupData: BackupData): Promise<void> {
  await initSQLiteDatabase();

  if (dbConnection) {
    try {
      await dbConnection.execute('BEGIN TRANSACTION');
      // 1. Clear & Restore Cash Accounts
      await dbConnection.execute('DELETE FROM cash_accounts');
      for (const acc of backupData.cashAccounts) {
        await dbConnection.run(
          `INSERT INTO cash_accounts (id, name, balance, updatedDate, note, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [acc.id, acc.name, acc.balance, acc.updatedDate || '', acc.note || '', acc.color || '']
        );
      }

      // 2. Clear & Restore Wallets
      await dbConnection.execute('DELETE FROM wallets');
      for (const w of backupData.wallets) {
        await dbConnection.run(
          `INSERT INTO wallets (id, name, balance, updatedDate, accountNumber, color) VALUES (?, ?, ?, ?, ?, ?)`,
          [w.id, w.name, w.balance, w.updatedDate || '', w.accountNumber || '', w.color || '']
        );
      }

      // 3. Clear & Restore Transactions
      await dbConnection.execute('DELETE FROM transactions');
      const stmt = `
        INSERT INTO transactions (
          id, date, time, customerName, type, amount, commission,
          commissionMode, commissionChannel, commissionWalletName, netPayout,
          phone, walletName, targetWalletName, cashAccountName, accountType, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const tx of backupData.transactions) {
        await dbConnection.run(stmt, [
          tx.id,
          tx.date,
          tx.time || '',
          tx.customerName,
          tx.type,
          tx.amount,
          tx.commission || 0,
          tx.commissionMode || 'separate',
          tx.commissionChannel || 'Cash',
          tx.commissionWalletName || '',
          tx.netPayout !== undefined ? tx.netPayout : null,
          tx.phone || '',
          tx.walletName,
          tx.targetWalletName || '',
          tx.cashAccountName || '',
          tx.accountType || 'Wallet',
          tx.note || '',
        ]);
      }

      // 4. Restore Shop Profile
      if (backupData.shopProfile) {
        await dbConnection.run(
          `INSERT OR REPLACE INTO settings (key, value) VALUES ('shop_profile', ?)`,
          [JSON.stringify(backupData.shopProfile)]
        );
      }

      await dbConnection.execute('COMMIT');
      await dbConnection.execute('VACUUM');

      if (Capacitor.getPlatform() === 'web' && sqliteConnection) {
        await sqliteConnection.saveToStore(DB_NAME);
      }
    } catch (e) {
      console.error('restoreDatabasePayload error:', e);
      try {
        await dbConnection.execute('ROLLBACK');
      } catch (r) {}
    }
  }

  // Also sync to localStorage
  localStorage.setItem('app_cash_accounts', JSON.stringify(backupData.cashAccounts));
  localStorage.setItem('app_wallets', JSON.stringify(backupData.wallets));
  localStorage.setItem('app_transactions', JSON.stringify(backupData.transactions));
  if (backupData.shopProfile) {
    localStorage.setItem('app_shop_profile', JSON.stringify(backupData.shopProfile));
  }
}
