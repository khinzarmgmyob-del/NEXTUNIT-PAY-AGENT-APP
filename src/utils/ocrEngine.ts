import { createWorker } from 'tesseract.js';

export interface OcrSlipResult {
  success: boolean;
  rawText: string;
  confidence: number;
  data: {
    amount?: number;
    amountFormatted?: string;
    txnId?: string;
    phone?: string;
    date?: string;
    time?: string;
    type?: 'သွင်း' | 'ထုတ်' | 'လွှဲပြောင်း';
    walletName?: string;
    customerName?: string;
    notes?: string;
  };
  error?: string;
}

/**
 * Preprocesses an image via canvas to enhance contrast and clarity for OCR
 */
export async function preprocessSlipImage(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Resize if too huge to keep OCR fast, max 1600px width
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Apply contrast and grayscale boost for OCR
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            // Luminance
            const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            // Increase contrast (stretch range)
            const contrast = 1.25;
            const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
            const newV = Math.min(255, Math.max(0, factor * (v - 128) + 128));
            d[i] = newV;
            d[i + 1] = newV;
            d[i + 2] = newV;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Parses raw text extracted from transaction slips (KBZPay, WavePay, AYA, CB, Bank)
 */
export function parseSlipText(rawText: string): OcrSlipResult['data'] {
  const data: OcrSlipResult['data'] = {};
  const clean = rawText.replace(/\r/g, ' ');

  // 1. Detect Wallet / Provider
  if (/kbzpay|kpay|kbz\s*pay/i.test(clean)) {
    data.walletName = 'KPay';
  } else if (/wave\s*pay|wavemoney|wave\s*money/i.test(clean)) {
    data.walletName = 'WavePay';
  } else if (/aya\s*pay|ayapay/i.test(clean)) {
    data.walletName = 'AYA Pay';
  } else if (/cb\s*pay|cbpay/i.test(clean)) {
    data.walletName = 'CB Pay';
  } else if (/uab\s*pay|uabpay/i.test(clean)) {
    data.walletName = 'uabpay';
  } else if (/onepay|one\s*pay/i.test(clean)) {
    data.walletName = 'OnePay';
  } else if (/truemoney|true\s*money/i.test(clean)) {
    data.walletName = 'TrueMoney';
  }

  // 2. Detect Transaction Type
  if (/cash\s*in|ငွေသွင်း|deposit|received|လက်ခံ|inward/i.test(clean)) {
    data.type = 'သွင်း';
  } else if (/cash\s*out|ငွေထုတ်|withdraw|paid|ပေးချေ|outward/i.test(clean)) {
    data.type = 'ထုတ်';
  } else if (/transfer|လွှဲပြောင်း|send\s*money|send|လွှဲ/i.test(clean)) {
    data.type = 'လွှဲပြောင်း';
  } else {
    data.type = 'သွင်း'; // Default
  }

  // 3. Detect Amount (e.g. 50,000 Ks, 100,000 MMK, 150000.00)
  // Look for amount patterns: 3 to 8 digits, possibly comma-separated
  const amountRegexes = [
    /(?:Amount|Total|ငွေပမာဏ|ကျပ်|MMK|Ks|K)[\s:=-]*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]{4,8}(?:\.[0-9]{2})?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]{4,8}(?:\.[0-9]{2})?)\s*(?:MMK|Ks|Kyat|ကျပ်)/i,
    /(?:^|\s)([1-9][0-9]{1,2}(?:,[0-9]{3}){1,2})(?:$|\s|\.)/m,
  ];

  for (const regex of amountRegexes) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 500000000) {
        data.amount = parsed;
        data.amountFormatted = parsed.toLocaleString();
        break;
      }
    }
  }

  // 4. Detect Transaction ID / Ref No
  // e.g. "Transaction ID: 010029384849302", "Ref No: TXN12345678", "Ref: 987654321"
  const txnRegexes = [
    /(?:Transaction\s*ID|Txn\s*ID|Ref\s*No|Reference\s*No|Order\s*ID|အမှတ်|ဘောက်ချာ)[\s:=-]*([A-Za-z0-9]{6,30})/i,
    /(?:KBZ|WAVE|TXN|REF)[0-9A-Za-z]{6,24}/i,
    /\b(010[0-9]{13,18})\b/, // Typical KBZPay txn number
    /\b(10[0-9]{10,14})\b/,
  ];

  for (const regex of txnRegexes) {
    const match = clean.match(regex);
    if (match) {
      data.txnId = (match[1] || match[0]).trim();
      break;
    }
  }

  // 5. Detect Phone Number (09... or +959...)
  const phoneMatch = clean.match(/(?:(?:\+?95\s*9|09)[- ]?[0-9]{2,3}[- ]?[0-9]{3,4}[- ]?[0-9]{3,4})/);
  if (phoneMatch) {
    data.phone = phoneMatch[0].replace(/[- ]/g, '');
  }

  // 6. Detect Date
  // e.g. 2026-03-02, 02/03/2026, 02-Mar-2026
  const dateMatch = clean.match(/([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/);
  if (dateMatch) {
    data.date = dateMatch[1];
  } else {
    // Today fallback formatted YYYY-MM-DD
    const d = new Date();
    data.date = d.toISOString().split('T')[0];
  }

  // 7. Detect Time
  const timeMatch = clean.match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?(?:\s*(?:AM|PM|am|pm))?/);
  if (timeMatch) {
    data.time = timeMatch[0];
  }

  // 8. Detect Customer or Receiver Name if visible
  const nameMatch = clean.match(/(?:Receiver|To|To\s*Name|Payer|Sender|လက်ခံသူ|လွှဲပို့သူ)[\s:=-]+([A-Za-z\u1000-\u109F\s]{3,25})/i);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1].trim();
    if (!/amount|kyats|mmk|date|time|phone/i.test(rawName)) {
      data.customerName = rawName;
    }
  }

  data.notes = `OCR ဘောက်ချာဖတ်ချက် (Ref: ${data.txnId || 'Auto'})`;

  return data;
}

/**
 * Main OCR Scan Engine: Process image using Tesseract worker
 */
export async function scanSlipWithOcr(
  imageFile: File | Blob,
  onProgress?: (progress: number, statusText: string) => void
): Promise<OcrSlipResult> {
  try {
    onProgress?.(10, 'ပုံရိပ်အား OCR အတွက် ကြည်လင်အောင် ပြင်ဆင်နေပါသည်...');
    const preprocessedDataUrl = await preprocessSlipImage(imageFile);

    onProgress?.(25, 'OCR Engine (Tesseract) စတင်ဖွင့်လှစ်နေပါသည်...');
    const worker = await createWorker('eng+mya', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress) {
          const pct = Math.round(25 + m.progress * 65);
          onProgress?.(pct, `ဘောက်ချာ စာသားများအား ဖတ်ရှုနေပါသည် (${Math.round(m.progress * 100)}%)...`);
        }
      },
      errorHandler: (err) => console.warn('Tesseract worker error:', err),
    });

    onProgress?.(50, 'ဘောက်ချာ အချက်အလက်များအား ခွဲခြမ်းစိတ်ဖြာနေပါသည်...');
    const ret = await worker.recognize(preprocessedDataUrl);
    await worker.terminate();

    const rawText = ret.data.text;
    const confidence = ret.data.confidence || 85;

    onProgress?.(95, 'ငွေပမာဏ၊ ဖုန်းနံပါတ်နှင့် Ref ID များအား သတ်မှတ်နေပါသည်...');
    const parsedData = parseSlipText(rawText);

    onProgress?.(100, 'OCR ဖတ်ရှုခြင်း အောင်မြင်ပါသည်!');

    return {
      success: true,
      rawText,
      confidence,
      data: parsedData,
    };
  } catch (err: any) {
    console.error('OCR Engine error:', err);
    // Fallback: Return empty result with error
    return {
      success: false,
      rawText: '',
      confidence: 0,
      data: {
        date: new Date().toISOString().split('T')[0],
        type: 'သွင်း',
        notes: 'OCR scan error',
      },
      error: err?.message || 'OCR ဖတ်ရှုရာတွင် အမှားဖြစ်ပေါ်ပါသည်',
    };
  }
}
