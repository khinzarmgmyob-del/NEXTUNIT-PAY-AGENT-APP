import { Transaction, ShopProfile } from '../types';
import { formatKs } from './formatters';

export interface BluetoothPrinterDevice {
  id: string;
  name: string;
  connected: boolean;
  paperWidth: '58mm' | '80mm';
}

// Global active Bluetooth device state
let activeBluetoothDevice: any = null;
let activeCharacteristic: any = null;

// Standard Bluetooth Thermal Printer GATT UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Raw Data Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common HM-10 / CC2541 Thermal
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

const PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-aca3-4815-a43e-84671e3843bc',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export const isWebBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

/**
 * Connect to a Bluetooth Thermal POS Printer
 */
export const connectBluetoothPrinter = async (): Promise<{
  success: boolean;
  name: string;
  message: string;
}> => {
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      name: '',
      message: 'သင့် Browser တွင် Web Bluetooth API ကို အသုံးမပြုနိုင်ပါ။ Google Chrome သို့မဟုတ် Android Chrome ဖြင့် ဖွင့်ပေးပါ။',
    };
  }

  try {
    // Request device with printer filter or accept all
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });

    if (!device) {
      return { success: false, name: '', message: 'Bluetooth Device ကို မရွေးချယ်ခဲ့ပါ။' };
    }

    const server = await device.gatt?.connect();
    if (!server) {
      return { success: false, name: device.name || 'Printer', message: 'GATT Server သို့ ချိတ်ဆက်၍ မရပါ' };
    }

    // Discover services
    let charFound: any = null;
    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          for (const charUuid of PRINTER_CHARACTERISTICS) {
            try {
              const char = await service.getCharacteristic(charUuid);
              if (char) {
                charFound = char;
                break;
              }
            } catch (e) {
              // Ignore single characteristic miss
            }
          }
          if (charFound) break;
        }
      } catch (e) {
        // Ignore single service miss
      }
    }

    // Fallback: If not found in known lists, inspect all services
    if (!charFound) {
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              charFound = c;
              break;
            }
          }
          if (charFound) break;
        }
      } catch (err) {
        console.warn('Fallback service discovery error:', err);
      }
    }

    activeBluetoothDevice = device;
    activeCharacteristic = charFound;

    const deviceName = device.name || 'Bluetooth POS Printer';
    localStorage.setItem('app_bt_printer_name', deviceName);

    return {
      success: true,
      name: deviceName,
      message: `"${deviceName}" Bluetooth Printer နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။`,
    };
  } catch (error: any) {
    console.error('Bluetooth Connection Error:', error);
    return {
      success: false,
      name: '',
      message: `Bluetooth ချိတ်ဆက်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${error.message || 'ချိတ်ဆက်မှု မအောင်မြင်ပါ'}`,
    };
  }
};

/**
 * Disconnect active Bluetooth Printer
 */
export const disconnectBluetoothPrinter = async (): Promise<void> => {
  if (activeBluetoothDevice && activeBluetoothDevice.gatt?.connected) {
    activeBluetoothDevice.gatt.disconnect();
  }
  activeBluetoothDevice = null;
  activeCharacteristic = null;
};

export const getBluetoothConnectionStatus = (): {
  isConnected: boolean;
  name: string;
} => {
  const isConnected = !!(activeBluetoothDevice && activeBluetoothDevice.gatt?.connected);
  const name = activeBluetoothDevice?.name || localStorage.getItem('app_bt_printer_name') || 'None';
  return { isConnected, name };
};

/**
 * Helper to encode text into bytes (ASCII / Latin1 fallback for ESC/POS)
 */
const textToBytes = (text: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(text);
};

/**
 * Build ESC/POS Command Byte Buffer for Money Agent POS Voucher
 */
export const buildEscPosVoucher = (
  tx: Transaction,
  shop: ShopProfile,
  paperWidth: '58mm' | '80mm' = '58mm'
): Uint8Array => {
  const is58 = paperWidth === '58mm';
  const divider = is58 ? '--------------------------------\n' : '------------------------------------------------\n';
  const doubleDivider = is58 ? '================================\n' : '================================================\n';

  const isCashOut = tx.type === 'ထုတ်';
  const isTransfer = tx.type === 'လွှဲပြောင်း';
  const isDeducted = tx.commissionMode === 'deduct';
  const netCash = tx.netPayout !== undefined
    ? tx.netPayout
    : (isCashOut && isDeducted ? (tx.amount - tx.commission) : tx.amount);

  const typeLabel = isTransfer
    ? 'W2W Transfer'
    : tx.type === 'သွင်း'
    ? 'Cash In (Deposit)'
    : 'Cash Out (Withdraw)';

  // ESC/POS Commands
  const ESC = '\x1b';
  const GS = '\x1d';
  const INIT = `${ESC}@`;
  const ALIGN_CENTER = `${ESC}a\x01`;
  const ALIGN_LEFT = `${ESC}a\x00`;
  const ALIGN_RIGHT = `${ESC}a\x02`;
  const BOLD_ON = `${ESC}E\x01`;
  const BOLD_OFF = `${ESC}E\x00`;
  const DOUBLE_SIZE_ON = `${GS}!\x11`;
  const DOUBLE_SIZE_OFF = `${GS}!\x00`;
  const CUT_PAPER = `${GS}V\x41\x10`;

  let p = '';
  p += INIT;
  p += ALIGN_CENTER;
  p += BOLD_ON;
  p += DOUBLE_SIZE_ON;
  p += `${shop.shopName || 'MONEY AGENT POS'}\n`;
  p += DOUBLE_SIZE_OFF;
  p += BOLD_OFF;

  if (shop.address) p += `${shop.address}\n`;
  if (shop.phone) p += `Tel: ${shop.phone}\n`;
  p += `${isTransfer ? 'WALLET TO WALLET RECEIPT' : 'AGENT TRANSACTION SLIP'}\n`;
  p += divider;

  p += ALIGN_LEFT;
  p += `Voucher #: #${tx.id}\n`;
  p += `Date/Time: ${tx.date} ${tx.time || ''}\n`;
  p += `Customer:  ${tx.customerName}\n`;
  p += `Phone:     ${tx.phone || '-'}\n`;
  p += `Type:      ${typeLabel}\n`;

  if (isTransfer) {
    p += `From:      ${tx.walletName}\n`;
    p += `To:        ${tx.targetWalletName || '-'}\n`;
  } else {
    p += `Wallet:    ${tx.walletName}\n`;
  }

  if (tx.cashAccountName) {
    p += `Drawer:    ${tx.cashAccountName}\n`;
  }

  p += divider;
  p += BOLD_ON;
  p += `Amount:     ${tx.amount.toLocaleString()} Ks\n`;
  p += `Fee/Comm:  +${tx.commission.toLocaleString()} Ks\n`;

  if (isCashOut) {
    p += `Net Payout: ${netCash.toLocaleString()} Ks\n`;
  }
  p += BOLD_OFF;

  if (tx.note) {
    p += divider;
    p += `Note: ${tx.note}\n`;
  }

  p += doubleDivider;
  p += ALIGN_CENTER;
  p += 'Thank you for your business!\n';
  p += 'Powered by Money Agent POS\n\n\n\n';
  p += CUT_PAPER;

  return textToBytes(p);
};

/**
 * Send Raw Bytes to Connected Bluetooth Printer
 */
export const printRawBytesViaBluetooth = async (data: Uint8Array): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!activeCharacteristic) {
    return {
      success: false,
      message: 'Bluetooth Printer နှင့် ချိတ်ဆက်မထားသေးပါ။ ပထမဆုံး Printer ကို ချိတ်ဆက်ပေးပါ။',
    };
  }

  try {
    // Send in chunks of 512 bytes (standard BLE MTU safe limit)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (activeCharacteristic.writeValueWithoutResponse) {
        await activeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await activeCharacteristic.writeValue(chunk);
      }
      // Small pause between chunks
      await new Promise((res) => setTimeout(res, 35));
    }

    return {
      success: true,
      message: 'ပြေစာ (Voucher) ကို Bluetooth Printer သို့ အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ။',
    };
  } catch (err: any) {
    console.error('Print Error:', err);
    return {
      success: false,
      message: `Print ထုတ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err.message || 'Printer ပို့မရပါ'}`,
    };
  }
};

/**
 * Print Transaction directly via Bluetooth
 */
export const printTransactionViaBluetooth = async (
  tx: Transaction,
  shop: ShopProfile,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<{ success: boolean; message: string }> => {
  const bytes = buildEscPosVoucher(tx, shop, paperWidth);
  return printRawBytesViaBluetooth(bytes);
};

/**
 * Print Self-Test Sample Ticket
 */
export const printTestPageViaBluetooth = async (
  shop: ShopProfile,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<{ success: boolean; message: string }> => {
  const is58 = paperWidth === '58mm';
  const divider = is58 ? '--------------------------------\n' : '------------------------------------------------\n';
  
  const p = `
\x1b@\x1ba\x01\x1bE\x01\x1d!\x11${shop.shopName || 'MONEY AGENT POS'}\x1d!\x00\x1bE\x00
\x1ba\x01*** BLUETOOTH TEST OK ***
${divider}\x1ba\x00
Status:    Printer Connected!
Paper:     ${paperWidth} Thermal
Date:      ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
System:    Money Agent POS v1.1
${divider}\x1ba\x01Thank you!
\n\n\n\x1dV\x41\x10
`.trim();

  return printRawBytesViaBluetooth(textToBytes(p));
};
