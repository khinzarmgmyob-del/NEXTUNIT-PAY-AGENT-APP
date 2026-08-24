var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var PORT = 3e3;
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DB_FILE = import_path.default.join(DATA_DIR, "pos_master_database.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  try {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("Could not create data dir:", e);
  }
}
var DEFAULT_SERVER_DATA = {
  transactions: [],
  cashAccounts: [
    { id: 1, name: "\u1006\u102D\u102F\u1004\u103A\u101B\u103E\u1031\u1037\u1004\u103D\u1031\u1015\u102F\u1036\u1038 (Counter Box)", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], note: "\u1000\u1031\u102C\u1004\u103A\u1010\u102C \u1041" },
    { id: 2, name: "\u1000\u102C\u1010\u102C\u1004\u103D\u1031\u101E\u1031\u1010\u1039\u1010\u102C (Safe Box)", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], note: "\u1021\u1014\u1031\u102C\u1000\u103A\u1001\u1014\u103A\u1038" },
    { id: 3, name: "\u1021\u101B\u1014\u103A\u1004\u103D\u1031\u101E\u1031\u1010\u1039\u1010\u102C (Backup Cash)", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], note: "\u1021\u101B\u1014\u103A" }
  ],
  wallets: [
    { id: 1, name: "KPay", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], accountNumber: "09798001122" },
    { id: 2, name: "WaveMoney", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], accountNumber: "09971234567" },
    { id: 3, name: "CB Pay", balance: 0, updatedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], accountNumber: "0012903829" }
  ],
  shopProfile: {
    shopName: "Money Agent POS",
    address: "",
    phone: ""
  },
  settings: {},
  lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
};
function loadServerData() {
  try {
    if (import_fs.default.existsSync(DB_FILE)) {
      const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SERVER_DATA,
        ...parsed
      };
    }
  } catch (e) {
    console.error("Error reading server database file:", e);
  }
  return { ...DEFAULT_SERVER_DATA };
}
var inMemoryData = loadServerData();
function saveServerData(data) {
  inMemoryData = data;
  try {
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing server database file:", e);
  }
}
function getDetailedNetworkInterfaces() {
  const interfaces = import_os.default.networkInterfaces();
  const list = [];
  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        const addr = iface.address;
        const lowerName = name.toLowerCase();
        const isWifi = lowerName.includes("wi-fi") || lowerName.includes("wifi") || lowerName.includes("wlan") || lowerName.includes("wl");
        const isEthernet = lowerName.includes("eth") || lowerName.includes("en") || lowerName.includes("ethernet");
        list.push({
          address: addr,
          name,
          isWifiOrLan: isWifi || isEthernet || addr.startsWith("192.168.") || addr.startsWith("10."),
          type: isWifi ? "Wi-Fi" : isEthernet ? "Ethernet" : "LAN Interface"
        });
      }
    }
  }
  list.sort((a, b) => {
    const getScore = (item) => {
      if (item.address.startsWith("192.168.")) return 100;
      if (item.address.startsWith("10.")) return 80;
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(item.address)) return 60;
      if (item.isWifiOrLan) return 40;
      return 10;
    };
    return getScore(b) - getScore(a);
  });
  return list;
}
function getLocalIpAddresses() {
  const detailed = getDetailedNetworkInterfaces();
  const addresses = detailed.map((d) => d.address);
  if (addresses.length === 0) {
    addresses.push("127.0.0.1");
  }
  return addresses;
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use((0, import_cors.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
  }));
  app.get("/api/health", (req, res) => {
    const ipList = getLocalIpAddresses();
    res.json({
      status: "ok",
      mode: "server",
      version: "1.1.0",
      systemName: "Money Agent POS Master Server",
      hostname: import_os.default.hostname(),
      ipList,
      primaryIp: ipList[0] || "127.0.0.1",
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      uptimeSec: Math.floor(process.uptime())
    });
  });
  app.get("/api/network-info", (req, res) => {
    const detailed = getDetailedNetworkInterfaces();
    const ipList = detailed.map((d) => d.address);
    const primaryIp = ipList[0] || "127.0.0.1";
    res.json({
      ipList,
      detailedInterfaces: detailed,
      primaryIp,
      port: PORT,
      activeUrl: `http://${primaryIp}:${PORT}`,
      hostname: import_os.default.hostname(),
      totalTransactions: inMemoryData.transactions.length,
      mode: "server"
    });
  });
  app.get("/api/transactions", (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.max(1, parseInt(req.query.pageSize) || 30);
      const dateFilter = req.query.dateFilter || "ALL";
      const walletFilter = req.query.walletFilter || "all";
      const cashFilter = req.query.cashFilter || "all";
      const typeFilter = req.query.typeFilter || "all";
      const searchQuery = req.query.searchQuery || "";
      const todayDate = req.query.todayDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      let filtered = inMemoryData.transactions.filter((t) => {
        if (dateFilter === "TODAY" && t.date !== todayDate) return false;
        if (dateFilter !== "ALL" && dateFilter !== "TODAY" && t.date !== dateFilter) return false;
        if (walletFilter === "none") {
          if (t.walletName && t.walletName !== "None" && t.walletName !== "-") return false;
        } else if (walletFilter && walletFilter !== "all") {
          if (t.walletName !== walletFilter && t.targetWalletName !== walletFilter) return false;
        }
        if (cashFilter === "none") {
          if (t.cashAccountName && t.cashAccountName !== "None" && t.cashAccountName !== "-") return false;
        } else if (cashFilter && cashFilter !== "all") {
          if (t.cashAccountName !== cashFilter) return false;
        }
        if (typeFilter && typeFilter !== "all") {
          if (t.type !== typeFilter) return false;
        }
        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match = t.customerName && t.customerName.toLowerCase().includes(q) || t.phone && t.phone.toLowerCase().includes(q) || t.walletName && t.walletName.toLowerCase().includes(q) || t.targetWalletName && t.targetWalletName.toLowerCase().includes(q) || t.cashAccountName && t.cashAccountName.toLowerCase().includes(q) || t.note && t.note.toLowerCase().includes(q);
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
        const isCashComm = item.commissionChannel === "Cash" || !item.commissionChannel && item.commissionMode !== "deduct";
        if (isCashComm) totalCashComm += comm;
        else totalWalletComm += comm;
        if (item.type === "\u101E\u103D\u1004\u103A\u1038") {
          netCash += Number(item.amount || 0);
        } else if (item.type === "\u1011\u102F\u1010\u103A") {
          const actual = item.netPayout !== void 0 ? Number(item.netPayout) : item.commissionMode === "deduct" ? Number(item.amount || 0) - comm : Number(item.amount || 0);
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
        totalWalletComm
      });
    } catch (e) {
      console.error("Error fetching transactions:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/transactions/all", (req, res) => {
    try {
      const dateFilter = req.query.dateFilter || "ALL";
      const walletFilter = req.query.walletFilter || "all";
      const cashFilter = req.query.cashFilter || "all";
      const typeFilter = req.query.typeFilter || "all";
      const searchQuery = req.query.searchQuery || "";
      const todayDate = req.query.todayDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      let filtered = inMemoryData.transactions.filter((t) => {
        if (dateFilter === "TODAY" && t.date !== todayDate) return false;
        if (dateFilter !== "ALL" && dateFilter !== "TODAY" && t.date !== dateFilter) return false;
        if (walletFilter === "none") {
          if (t.walletName && t.walletName !== "None" && t.walletName !== "-") return false;
        } else if (walletFilter && walletFilter !== "all") {
          if (t.walletName !== walletFilter && t.targetWalletName !== walletFilter) return false;
        }
        if (cashFilter === "none") {
          if (t.cashAccountName && t.cashAccountName !== "None" && t.cashAccountName !== "-") return false;
        } else if (cashFilter && cashFilter !== "all") {
          if (t.cashAccountName !== cashFilter) return false;
        }
        if (typeFilter && typeFilter !== "all") {
          if (t.type !== typeFilter) return false;
        }
        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match = t.customerName && t.customerName.toLowerCase().includes(q) || t.phone && t.phone.toLowerCase().includes(q) || t.walletName && t.walletName.toLowerCase().includes(q) || t.targetWalletName && t.targetWalletName.toLowerCase().includes(q) || t.cashAccountName && t.cashAccountName.toLowerCase().includes(q) || t.note && t.note.toLowerCase().includes(q);
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
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/transactions", (req, res) => {
    try {
      const tx = req.body;
      if (!tx || !tx.customerName || !tx.type || tx.amount === void 0) {
        res.status(400).json({ error: "Invalid transaction payload" });
        return;
      }
      const txWithId = {
        ...tx,
        id: tx.id || Date.now(),
        created_at: tx.created_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      const existingIndex = inMemoryData.transactions.findIndex((t) => t.id === txWithId.id);
      if (existingIndex >= 0) {
        inMemoryData.transactions[existingIndex] = txWithId;
      } else {
        inMemoryData.transactions.unshift(txWithId);
      }
      saveServerData({
        ...inMemoryData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, transaction: txWithId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/transactions/batch", (req, res) => {
    try {
      const { transactions } = req.body;
      if (!Array.isArray(transactions)) {
        res.status(400).json({ error: "transactions must be an array" });
        return;
      }
      const map = /* @__PURE__ */ new Map();
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
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, count: transactions.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/transactions/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      inMemoryData.transactions = inMemoryData.transactions.filter((t) => t.id !== id);
      saveServerData({
        ...inMemoryData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, deletedId: id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/cash-accounts", (req, res) => {
    res.json(inMemoryData.cashAccounts);
  });
  app.post("/api/cash-accounts", (req, res) => {
    try {
      const { accounts } = req.body;
      if (Array.isArray(accounts)) {
        inMemoryData.cashAccounts = accounts;
        saveServerData({
          ...inMemoryData,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "accounts must be an array" });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/wallets", (req, res) => {
    res.json(inMemoryData.wallets);
  });
  app.post("/api/wallets", (req, res) => {
    try {
      const { wallets } = req.body;
      if (Array.isArray(wallets)) {
        inMemoryData.wallets = wallets;
        saveServerData({
          ...inMemoryData,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "wallets must be an array" });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/shop-profile", (req, res) => {
    res.json(inMemoryData.shopProfile);
  });
  app.post("/api/shop-profile", (req, res) => {
    try {
      const profile = req.body;
      inMemoryData.shopProfile = profile;
      saveServerData({
        ...inMemoryData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/purge", (req, res) => {
    try {
      const { cutoffDate } = req.body;
      if (!cutoffDate) {
        res.status(400).json({ error: "cutoffDate is required" });
        return;
      }
      const beforeCount = inMemoryData.transactions.length;
      inMemoryData.transactions = inMemoryData.transactions.filter((t) => t.date >= cutoffDate);
      const deletedCount = beforeCount - inMemoryData.transactions.length;
      saveServerData({
        ...inMemoryData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, deletedCount });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/reset", (req, res) => {
    try {
      const today = req.body.todayDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      inMemoryData.transactions = [];
      inMemoryData.cashAccounts = inMemoryData.cashAccounts.map((c) => ({
        ...c,
        balance: 0,
        updatedDate: today
      }));
      inMemoryData.wallets = inMemoryData.wallets.map((w) => ({
        ...w,
        balance: 0,
        updatedDate: today
      }));
      saveServerData({
        ...inMemoryData,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/backup", (req, res) => {
    res.json({
      cashAccounts: inMemoryData.cashAccounts,
      wallets: inMemoryData.wallets,
      transactions: inMemoryData.transactions,
      shopProfile: inMemoryData.shopProfile,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.1.0"
    });
  });
  app.post("/api/restore", (req, res) => {
    try {
      const backup = req.body;
      if (backup.cashAccounts && backup.wallets && backup.transactions) {
        inMemoryData = {
          cashAccounts: backup.cashAccounts,
          wallets: backup.wallets,
          transactions: backup.transactions,
          shopProfile: backup.shopProfile || inMemoryData.shopProfile,
          settings: inMemoryData.settings,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
        saveServerData(inMemoryData);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid backup format" });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(3e3, "0.0.0.0", () => {
    console.log("Server running on port 3000");
    const detailed = getDetailedNetworkInterfaces();
    console.log(`
======================================================`);
    console.log(`\u{1F680} Money Agent POS Master Server running on port 3000 (0.0.0.0)`);
    console.log(`\u{1F4E1} Local Wi-Fi / Network IP Addresses for Client terminals:`);
    detailed.forEach((d) => {
      console.log(`   \u{1F449} http://${d.address}:3000 (${d.type} - ${d.name})`);
    });
    console.log(`======================================================
`);
  });
  process.on("SIGTERM", () => {
    server.close();
  });
  process.on("SIGINT", () => {
    server.close();
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
//# sourceMappingURL=server.cjs.map
