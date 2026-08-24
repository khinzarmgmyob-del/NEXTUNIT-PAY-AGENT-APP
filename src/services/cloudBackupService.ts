import { BackupData } from '../types';

export interface CloudBackupConfig {
  enabled: boolean;
  frequency: 'transaction' | '15min' | 'hourly' | 'daily';
  lastBackupTime?: string;
  autoSaveToDrive: boolean;
  maxSnapshots: number;
}

export interface CloudSnapshot {
  id: string;
  timestamp: number;
  dateFormatted: string;
  timeFormatted: string;
  transactionCount: number;
  cashAccountsCount: number;
  walletsCount: number;
  totalCapital: number;
  label: string;
  data: BackupData;
}

const DEFAULT_CONFIG: CloudBackupConfig = {
  enabled: true,
  frequency: 'transaction',
  autoSaveToDrive: false,
  maxSnapshots: 10,
};

const CONFIG_KEY = 'app_cloud_backup_config';
const SNAPSHOTS_KEY = 'app_cloud_snapshots';

export const getCloudBackupConfig = (): CloudBackupConfig => {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
};

export const saveCloudBackupConfig = (config: CloudBackupConfig): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const getCloudSnapshots = (): CloudSnapshot[] => {
  const saved = localStorage.getItem(SNAPSHOTS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (e) {
      return [];
    }
  }
  return [];
};

const listeners: Array<(snapshots: CloudSnapshot[], lastTime: string) => void> = [];

export const subscribeCloudBackup = (
  callback: (snapshots: CloudSnapshot[], lastTime: string) => void
): (() => void) => {
  listeners.push(callback);
  const config = getCloudBackupConfig();
  callback(getCloudSnapshots(), config.lastBackupTime || '');
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

const notifyListeners = (snapshots: CloudSnapshot[], lastTime: string) => {
  listeners.forEach((cb) => cb(snapshots, lastTime));
};

/**
 * Create a new timestamped Cloud/Local snapshot
 */
export const createCloudSnapshot = (
  backupData: BackupData,
  label: string = 'အလိုအလျောက် Cloud Backup'
): CloudSnapshot => {
  const now = new Date();
  const config = getCloudBackupConfig();
  const existingSnapshots = getCloudSnapshots();

  const totalCash = (backupData.cashAccounts || []).reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalWallet = (backupData.wallets || []).reduce((sum, w) => sum + (w.balance || 0), 0);

  const newSnapshot: CloudSnapshot = {
    id: `SNAP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp: now.getTime(),
    dateFormatted: now.toISOString().split('T')[0],
    timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    transactionCount: (backupData.transactions || []).length,
    cashAccountsCount: (backupData.cashAccounts || []).length,
    walletsCount: (backupData.wallets || []).length,
    totalCapital: totalCash + totalWallet,
    label,
    data: backupData,
  };

  // Limit number of historical snapshots to maxSnapshots
  const updatedSnapshots = [newSnapshot, ...existingSnapshots].slice(0, config.maxSnapshots || 10);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updatedSnapshots));

  // Update last backup time
  const updatedConfig: CloudBackupConfig = {
    ...config,
    lastBackupTime: `${newSnapshot.dateFormatted} ${newSnapshot.timeFormatted}`,
  };
  saveCloudBackupConfig(updatedConfig);

  notifyListeners(updatedSnapshots, updatedConfig.lastBackupTime);
  return newSnapshot;
};

/**
 * Delete a specific snapshot
 */
export const deleteCloudSnapshot = (snapshotId: string): void => {
  const existing = getCloudSnapshots();
  const filtered = existing.filter((s) => s.id !== snapshotId);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
  const config = getCloudBackupConfig();
  notifyListeners(filtered, config.lastBackupTime || '');
};

/**
 * Clear all snapshots
 */
export const clearAllCloudSnapshots = (): void => {
  localStorage.removeItem(SNAPSHOTS_KEY);
  const config = getCloudBackupConfig();
  notifyListeners([], config.lastBackupTime || '');
};

/**
 * Trigger Auto-Backup automatically when a transaction is saved
 */
export const triggerAutoCloudBackup = (backupData: BackupData): void => {
  const config = getCloudBackupConfig();
  if (!config.enabled) return;

  try {
    createCloudSnapshot(backupData, 'အလိုအလျောက် စာရင်းသွင်းချိန် Backup (Auto)');
  } catch (err) {
    console.error('Auto cloud backup error:', err);
  }
};
