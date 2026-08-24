import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pos_master_database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create data dir:', e);
  }
}

interface ServerData {
  transactions: any[];
  cashAccounts: any[];
  wallets: any[];
  shopProfile: any;
  settings: Record<string, string>;
  lastUpdated: string;
}

const DEFAULT_SERVER_DATA: ServerData = {
  transactions: [],
  cashAccounts: [
    { id: 1, name: 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'ကောင်တာ ၁' },
    { id: 2, name: 'ကာတာငွေသေတ္တာ (Safe Box)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'အနောက်ခန်း' },
    { id: 3, name: 'အရန်ငွေသေတ္တာ (Backup Cash)', balance: 0, updatedDate: new Date().toISOString().split('T')[0], note: 'အရန်' },
  ],
  wallets: [
    { id: 1, name: 'KPay', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '09798001122' },
    { id: 2, name: 'WaveMoney', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '09971234567' },
    { id: 3, name: 'CB Pay', balance: 0, updatedDate: new Date().toISOString().split('T')[0], accountNumber: '0012903829' },
  ],
  shopProfile: {
    shopName: 'Money Agent POS',
    address: '',
    phone: '',
  },
  settings: {},
  lastUpdated: new Date().toISOString(),
};

function loadServerData(): ServerData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SERVER_DATA,
        ...parsed,
      };
    }
  } catch (e) {
    console.error('Error reading server database file:', e);
  }
  return { ...DEFAULT_SERVER_DATA };
}

let inMemoryData: ServerData = loadServerData();

function saveServerData(data: ServerData) {
  inMemoryData = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing server database file:', e);
  }
}

interface NetworkInterfaceDetail {
  address: string;
  name: string;
  isWifiOrLan: boolean;
  type: string;
}

/**
 * Get detailed Local IPv4 network addresses prioritizing Wi-Fi / LAN
 */
function getDetailedNetworkInterfaces(): NetworkInterfaceDetail[] {
  const interfaces = os.networkInterfaces();
  const list: NetworkInterfaceDetail[] = [];

  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address;
        const lowerName = name.toLowerCase();
        const isWifi =
          lowerName.includes('wi-fi') ||
          lowerName.includes('wifi') ||
          lowerName.includes('wlan') ||
          lowerName.includes('wl');
        const isEthernet =
          lowerName.includes('eth') ||
          lowerName.includes('en') ||
          lowerName.includes('ethernet');

        list.push({
          address: addr,
          name,
          isWifiOrLan: isWifi || isEthernet || addr.startsWith('192.168.') || addr.startsWith('10.'),
          type: isWifi ? 'Wi-Fi' : isEthernet ? 'Ethernet' : 'LAN Interface',
        });
      }
    }
  }

  // Sort Wi-Fi / Local LAN IPs to the top (192.168.* first, then 10.*, then 172.16-31.*)
  list.sort((a, b) => {
    const getScore = (item: NetworkInterfaceDetail) => {
      if (item.address.startsWith('192.168.')) return 100;
      if (item.address.startsWith('10.')) return 80;
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(item.address)) return 60;
      if (item.isWifiOrLan) return 40;
      return 10;
    };
    return getScore(b) - getScore(a);
  });

  return list;
}

function getLocalIpAddresses(): string[] {
  const detailed = getDetailedNetworkInterfaces();
  const addresses = detailed.map((d) => d.address);
  if (addresses.length === 0) {
    addresses.push('127.0.0.1');
  }
  return addresses;
}

async function startServer() {
  const app = express();

  // Enable generous body limits for backups/restores
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS Middleware for Same-Network Master-Client Access
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  }));

  // ==========================================
  // REST API ENDPOINTS (Master Server Mode)
  // ==========================================

  // Health Check Endpoint (Used by Client Mode 'Test Connection')
  app.get('/api/health', (req, res) => {
    const ipList = getLocalIpAddresses();
    res.json({
      status: 'ok',
      mode: 'server',
      version: '1.1.0',
      systemName: 'Money Agent POS Master Server',
      hostname: os.hostname(),
      ipList,
      primaryIp: ipList[0] || '127.0.0.1',
      serverTime: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  // Network Interfaces Info Endpoint
  app.get('/api/network-info', (req, res) => {
    const detailed = getDetailedNetworkInterfaces();
    const ipList = detailed.map((d) => d.address);
    const primaryIp = ipList[0] || '127.0.0.1';
    res.json({
      ipList,
      detailedInterfaces: detailed,
      primaryIp,
      port: PORT,
      activeUrl: `http://${primaryIp}:${PORT}`,
      hostname: os.hostname(),
      totalTransactions: inMemoryData.transactions.length,
      mode: 'server',
    });
  });

  // GET /api/transactions (With DB Indexing, Filtering & Pagination)
  app.get('/api/transactions', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, parseInt(req.query.pageSize as string) || 30);
      const dateFilter = (req.query.dateFilter as string) || 'ALL';
      const walletFilter = (req.query.walletFilter as string) || 'all';
      const cashFilter = (req.query.cashFilter as string) || 'all';
      const typeFilter = (req.query.typeFilter as string) || 'all';
      const searchQuery = (req.query.searchQuery as string) || '';
      const todayDate = (req.query.todayDate as string) || new Date().toISOString().split('T')[0];

      let filtered = inMemoryData.transactions.filter((t) => {
        if (dateFilter === 'TODAY' && t.date !== todayDate) return false;
        if (dateFilter !== 'ALL' && dateFilter !== 'TODAY' && t.date !== dateFilter) return false;

        if (walletFilter === 'none') {
          if (t.walletName && t.walletName !== 'None' && t.walletName !== '-') return false;
        } else if (walletFilter && walletFilter !== 'all') {
          if (t.walletName !== walletFilter && t.targetWalletName !== walletFilter) return false;
        }

        if (cashFilter === 'none') {
          if (t.cashAccountName && t.cashAccountName !== 'None' && t.cashAccountName !== '-') return false;
        } else if (cashFilter && cashFilter !== 'all') {
          if (t.cashAccountName !== cashFilter) return false;
        }

        if (typeFilter && typeFilter !== 'all') {
          if (t.type !== typeFilter) return false;
        }

        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            (t.customerName && t.customerName.toLowerCase().includes(q)) ||
            (t.phone && t.phone.toLowerCase().includes(q)) ||
            (t.walletName && t.walletName.toLowerCase().includes(q)) ||
            (t.targetWalletName && t.targetWalletName.toLowerCase().includes(q)) ||
            (t.cashAccountName && t.cashAccountName.toLowerCase().includes(q)) ||
            (t.note && t.note.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      });

      // Sort by date DESC, id DESC
      filtered.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return (b.id || 0) - (a.id || 0);
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
        totalAmount += Number(item.amount || 0);
        const comm = Number(item.commission || 0);
        totalCommission += comm;
        const isCashComm = item.commissionChannel === 'Cash' || (!item.commissionChannel && item.commissionMode !== 'deduct');
        if (isCashComm) totalCashComm += comm;
        else totalWalletComm += comm;

        if (item.type === 'သွင်း') {
          netCash += Number(item.amount || 0);
        } else if (item.type === 'ထုတ်') {
          const actual = item.netPayout !== undefined ? Number(item.netPayout) : item.commissionMode === 'deduct' ? Number(item.amount || 0) - comm : Number(item.amount || 0);
          netCash -= actual;
        }
      }

      res.json({
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
      });
    } catch (e: any) {
      console.error('Error fetching transactions:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/transactions/all (Full list for Reports & Export)
  app.get('/api/transactions/all', (req, res) => {
    try {
      const dateFilter = (req.query.dateFilter as string) || 'ALL';
      const walletFilter = (req.query.walletFilter as string) || 'all';
      const cashFilter = (req.query.cashFilter as string) || 'all';
      const typeFilter = (req.query.typeFilter as string) || 'all';
      const searchQuery = (req.query.searchQuery as string) || '';
      const todayDate = (req.query.todayDate as string) || new Date().toISOString().split('T')[0];

      let filtered = inMemoryData.transactions.filter((t) => {
        if (dateFilter === 'TODAY' && t.date !== todayDate) return false;
        if (dateFilter !== 'ALL' && dateFilter !== 'TODAY' && t.date !== dateFilter) return false;

        if (walletFilter === 'none') {
          if (t.walletName && t.walletName !== 'None' && t.walletName !== '-') return false;
        } else if (walletFilter && walletFilter !== 'all') {
          if (t.walletName !== walletFilter && t.targetWalletName !== walletFilter) return false;
        }

        if (cashFilter === 'none') {
          if (t.cashAccountName && t.cashAccountName !== 'None' && t.cashAccountName !== '-') return false;
        } else if (cashFilter && cashFilter !== 'all') {
          if (t.cashAccountName !== cashFilter) return false;
        }

        if (typeFilter && typeFilter !== 'all') {
          if (t.type !== typeFilter) return false;
        }

        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            (t.customerName && t.customerName.toLowerCase().includes(q)) ||
            (t.phone && t.phone.toLowerCase().includes(q)) ||
            (t.walletName && t.walletName.toLowerCase().includes(q)) ||
            (t.targetWalletName && t.targetWalletName.toLowerCase().includes(q)) ||
            (t.cashAccountName && t.cashAccountName.toLowerCase().includes(q)) ||
            (t.note && t.note.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return (b.id || 0) - (a.id || 0);
      });

      res.json(filtered);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/transactions (Create / Update Transaction)
  app.post('/api/transactions', (req, res) => {
    try {
      const tx = req.body;
      if (!tx || !tx.customerName || !tx.type || tx.amount === undefined) {
        res.status(400).json({ error: 'Invalid transaction payload' });
        return;
      }

      const txWithId = {
        ...tx,
        id: tx.id || Date.now(),
        created_at: tx.created_at || new Date().toISOString(),
      };

      const existingIndex = inMemoryData.transactions.findIndex((t) => t.id === txWithId.id);
      if (existingIndex >= 0) {
        inMemoryData.transactions[existingIndex] = txWithId;
      } else {
        inMemoryData.transactions.unshift(txWithId);
      }

      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });

      res.json({ success: true, transaction: txWithId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/transactions/batch (Batch Insert)
  app.post('/api/transactions/batch', (req, res) => {
    try {
      const { transactions } = req.body;
      if (!Array.isArray(transactions)) {
        res.status(400).json({ error: 'transactions must be an array' });
        return;
      }

      const map = new Map<number, any>();
      for (const t of inMemoryData.transactions) {
        map.set(t.id, t);
      }
      for (const t of transactions) {
        map.set(t.id, t);
      }

      inMemoryData.transactions = Array.from(map.values()).sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.id || 0) - (a.id || 0);
      });

      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });

      res.json({ success: true, count: transactions.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/transactions/:id
  app.delete('/api/transactions/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      inMemoryData.transactions = inMemoryData.transactions.filter((t) => t.id !== id);

      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });

      res.json({ success: true, deletedId: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/cash-accounts
  app.get('/api/cash-accounts', (req, res) => {
    res.json(inMemoryData.cashAccounts);
  });

  // POST /api/cash-accounts
  app.post('/api/cash-accounts', (req, res) => {
    try {
      const { accounts } = req.body;
      if (Array.isArray(accounts)) {
        inMemoryData.cashAccounts = accounts;
        saveServerData({
          ...inMemoryData,
          lastUpdated: new Date().toISOString(),
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'accounts must be an array' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/wallets
  app.get('/api/wallets', (req, res) => {
    res.json(inMemoryData.wallets);
  });

  // POST /api/wallets
  app.post('/api/wallets', (req, res) => {
    try {
      const { wallets } = req.body;
      if (Array.isArray(wallets)) {
        inMemoryData.wallets = wallets;
        saveServerData({
          ...inMemoryData,
          lastUpdated: new Date().toISOString(),
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'wallets must be an array' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/shop-profile
  app.get('/api/shop-profile', (req, res) => {
    res.json(inMemoryData.shopProfile);
  });

  // POST /api/shop-profile
  app.post('/api/shop-profile', (req, res) => {
    try {
      const profile = req.body;
      inMemoryData.shopProfile = profile;
      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/purge
  app.post('/api/purge', (req, res) => {
    try {
      const { cutoffDate } = req.body;
      if (!cutoffDate) {
        res.status(400).json({ error: 'cutoffDate is required' });
        return;
      }
      const beforeCount = inMemoryData.transactions.length;
      inMemoryData.transactions = inMemoryData.transactions.filter((t) => t.date >= cutoffDate);
      const deletedCount = beforeCount - inMemoryData.transactions.length;

      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });

      res.json({ success: true, deletedCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/reset
  app.post('/api/reset', (req, res) => {
    try {
      const today = req.body.todayDate || new Date().toISOString().split('T')[0];
      inMemoryData.transactions = [];
      inMemoryData.cashAccounts = inMemoryData.cashAccounts.map((c) => ({
        ...c,
        balance: 0,
        updatedDate: today,
      }));
      inMemoryData.wallets = inMemoryData.wallets.map((w) => ({
        ...w,
        balance: 0,
        updatedDate: today,
      }));

      saveServerData({
        ...inMemoryData,
        lastUpdated: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/backup
  app.get('/api/backup', (req, res) => {
    res.json({
      cashAccounts: inMemoryData.cashAccounts,
      wallets: inMemoryData.wallets,
      transactions: inMemoryData.transactions,
      shopProfile: inMemoryData.shopProfile,
      exportedAt: new Date().toISOString(),
      version: '1.1.0',
    });
  });

  // POST /api/restore
  app.post('/api/restore', (req, res) => {
    try {
      const backup = req.body;
      if (backup.cashAccounts && backup.wallets && backup.transactions) {
        inMemoryData = {
          cashAccounts: backup.cashAccounts,
          wallets: backup.wallets,
          transactions: backup.transactions,
          shopProfile: backup.shopProfile || inMemoryData.shopProfile,
          settings: inMemoryData.settings,
          lastUpdated: new Date().toISOString(),
        };
        saveServerData(inMemoryData);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Invalid backup format' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // VITE DEV MIDDLEWARE / STATIC PRODUCTION SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
    const detailed = getDetailedNetworkInterfaces();
    console.log(`\n======================================================`);
    console.log(`🚀 Money Agent POS Master Server running on port 3000 (0.0.0.0)`);
    console.log(`📡 Local Wi-Fi / Network IP Addresses for Client terminals:`);
    detailed.forEach((d) => {
      console.log(`   👉 http://${d.address}:3000 (${d.type} - ${d.name})`);
    });
    console.log(`======================================================\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close();
  });
  process.on('SIGINT', () => {
    server.close();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
