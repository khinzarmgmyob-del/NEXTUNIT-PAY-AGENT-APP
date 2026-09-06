import React, { useState, useEffect } from 'react';
import {
  Printer,
  Wifi,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  X,
  Zap,
  Check,
  Server,
  Smartphone,
  Info,
} from 'lucide-react';
import {
  NetworkPrinter,
  getSavedNetworkPrinter,
  saveNetworkPrinter,
  getKnownNetworkPrinters,
  autoScanLocalNetwork,
  probePrinterIp,
  autoRunVirtualDriver,
  generateTestPrintHtml,
  DEFAULT_SYSTEM_PRINTER,
} from '../utils/networkPrinterDriver';
import { ShopProfile } from '../types';

interface NetworkPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopProfile?: ShopProfile;
  onPrinterConnected?: (printer: NetworkPrinter) => void;
}

export const NetworkPrinterModal: React.FC<NetworkPrinterModalProps> = ({
  isOpen,
  onClose,
  shopProfile,
  onPrinterConnected,
}) => {
  const [activePrinter, setActivePrinter] = useState<NetworkPrinter>(getSavedNetworkPrinter);
  const [knownPrinters, setKnownPrinters] = useState<NetworkPrinter[]>(getKnownNetworkPrinters);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [subnetBase, setSubnetBase] = useState('192.168.1');
  
  // Custom manual IP config
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState(9100);
  const [isTestingManual, setIsTestingManual] = useState(false);
  const [manualStatusMessage, setManualStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Test printing state
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getSavedNetworkPrinter();
      setActivePrinter(current);
      setKnownPrinters(getKnownNetworkPrinters());
      setStatusMessage(null);
      setManualStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto scan local network subnet
  const handleAutoScan = async () => {
    setIsScanning(true);
    setScanProgress({ scanned: 0, total: 15 });
    setStatusMessage({ text: 'ဒေသတွင်း Wi-Fi Network ပရင်တာများကို ရှာဖွေနေပါသည်...', type: 'info' });

    try {
      const found = await autoScanLocalNetwork(subnetBase, (scanned, total) => {
        setScanProgress({ scanned, total });
      });

      setKnownPrinters(found);
      setIsScanning(false);
      setScanProgress(null);

      if (found.length > 1) {
        // Auto select the first real network printer found
        const best = found[1];
        handleSelectPrinter(best);
        setStatusMessage({
          text: `Wi-Fi ပရင်တာ ${found.length - 1} လုံး တွေ့ရှိပြီး ${best.name} သို့ ချိတ်ဆက်လိုက်ပါပြီ။`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'တိုက်ရိုက် IP ပရင်တာ မတွေ့ရှိပါက Android/Tablet System Spooler ကို အသုံးပြု၍ Wi-Fi မှ တိုက်ရိုက် ထုတ်နိုင်ပါသည်။',
          type: 'info',
        });
      }
    } catch (err: any) {
      setIsScanning(false);
      setScanProgress(null);
      setStatusMessage({ text: `ရှာဖွေရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`, type: 'error' });
    }
  };

  // Select and connect printer
  const handleSelectPrinter = (printer: NetworkPrinter) => {
    const updated: NetworkPrinter = {
      ...printer,
      status: 'ready',
      virtualDriverReady: true,
      lastConnected: Date.now(),
    };
    setActivePrinter(updated);
    saveNetworkPrinter(updated);
    if (onPrinterConnected) {
      onPrinterConnected(updated);
    }
  };

  // Test and connect manual IP
  const handleTestManualConnect = async () => {
    if (!manualIp.trim()) {
      setManualStatusMessage({ text: 'ပရင်တာ IP Address ထည့်သွင်းပေးပါ', type: 'error' });
      return;
    }

    setIsTestingManual(true);
    setManualStatusMessage({ text: `${manualIp}:${manualPort} သို့ ဆက်သွယ်စစ်ဆေးနေပါသည်...`, type: 'info' });

    try {
      const probe = await probePrinterIp(manualIp.trim(), manualPort, 2000);
      setIsTestingManual(false);

      if (probe.isReachable) {
        const newPrinter: NetworkPrinter = {
          id: `net_${manualIp.replace(/\./g, '_')}_${manualPort}`,
          name: `Wi-Fi ပရင်တာ (${manualIp})`,
          ip: manualIp.trim(),
          port: manualPort,
          protocol: 'RAW_9100',
          status: 'online',
          model: 'Manual IP Network Printer',
          virtualDriverReady: true,
          responseTimeMs: probe.latencyMs,
          lastConnected: Date.now(),
        };
        handleSelectPrinter(newPrinter);
        setManualStatusMessage({
          text: `ချိတ်ဆက်မှု အောင်မြင်ပါသည်! (Latency: ${probe.latencyMs}ms)`,
          type: 'success',
        });
      } else {
        setManualStatusMessage({
          text: `ပရင်တာ IP (${manualIp}) သို့ ဆက်သွယ်၍ မရပါ: ${probe.error || 'Timeout'}. Wi-Fi ချိတ်ဆက်မှု စစ်ဆေးပါ။`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setIsTestingManual(false);
      setManualStatusMessage({ text: `စစ်ဆေးရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}`, type: 'error' });
    }
  };

  // Test print using Virtual Driver
  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setStatusMessage({ text: 'Virtual Driver စတင်နေပါသည်... စမ်းသပ် Print ထုတ်ယူနေပါသည်...', type: 'info' });

    try {
      const testHtml = generateTestPrintHtml(activePrinter, shopProfile?.shopName);
      const res = await autoRunVirtualDriver(testHtml, {
        printer: activePrinter,
        title: 'Virtual Driver Test',
      });

      if (res.success) {
        setStatusMessage({ text: `အောင်မြင်ပါသည်! ${res.message}`, type: 'success' });
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (e: any) {
      setStatusMessage({ text: `Test Print Error: ${e.message}`, type: 'error' });
    } finally {
      setIsTestPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-sky-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/30">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Local Wi-Fi Network ပရင်တာ ချိတ်ဆက်မှု</span>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] rounded-full font-bold">
                  Virtual Driver v2.0
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ဖုန်းနှင့် တက်ဘလက်များမှ Wi-Fi ပရင်တာဖြင့် တိုက်ရိုက် Print ထုတ်နိုင်သည်
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* ACTIVE CONNECTED PRINTER STATUS CARD */}
          <div className="p-4 rounded-2xl border-2 border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{activePrinter.name}</span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded">
                    Connected (ချိတ်ဆက်ပြီး)
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5 text-[11px]">
                  <strong>IP / Address:</strong> {activePrinter.ip} {activePrinter.port ? `:${activePrinter.port}` : ''} •{' '}
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{activePrinter.model || activePrinter.protocol}</span>
                </p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Zap className="w-3 h-3" />
                  <span>Virtual Driver: အလိုအလျောက် အသင့်အလုပ်လုပ်နေပါသည်</span>
                </div>
              </div>
            </div>

            {/* Test Print Action */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleTestPrint}
                disabled={isTestPrinting}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isTestPrinting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                <span>{isTestPrinting ? 'စမ်းသပ်နေသည်...' : 'စမ်းသပ် Print ထုတ်ရန်'}</span>
              </button>
            </div>
          </div>

          {/* STATUS NOTIFICATION MESSAGE */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* AUTO SCAN LOCAL NETWORK SECTION */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                  <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Wi-Fi Network အတွင်း ပရင်တာ အလိုအလျောက် ရှာဖွေခြင်း (Auto-Detect)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ဖုန်း/တက်ဘလက်နှင့် ချိတ်ဆက်ထားသော တူညီသည့် Wi-Fi ကွန်ရက်အတွင်း ရှာဖွေပါသည်
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[11px] text-slate-400">Subnet:</span>
                  <input
                    type="text"
                    value={subnetBase}
                    onChange={(e) => setSubnetBase(e.target.value)}
                    className="w-24 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none bg-transparent"
                    placeholder="192.168.1"
                  />
                </div>

                <button
                  onClick={handleAutoScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'ရှာဖွေနေပါသည်...' : 'Auto Scan စတင်မည်'}</span>
                </button>
              </div>
            </div>

            {/* SCAN PROGRESS BAR */}
            {isScanning && scanProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Subnet {subnetBase}.x စစ်ဆေးနေပါသည်...</span>
                  <span className="font-mono font-bold">{Math.round((scanProgress.scanned / scanProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${(scanProgress.scanned / scanProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* DISCOVERED / KNOWN PRINTERS LIST */}
            <div className="space-y-1.5 mt-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">တွေ့ရှိထားသော ပရင်တာများ:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {knownPrinters.map((p) => {
                  const isSelected = activePrinter.id === p.id || (activePrinter.ip === p.ip && activePrinter.port === p.port);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPrinter(p)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-xs">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {p.ip} {p.port ? `:${p.port}` : ''}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="p-1 bg-indigo-600 text-white rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80">
                          ရွေးမည်
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MANUAL DIRECT IP CONFIGURATION */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <Server className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>ပရင်တာ IP Address ဖြင့် တိုက်ရိုက် ချိတ်ဆက်ခြင်း (Manual Connect)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ပရင်တာ၏ IP (ဥပမာ: 192.168.1.100) နှင့် RAW Port (9100) ကို ရိုက်ထည့်၍ ချိတ်ဆက်နိုင်ပါသည်
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[160px]">
                <input
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="Printer IP (e.g. 192.168.1.100)"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="w-24">
                <input
                  type="number"
                  value={manualPort}
                  onChange={(e) => setManualPort(parseInt(e.target.value) || 9100)}
                  placeholder="Port (9100)"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleTestManualConnect}
                disabled={isTestingManual}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isTestingManual ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{isTestingManual ? 'စစ်ဆေးနေ...' : 'စစ်ဆေး & ချိတ်ဆက်မည်'}</span>
              </button>
            </div>

            {manualStatusMessage && (
              <p
                className={`text-[11px] font-medium ${
                  manualStatusMessage.type === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : manualStatusMessage.type === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                {manualStatusMessage.text}
              </p>
            )}
          </div>

          {/* VIRTUAL DRIVER TIPS & INSTRUCTIONS */}
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              <span>ဖုန်း/တက်ဘလက်မှ Wi-Fi ပရင်တာဖြင့် Print ထုတ်နည်း အညွှန်း:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10.5px]">
              <li>သင့်ဖုန်း သို့မဟုတ် တက်ဘလက်ကို ပရင်တာချိတ်ထားသော Wi-Fi ကွန်ရက် (Same Wi-Fi) တွင် ချိတ်ဆက်ထားပါ။</li>
              <li>
                <strong>စာရွက် ပရင့်ထုတ်မည်</strong> ကို နှိပ်သည်နှင့် <strong>Virtual Driver</strong> မှ အလိုအလျောက် အလုပ်လုပ်ပေးပြီး Android / iOS System Print Box ပွင့်လာပါမည်။
              </li>
              <li>System Print Box တွင် Wi-Fi အတွင်းရှိ ပရင်တာများ (Epson, HP, Canon, Brother, POS) အလိုအလျောက် ပေါ်လာမည်ဖြစ်ပြီး ချက်ချင်း Print ထုတ်နိုင်ပါသည်။</li>
            </ul>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            လက်ရှိချိတ်ဆက်မှု: <span className="font-bold text-slate-800 dark:text-slate-200">{activePrinter.name}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
          >
            ပြီးပါပြီ (Done)
          </button>
        </div>
      </div>
    </div>
  );
};
