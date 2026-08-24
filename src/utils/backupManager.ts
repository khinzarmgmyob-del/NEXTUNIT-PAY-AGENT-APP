import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BackupData, CashAccountItem, WalletItem, Transaction, ShopProfile } from '../types';

export interface BackupResult {
  success: boolean;
  message: string;
  fileName?: string;
  fileUri?: string;
  isNative?: boolean;
}

/**
 * Generate standardized backup filename
 */
export const generateBackupFileName = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `money_agent_backup_${dateStr}_${timeStr}.json`;
};

/**
 * Export backup data to JSON file with Android Capacitor Filesystem & Share support
 */
export const exportBackupData = async (
  backupData: BackupData,
  shareDirectly: boolean = true
): Promise<BackupResult> => {
  try {
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = generateBackupFileName();

    // 1. Android / iOS Native Capacitor Handling
    if (Capacitor.isNativePlatform()) {
      let fileUri = '';

      try {
        // Try writing to Documents directory first
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        fileUri = writeResult.uri;
      } catch (docError) {
        console.warn('Documents directory write failed, falling back to Cache directory', docError);
        // Fallback to Cache directory for Android if Documents permission is restricted
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        fileUri = cacheResult.uri;
      }

      // If Share is requested, open native Android share sheet (Save to Drive, Telegram, Files, etc.)
      if (shareDirectly && fileUri) {
        try {
          await Share.share({
            title: 'Money Agent POS Backup',
            text: `Money Agent POS စာရင်း Backup ဖိုင် (${backupData.exportedAt})`,
            url: fileUri,
            dialogTitle: 'Backup ဖိုင် သိမ်းဆည်းရန် သို့မဟုတ် Share လုပ်ရန် နေရာရွေးပါ',
          });
        } catch (shareError) {
          console.log('User cancelled or dismissed share dialog', shareError);
        }
      }

      return {
        success: true,
        message: `Android ဖုန်းထဲသို့ Backup ဖိုင် (${fileName}) အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`,
        fileName,
        fileUri,
        isNative: true,
      };
    }

    // 2. Web Browser Fallback (Standard Blob Download + Optional Web Share)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    // Optional Web Share API if supported in browser
    if (shareDirectly && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Money Agent POS Backup',
            files: [file],
          });
        }
      } catch (webShareErr) {
        console.log('Web share dismissed', webShareErr);
      }
    }

    return {
      success: true,
      message: `Backup ဖိုင် (${fileName}) အောင်မြင်စွာ ဒေါင်းလုဒ် ပြုလုပ်ပြီးပါပြီ။`,
      fileName,
      isNative: false,
    };
  } catch (error: any) {
    console.error('Export Backup Error:', error);
    return {
      success: false,
      message: `Backup ပြုလုပ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error?.message || 'မသိရသောအမှား'}`,
    };
  }
};

/**
 * Validate and sanitize parsed backup JSON content
 */
export const validateAndSanitizeBackupData = (rawObj: any): BackupData => {
  if (!rawObj || typeof rawObj !== 'object') {
    throw new Error('ဖိုင်ဖော်မတ် မမှန်ကန်ပါ။ JSON Object ဖော်မတ် ဖြစ်ရပါမည်။');
  }

  // Ensure at least one critical dataset is present
  const hasAccounts = Array.isArray(rawObj.cashAccounts) || typeof rawObj.cashBalance === 'number';
  const hasWallets = Array.isArray(rawObj.wallets);
  const hasTransactions = Array.isArray(rawObj.transactions);

  if (!hasAccounts && !hasWallets && !hasTransactions) {
    throw new Error('ဖိုင်အတွင်း Money Agent POS ၏ အချက်အလက်များ မတွေ့ရှိပါ။ မှန်ကန်သော Backup ဖိုင်ကို ရွေးချယ်ပါ။');
  }

  // 1. Sanitize Cash Accounts
  let sanitizedCashAccounts: CashAccountItem[] = [];
  if (Array.isArray(rawObj.cashAccounts)) {
    sanitizedCashAccounts = rawObj.cashAccounts.map((item: any, idx: number) => ({
      id: Number(item.id) || idx + 1,
      name: String(item.name || `ငွေသားအကောင့် ${idx + 1}`),
      balance: Number(item.balance) || 0,
      updatedDate: String(item.updatedDate || new Date().toISOString().split('T')[0]),
      note: item.note ? String(item.note) : undefined,
      color: item.color ? String(item.color) : undefined,
    }));
  } else if (typeof rawObj.cashBalance === 'number') {
    sanitizedCashAccounts = [
      {
        id: 1,
        name: 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)',
        balance: Number(rawObj.cashBalance) || 0,
        updatedDate: String(rawObj.cashUpdatedDate || new Date().toISOString().split('T')[0]),
        note: 'ကောင်တာ ၁',
      },
    ];
  }

  // 2. Sanitize Wallets
  let sanitizedWallets: WalletItem[] = [];
  if (Array.isArray(rawObj.wallets)) {
    sanitizedWallets = rawObj.wallets.map((w: any, idx: number) => ({
      id: Number(w.id) || idx + 1,
      name: String(w.name || `Wallet ${idx + 1}`),
      balance: Number(w.balance) || 0,
      updatedDate: String(w.updatedDate || new Date().toISOString().split('T')[0]),
      accountNumber: w.accountNumber ? String(w.accountNumber) : undefined,
      color: w.color ? String(w.color) : undefined,
    }));
  }

  // 3. Sanitize Transactions
  let sanitizedTransactions: Transaction[] = [];
  if (Array.isArray(rawObj.transactions)) {
    sanitizedTransactions = rawObj.transactions.map((t: any, idx: number) => ({
      id: Number(t.id) || idx + 1,
      date: String(t.date || new Date().toISOString().split('T')[0]),
      time: t.time ? String(t.time) : undefined,
      customerName: String(t.customerName || 'အမည်မသိ'),
      type: t.type === 'ထုတ်' ? 'ထုတ်' : 'သွင်း',
      amount: Number(t.amount) || 0,
      commission: Number(t.commission) || 0,
      commissionMode: t.commissionMode === 'deduct' ? 'deduct' : 'separate',
      commissionChannel: t.commissionChannel === 'Cash' ? 'Cash' : 'Wallet',
      netPayout: t.netPayout !== undefined ? Number(t.netPayout) : undefined,
      phone: String(t.phone || '-'),
      walletName: String(t.walletName || 'KPay'),
      cashAccountName: String(t.cashAccountName || 'ဆိုင်ရှေ့ငွေပုံး (Counter Box)'),
      note: t.note ? String(t.note) : undefined,
    }));
  }

  // 4. Sanitize Shop Profile
  let sanitizedProfile: ShopProfile = {
    shopName: 'Money Agent POS',
    address: '',
    phone: '',
  };
  if (rawObj.shopProfile && typeof rawObj.shopProfile === 'object') {
    sanitizedProfile = {
      shopName: String(rawObj.shopProfile.shopName || 'Money Agent POS'),
      address: String(rawObj.shopProfile.address || ''),
      phone: String(rawObj.shopProfile.phone || ''),
      logoUrl: rawObj.shopProfile.logoUrl ? String(rawObj.shopProfile.logoUrl) : undefined,
    };
  }

  return {
    cashAccounts: sanitizedCashAccounts,
    wallets: sanitizedWallets,
    transactions: sanitizedTransactions,
    shopProfile: sanitizedProfile,
    exportedAt: String(rawObj.exportedAt || new Date().toISOString()),
    version: String(rawObj.version || '2.0.0'),
  };
};

/**
 * Read and validate JSON backup from browser File object
 */
export const readBackupFromFile = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('ဖိုင် ရွေးချယ်ထားခြင်း မရှိပါ။'));
    }

    if (!file.name.toLowerCase().endsWith('.json') && file.type && !file.type.includes('json')) {
      return reject(new Error('ရွေးချယ်ထားသော ဖိုင်သည် JSON Backup ဖိုင် မဟုတ်ပါ။'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const textContent = e.target?.result as string;
        if (!textContent || !textContent.trim()) {
          throw new Error('ဖိုင်အတွင်း မည်သည့် အချက်အလက်မျှ မရှိပါ (ဖိုင်အလွတ်ဖြစ်နေပါသည်)။');
        }

        const parsedJson = JSON.parse(textContent);
        const validData = validateAndSanitizeBackupData(parsedJson);
        resolve(validData);
      } catch (err: any) {
        reject(new Error(err.message || 'JSON ဖိုင်ဖတ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။'));
      }
    };

    reader.onerror = () => {
      reject(new Error('ဖုန်း/စက်အတွင်းမှ ဖိုင်ကို ဖွင့်ဖတ်၍ မရပါ (Permission သို့မဟုတ် File Read Error ဖြစ်နိုင်ပါသည်)။'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};
