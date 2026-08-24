import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Power,
  FileText,
  HelpCircle,
} from 'lucide-react';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothConnectionStatus,
  printTestPageViaBluetooth,
  isWebBluetoothSupported,
} from '../utils/bluetoothPrinter';
import { ShopProfile } from '../types';

interface BluetoothPrinterModalProps {
  shopProfile: ShopProfile;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({
  shopProfile,
  onClose,
  onShowToast,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('None');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(() => {
    const saved = localStorage.getItem('app_bt_paper_width');
    return (saved === '80mm' ? '80mm' : '58mm') as '58mm' | '80mm';
  });

  const isBtSupported = isWebBluetoothSupported();

  useEffect(() => {
    const status = getBluetoothConnectionStatus();
    setIsConnected(status.isConnected);
    setDeviceName(status.name);
  }, []);

  const handlePaperWidthChange = (val: '58mm' | '80mm') => {
    setPaperWidth(val);
    localStorage.setItem('app_bt_paper_width', val);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await connectBluetoothPrinter();
      if (res.success) {
        setIsConnected(true);
        setDeviceName(res.name);
        onShowToast(res.message, 'success');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(`Bluetooth ချိတ်ဆက်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err.message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectBluetoothPrinter();
    setIsConnected(false);
    setDeviceName('None');
    onShowToast('Bluetooth Printer ချိတ်ဆက်မှု ဖြုတ်လိုက်ပါပြီ။', 'info');
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      onShowToast('ပထမဆုံး Bluetooth Printer ကို ချိတ်ဆက်ပေးပါ။', 'error');
      return;
    }

    setIsPrintingTest(true);
    try {
      const res = await printTestPageViaBluetooth(shopProfile, paperWidth);
      if (res.success) {
        onShowToast(res.message, 'success');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(`Test Print အမှား: ${err.message}`, 'error');
    } finally {
      setIsPrintingTest(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Bluetooth Thermal Receipt Printer စနစ်
              </h3>
              <p className="text-[11px] text-slate-400">58mm / 80mm အပူပေး ပရင့်တာဖြင့် ပြေစာထုတ်ခြင်း</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Bluetooth Compatibility Warning if not supported */}
          {!isBtSupported && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <b>သတိပေးချက်:</b> သင့် Browser (သို့မဟုတ် Webview) တွင် Web Bluetooth API မဖွင့်ရသေးပါ။ Android ဖုန်းများတွင် <b>Google Chrome</b> (သို့မဟုတ် Installed Android App) ဖြင့် ဖွင့်လှစ်ပါက Bluetooth Thermal Print ကို အပြည့်အဝ အသုံးပြုနိုင်ပါမည်။
              </div>
            </div>
          )}

          {/* Connection Status Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Bluetooth className="w-4 h-4 text-indigo-600" />
                Printer ချိတ်ဆက်မှု အခြေအနေ:
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    CONNECTED
                  </>
                ) : (
                  'DISCONNECTED'
                )}
              </span>
            </div>

            {isConnected && (
              <div className="p-2.5 bg-white border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">ချိတ်ဆက်ထားသည့် Device:</span>
                <span className="font-bold text-slate-900 font-mono">{deviceName}</span>
              </div>
            )}

            {/* Connect / Disconnect Buttons */}
            <div className="flex gap-2 pt-1">
              {!isConnected ? (
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleConnect}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ရှာဖွေချိတ်ဆက်နေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Bluetooth Printer နှင့် ချိတ်ဆက်မည်</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>ချိတ်ဆက်မှု ဖြုတ်မည်</span>
                </button>
              )}
            </div>
          </div>

          {/* Paper Size Selector */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5">
            <label className="block text-xs font-bold text-slate-700">
              စက္ကူအရွယ်အစား (Paper Width) ရွေးချယ်ရန်:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePaperWidthChange('58mm')}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-xs text-slate-900 mb-0.5">58mm (လက်ကိုင် ပရင့်တာ)</div>
                <div className="text-[11px] text-slate-500">Standard Mini Portable Printer</div>
              </button>

              <button
                type="button"
                onClick={() => handlePaperWidthChange('80mm')}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-xs text-slate-900 mb-0.5">80mm (ကောင်တာ ပရင့်တာ)</div>
                <div className="text-[11px] text-slate-500">Large Desktop POS Printer</div>
              </button>
            </div>
          </div>

          {/* Test Print Action */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                စမ်းသပ် ပြေစာ ပရင့်ထုတ်ခြင်း (Test Print)
              </span>
            </div>
            <p className="text-[11px] text-purple-900/80 leading-relaxed">
              Bluetooth Printer အလုပ်လုပ်မှု မှန်ကန်စေရန် အစမ်းပြေစာ ပရင့်ထုတ်ပြီး စစ်ဆေးနိုင်ပါသည်။
            </p>
            <button
              type="button"
              disabled={!isConnected || isPrintingTest}
              onClick={handleTestPrint}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPrintingTest ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>စမ်းသပ်ထုတ်နေပါသည်...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Test Page စမ်းသပ်ထုတ်မည်</span>
                </>
              )}
            </button>
          </div>

          {/* Guide / Supported Printers */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
              ထောက်ပံ့ပေးထားသော ပရင့်တာများ:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>Xprinter, MPT, PeriPage, GOOJPRT, PT-210 အပူပေး Bluetooth ပရင့်တာများ</li>
              <li>58mm / 80mm ESC/POS Command စနစ်သုံး ပရင့်တာများအားလုံး</li>
              <li>မိုဘိုင်းဖုန်း Bluetooth ဖွင့်ထားပြီး Printer ကို Turn On လုပ်ထားရန် လိုအပ်ပါသည်</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 mt-2 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
