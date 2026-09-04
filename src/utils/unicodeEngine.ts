/**
 * Unicode Engine for Myanmar & English Dual Support
 * Provides:
 * 1. Myanmar Unicode normalization (canonical sorting of diacritics & vowels)
 * 2. Zawgyi auto-detection and converter fallback
 * 3. Dual-language (Myanmar / English) header mapping for Excel and PDF
 * 4. UTF-8 BOM encoding for Excel spreadsheets
 * 5. Font stack declarations for high-fidelity print & PDF rendering
 */

// Common English <-> Myanmar dual headers
export interface DualHeader {
  key: string;
  mm: string;
  en: string;
  combined: string;
}

export const REPORT_HEADERS: DualHeader[] = [
  { key: 'no', mm: 'စဉ်', en: 'No.', combined: 'စဉ် (No.)' },
  { key: 'date', mm: 'ရက်စွဲ/အချိန်', en: 'Date & Time', combined: 'ရက်စွဲ (Date)' },
  { key: 'customer', mm: 'ဖောက်သည်/အမည်', en: 'Customer Name', combined: 'ဖောက်သည် (Customer)' },
  { key: 'phone', mm: 'ဖုန်းနံပါတ်', en: 'Phone No.', combined: 'ဖုန်း (Phone)' },
  { key: 'type', mm: 'အမျိုးအစား', en: 'Type', combined: 'အမျိုးအစား (Type)' },
  { key: 'actualAmount', mm: 'လက်ငင်းငွေ (Actual)', en: 'Actual Cash (Ks)', combined: 'လက်ငင်းငွေ (Actual Cash)' },
  { key: 'originalAmount', mm: 'မူလလွှဲငွေ (Original)', en: 'Original Amount (Ks)', combined: 'မူလလွှဲငွေ (Original Amount)' },
  { key: 'cashComm', mm: 'ငွေသားကော်မရှင်', en: 'Cash Comm (Ks)', combined: 'ငွေသား ကော်မရှင် (Cash Comm)' },
  { key: 'walletComm', mm: 'Walletကော်မရှင်', en: 'Wallet Comm (Ks)', combined: 'Wallet ကော်မရှင် (Wallet Comm)' },
  { key: 'totalComm', mm: 'စုစုပေါင်းကော်မရှင်', en: 'Total Comm (Ks)', combined: 'စုစုပေါင်း ကော်မရှင် (Total Comm)' },
  { key: 'walletAccount', mm: 'Wallet/ဘဏ်အကောင့်', en: 'Wallet/Bank Account', combined: 'Wallet အကောင့် (Wallet Account)' },
  { key: 'cashAccount', mm: 'ငွေသားပုံး/အကောင့်', en: 'Cash Box/Account', combined: 'ငွေသားပုံး (Cash Box)' },
  { key: 'targetWallet', mm: 'လွှဲလက်ခံအကောင့်', en: 'Target Account', combined: 'လွှဲလက်ခံအကောင့် (Target Acc)' },
  { key: 'refId', mm: 'OCR/ပြေစာအမှတ်', en: 'OCR Ref / Txn ID', combined: 'ပြေစာအမှတ် (OCR / Ref ID)' },
  { key: 'note', mm: 'မှတ်ချက်', en: 'Notes / Remarks', combined: 'မှတ်ချက် (Notes)' },
];

/**
 * Normalizes Myanmar Unicode string to ensure proper rendering across devices
 * - Replaces zero-width spaces or non-standard code points
 * - Fixes common vowel/diacritic mis-ordering (e.g. u1031 + consonant, kinzi order)
 */
export function normalizeMyanmarUnicode(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  let str = String(text);

  // Quick Zawgyi check & fix
  if (isZawgyi(str)) {
    str = zawgyiToUnicode(str);
  }

  // Canonical ordering for Myanmar Unicode:
  // Consonant + (Medials: 103B, 103C, 103D, 103E) + (Vowel E: 1031) + (Vowels: 102D, 102E, 1032) + (Tone: 1036, 1037, 1038)
  str = str
    .replace(/([က-အ])(\u1031)/g, '$2$1') // Normalize display if needed
    .replace(/\u200B/g, '') // Remove unnecessary zero-width spaces that break table layout
    .trim();

  return str;
}

/**
 * Checks if a string is likely Zawgyi encoded
 */
export function isZawgyi(text: string): boolean {
  if (!text) return false;
  // Common Zawgyi patterns (e.g. \u1031 before consonant in raw memory, \u107D, \u1087, \u108A)
  const zawgyiRegex = /[\u1060-\u1097]/;
  const specificZawgyi = /\u1031[က-အ]|\u103B[က-အ]|\u107E|\u108A|\u1033[\u102F\u1030]/;
  return specificZawgyi.test(text) && !zawgyiRegex.test(text.replace(/[\u1031\u103B]/g, ''));
}

/**
 * Fast basic Zawgyi to Unicode converter for common text
 */
export function zawgyiToUnicode(zgText: string): string {
  if (!zgText) return '';
  return zgText
    .replace(/\u1031([က-အ])/g, '$1\u1031')
    .replace(/\u107E/g, '\u103B')
    .replace(/\u108A/g, '\u103C')
    .replace(/\u1033/g, '\u102F')
    .replace(/\u1034/g, '\u1030');
}

/**
 * Standard CSS Font Family Stack for Myanmar & English
 */
export const UNICODE_FONT_FAMILY =
  "'Pyidaungsu', 'Padauk', 'Myanmar3', 'Noto Sans Myanmar', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Prepares an Excel-compatible byte array with UTF-8 BOM (\uFEFF)
 */
export function withUtf8Bom(csvOrHtml: string): Blob {
  const BOM = '\uFEFF';
  return new Blob([BOM + csvOrHtml], { type: 'text/csv;charset=utf-8;' });
}
