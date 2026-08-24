import React, { useState, useEffect } from 'react';
import {
  X,
  Wifi,
  Server,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  Radio,
  Shield,
  HelpCircle,
  Laptop,
} from 'lucide-react';
import { NetworkConfig, NetworkMode } from '../types';
import {
  getNetworkConfig,
  saveNetworkConfig,
  testServerConnection,
  fetchServerNetworkInfo,
  formatServerUrl,
} from '../services/dataService';

interface NetworkSettingsModalProps {
  onClose: () => void;
  onConfigChanged: (config: NetworkConfig) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const NetworkSettingsModal: React.FC<NetworkSettingsModalProps> = ({
  onClose,
  onConfigChanged,
  onShowToast,
}) => {
  const [config, setConfig] = useState<NetworkConfig>(() => getNetworkConfig());
  const [mode, setMode] = useState<NetworkMode>(config.mode);
  const [masterIp, setMasterIp] = useState<string>(config.masterServerIp);
  const [deviceLabel, setDeviceLabel] = useState<string>(config.deviceLabel || '');
  
  // Local Server detected info
  const [serverInfo, setServerInfo] = useState<{
    ipList: string[];
    activeUrl: string;
    port: number;
    hostname?: string;
  } | null>(null);

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch local server IPs on mount
  useEffect(() => {
    fetchServerNetworkInfo().then((info) => {
      if (info) {
        setServerInfo(info);
      }
    });
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testServerConnection(masterIp);
      setTestResult(res);
      if (res.success) {
        onShowToast?.(res.message, 'success');
      } else {
        onShowToast?.(res.message, 'error');
      }
    } catch (e: any) {
      const msg = e.message || 'ချိတ်ဆက်မှု မအောင်မြင်ပါ';
      setTestResult({
        success: false,
        message: msg,
      });
      onShowToast?.(msg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const formattedUrl = formatServerUrl(masterIp);
    const updated: NetworkConfig = {
      ...config,
      mode,
      masterServerIp: formattedUrl,
      deviceLabel: deviceLabel.trim() || (mode === 'server' ? 'Master Device' : 'Client Terminal'),
    };
    saveNetworkConfig(updated);
    onConfigChanged(updated);
    onClose();
  };

  // Primary server address for display
  const primaryDisplayUrl = serverInfo?.activeUrl || (serverInfo?.primaryIp ? `http://${serverInfo.primaryIp}:3000` : 'http://192.168.1.8:3000');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                Wi-Fi Network Mode (Master / Client)
              </h3>
              <p className="text-xs text-slate-400">
                တူညီသော Wi-Fi ကွန်ရက်တွင် စက်များစွာ ချိတ်ဆက်အသုံးပြုခြင်း
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Mode Switcher Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              အသုံးပြုမည့် ကွန်ရက်မုဒ် ရွေးချယ်ပါ (Select Network Mode)
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setMode('server')}
                className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'server'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-md border border-slate-200/60 dark:border-slate-600'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Server className="w-4 h-4" />
                  <span className="text-sm">Server Mode</span>
                </div>
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-400 text-center">
                  ပင်မ Master စက် (Local DB &amp; Server)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('client')}
                className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'client'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-md border border-slate-200/60 dark:border-slate-600'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">Client Mode</span>
                </div>
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-400 text-center">
                  စက်ခွဲ / အရောင်းကောင်တာ Terminal
                </span>
              </button>
            </div>
          </div>

          {/* ================= SERVER MODE PANEL ================= */}
          {mode === 'server' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Master Server အသက်ဝင်နေပါသည် (0.0.0.0:3000)
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    📡 Wi-Fi Ready
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>ဒီစက်၏ Wi-Fi Local IP (Client စက်များထံ ထည့်ရန်):</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Port 3000</span>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-indigo-200 dark:border-slate-700 shadow-xs">
                    <input
                      type="text"
                      readOnly
                      value={primaryDisplayUrl}
                      className="flex-1 bg-transparent text-indigo-700 dark:text-indigo-300 font-mono text-xs sm:text-sm font-bold outline-hidden px-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryDisplayUrl)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                      {copiedUrl === primaryDisplayUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy IP</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Available Network Interfaces chips */}
                {serverInfo && serverInfo.ipList.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/30">
                    <span className="font-semibold block mb-1">ရရှိနိုင်သော ကွန်ရက်လိပ်စာများ: </span>
                    <div className="flex flex-wrap gap-1.5">
                      {serverInfo.ipList.map((ip) => {
                        const url = `http://${ip}:${serverInfo.port || 3000}`;
                        const isPrimary = url === primaryDisplayUrl;
                        return (
                          <button
                            type="button"
                            key={ip}
                            onClick={() => handleCopy(url)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[10px] cursor-pointer transition-colors ${
                              isPrimary
                                ? 'bg-indigo-100 dark:bg-indigo-900/70 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 font-bold'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-600 dark:text-slate-300'
                            }`}
                            title="Click to copy this IP"
                          >
                            <Wifi className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{url}</span>
                            {copiedUrl === url ? (
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-60" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Server Features / Guidance */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Master Server ညွှန်ကြားချက်များ</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <li>Express Server သည် host <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded text-slate-800 dark:text-slate-200">0.0.0.0:3000</code> တွင် အလုပ်လုပ်နေပြီး တူညီသော Wi-Fi ကွန်ရက်ရှိ စက်အားလုံး ချိတ်ဆက်နိုင်ပါသည်။</li>
                  <li>အခြား ဝန်ထမ်းဖုန်း/တက်ဘလက်များမှ <strong>Client Mode</strong> တွင် အထက်ပါ IP Address (ဥပမာ: <code className="font-mono bg-indigo-50 dark:bg-indigo-950 px-1 rounded text-indigo-600 dark:text-indigo-300">{primaryDisplayUrl}</code>) ကို ထည့်သွင်းချိတ်ဆက်ရုံဖြင့် စာရင်းများ တပြိုင်တည်း ရေး/ဖတ် နိုင်ပါမည်။</li>
                </ul>
              </div>
            </div>
          )}

          {/* ================= CLIENT MODE PANEL ================= */}
          {mode === 'client' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="p-4 bg-sky-50/70 dark:bg-sky-950/40 rounded-2xl border border-sky-100 dark:border-sky-900/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                    Master Server သို့ ချိတ်ဆက်မည့် IP လိပ်စာ ထည့်ပါ
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Master Server URL / IP Address:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={masterIp}
                      onChange={(e) => setMasterIp(e.target.value)}
                      placeholder="http://192.168.1.100:3000"
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 dark:text-white outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !masterIp.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    * ပင်မ Server စက်တွင် ပြသထားသော IP Address ကို အတိအကျ ထည့်သွင်းပါ (ဥပမာ: http://192.168.1.100:3000)
                  </p>
                </div>

                {/* Connection Test Result Box */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 font-medium">
                      <div>{testResult.message}</div>
                      {testResult.latencyMs !== undefined && (
                        <div className="text-[10px] opacity-80 mt-0.5 font-mono">
                          Response Time: {testResult.latencyMs}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Device Label input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  စက်အမည် / ကောင်တာ အမှတ်အသား (Device Label)
                </label>
                <input
                  type="text"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder="e.g. Counter 2 / အရောင်းဝန်ထမ်း မသီတာ"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            မလုပ်တော့ပါ (Cancel)
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>သိမ်းဆည်းမည် (Save &amp; Apply)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
