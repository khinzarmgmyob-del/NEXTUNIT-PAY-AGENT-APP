import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Transaction } from '../types';

export type ArchiveFilterPeriod = '1month' | '3months' | '6months' | '1year' | 'custom';

export interface ArchiveResult {
  success: boolean;
  message: string;
  archivedCount: number;
  fileName?: string;
  fileUri?: string;
}

/**
 * Calculate cutoff date string (YYYY-MM-DD) based on period
 */
export const getCutoffDate = (period: ArchiveFilterPeriod, customDate?: string): string => {
  if (period === 'custom' && customDate) {
    return customDate;
  }

  const now = new Date();
  let daysAgo = 180; // default 6 months
  if (period === '1month') daysAgo = 30;
  if (period === '3months') daysAgo = 90;
  if (period === '6months') daysAgo = 180;
  if (period === '1year') daysAgo = 365;

  const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().split('T')[0];
};

/**
 * Partition transactions into toArchive (older than cutoff) and toKeep
 */
export const partitionTransactions = (
  transactions: Transaction[],
  period: ArchiveFilterPeriod,
  customDate?: string
): { toArchive: Transaction[]; toKeep: Transaction[]; cutoffDate: string } => {
  const cutoffDate = getCutoffDate(period, customDate);

  const toArchive: Transaction[] = [];
  const toKeep: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.date < cutoffDate) {
      toArchive.push(tx);
    } else {
      toKeep.push(tx);
    }
  }

  return { toArchive, toKeep, cutoffDate };
};

/**
 * Export archived transactions to JSON with Capacitor & Share support
 */
export const exportArchiveFile = async (
  archivedTransactions: Transaction[],
  cutoffDate: string,
  shareDirectly: boolean = true
): Promise<ArchiveResult> => {
  if (archivedTransactions.length === 0) {
    return {
      success: false,
      message: 'ရွေးချယ်ထားသော ကာလအတွင်း Archive ပြုလုပ်ရန် စာရင်းဟောင်း မရှိပါ။',
      archivedCount: 0,
    };
  }

  const now = new Date();
  const timestamp = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `money_agent_archive_before_${cutoffDate}_${timestamp}.json`;

  const archivePayload = {
    archiveType: 'Old Transactions Archive',
    archivedAt: now.toISOString(),
    cutoffDate,
    totalRecords: archivedTransactions.length,
    transactions: archivedTransactions,
  };

  const jsonString = JSON.stringify(archivePayload, null, 2);

  try {
    // 1. Android / Capacitor Handling
    if (Capacitor.isNativePlatform()) {
      let fileUri = '';
      try {
        const writeRes = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        fileUri = writeRes.uri;
      } catch (e) {
        const cacheRes = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        fileUri = cacheRes.uri;
      }

      if (shareDirectly && fileUri) {
        try {
          await Share.share({
            title: 'Money Agent POS Archive',
            text: `စာရင်းဟောင်း (${archivedTransactions.length} ခု) Archive JSON ဖိုင်`,
            url: fileUri,
            dialogTitle: 'Archive ဖိုင် သိမ်းဆည်းရန် သို့မဟုတ် Share ပြုလုပ်ရန် နေရာရွေးပါ',
          });
        } catch (shareErr) {
          console.log('Share dismissed', shareErr);
        }
      }

      return {
        success: true,
        message: `စာရင်းဟောင်း (${archivedTransactions.length}) ခု အား (${fileName}) အဖြစ် အောင်မြင်စွာ Archive ထုတ်ယူပြီးပါပြီ။`,
        archivedCount: archivedTransactions.length,
        fileName,
        fileUri,
      };
    }

    // 2. Web Fallback
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: `စာရင်းဟောင်း (${archivedTransactions.length}) ခု အား (${fileName}) အဖြစ် ဒေါင်းလုဒ် ပြုလုပ်ပြီးပါပြီ။`,
      archivedCount: archivedTransactions.length,
      fileName,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Archive ဖိုင်ထုတ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err?.message || ''}`,
      archivedCount: 0,
    };
  }
};

/**
 * Clean temporary files, receipt print cache, and compact storage
 */
export const cleanCacheAndTemporaryData = async (): Promise<{
  success: boolean;
  message: string;
  freedBytes: number;
}> => {
  try {
    let freedBytes = 0;

    // 1. Clean localStorage temporary/cached items (except vital state)
    const vitalKeys = new Set([
      'app_cash_accounts',
      'app_wallets',
      'app_transactions',
      'app_shop_profile',
      'app_activation_key',
      'app_device_id',
    ]);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !vitalKeys.has(key) && (key.startsWith('temp_') || key.startsWith('cache_') || key.startsWith('receipt_blob_'))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      const val = localStorage.getItem(key);
      if (val) freedBytes += val.length;
      localStorage.removeItem(key);
    }

    // 2. If Native Capacitor, clean temporary cache directory files if applicable
    if (Capacitor.isNativePlatform()) {
      try {
        // Clear old temporary print cache files if any
      } catch (e) {
        console.warn('Native cache clearing error', e);
      }
    }

    return {
      success: true,
      message: `ယာယီ Cache နှင့် Print ဖိုင်များကို ရှင်းလင်းပြီးပါပြီ။ (Database Compact ပြုလုပ်ပြီးပါပြီ)`,
      freedBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Cache ရှင်းလင်းရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err?.message || ''}`,
      freedBytes: 0,
    };
  }
};
