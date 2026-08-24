export type TransactionType = 'သွင်း' | 'ထုတ်' | 'လွှဲပြောင်း';
export type CommissionMode = 'deduct' | 'separate';
export type CommissionChannel = 'Cash' | 'Wallet';

export interface ShopProfile {
  shopName: string;
  address: string;
  phone: string;
  logoUrl?: string;
}

export interface CashAccountItem {
  id: number;
  name: string;
  balance: number;
  updatedDate: string;
  note?: string;
  color?: string;
}

export interface WalletItem {
  id: number;
  name: string;
  balance: number;
  updatedDate: string;
  accountNumber?: string;
  color?: string;
}

export interface Transaction {
  id: number;
  date: string;
  time?: string;
  customerName: string;
  type: TransactionType;
  amount: number;
  commission: number;
  commissionMode?: CommissionMode; // 'deduct' (မူလငွေမှ နုတ်ယူ) | 'separate' (သက်သက်ပေး)
  commissionChannel?: CommissionChannel; // 'Cash' (ငွေသားထဲဝင်) | 'Wallet' (Wallet ထဲကျန်/ဝင်)
  commissionWalletName?: string; // ကော်မရှင်လက်ခံမည့် Wallet အမည် (Wallet Channel အတွက်)
  netPayout?: number; // ဖောက်သည်သို့ လက်ငင်းပေးအပ်ငွေ
  phone: string;
  walletName: string; // e.g. KPay, WaveMoney, CB Pay (သို့မဟုတ် လွှဲထုတ်မည့် Wallet)
  targetWalletName?: string; // e.g. WaveMoney, CB Pay (လက်ခံမည့် Wallet - for 'လွှဲပြောင်း')
  cashAccountName?: string; // e.g. ဆိုင်ရှေ့ငွေပုံး, ကာတာငွေသေတ္တာ
  accountType?: 'Wallet' | 'Cash';
  note?: string;
}

export interface BackupData {
  cashAccounts: CashAccountItem[];
  cashBalance?: number;
  cashUpdatedDate?: string;
  wallets: WalletItem[];
  transactions: Transaction[];
  shopProfile?: ShopProfile;
  exportedAt: string;
  version?: string;
}

export type NetworkMode = 'server' | 'client';

export interface NetworkConfig {
  mode: NetworkMode;
  masterServerIp: string; // e.g. "http://192.168.1.100:3000"
  localServerPort: number; // e.g. 3000
  lastConnectedAt?: string;
  deviceLabel?: string;
}

