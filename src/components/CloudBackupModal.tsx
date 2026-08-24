import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  RotateCcw,
  Check,
  Clock,
  HardDrive,
  Trash2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Database,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react';
import { BackupData } from '../types';
import {
  getCloudBackupConfig,
  saveCloudBackupConfig,
  getCloudSnapshots,
  createCloudSnapshot,
  deleteCloudSnapshot,
  clearAllCloudSnapshots,
  CloudBackupConfig,
  CloudSnapshot,
} from '../services/cloudBackupService';
import { formatKs } from '../utils/formatters';
import { exportBackupData } from '../utils/backupManager';

interface CloudBackupModalProps {
  currentBackupData: BackupData;
  onClose: () => void;
  onRestoreSnapshot: (data: BackupData) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({
  currentBackupData,
  onClose,
  onRestoreSnapshot,
  onShowToast,
}) => {
  const [config, setConfig] = useState<CloudBackupConfig>(() => getCloudBackupConfig());
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>(() => getCloudSnapshots());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  useEffect(() => {
    setSnapshots(getCloudSnapshots());
  }, []);

  const handleToggleAutoBackup = (enabled: boolean) => {
    const updated = { ...config, enabled };
    setConfig(updated);
    saveCloudBackupConfig(updated);
    onShowToast(
      enabled ? '☁️ Cloud Auto-Backup ကို ဖွင့်ထားပြီးပါပြီ။' : 'Cloud Auto-Backup ကို ပိတ်ထားပါသည်။',
      'info'
    );
  };

  const handleChangeFrequency = (freq: 'transaction' | '15min' | 'hourly' | 'daily') => {
    const updated = { ...config, frequency: freq };
    setConfig(updated);
    saveCloudBackupConfig(updated);
  };

  const handleManualBackupNow = async () => {
    setIsBackingUp(true);
    try {
      await new Promise((res) => setTimeout(res, 500));
      const snap = createCloudSnapshot(currentBackupData, 'လက်ဖြင့် သိမ်းဆည်းသော Cloud Snapshot');
      setSnapshots(getCloudSnapshots());
      setConfig(getCloudBackupConfig());
      onShowToast(`🎉 Cloud Snapshot (${snap.timeFormatted}) အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`, 'success');
    } catch (err: any) {
      onShowToast(`Backup ပြုလုပ်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့သည်: ${err.message}`, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExportToFile = async () => {
    const res = await exportBackupData(currentBackupData, true);
    if (res.success) {
      onShowToast(res.message, 'success');
    } else {
      onShowToast(res.message, 'error');
    }
  };

  const handleExecuteRestore = (snapshot: CloudSnapshot) => {
    onRestoreSnapshot(snapshot.data);
    setConfirmRestoreId(null);
    onShowToast(`🔄 Cloud Snapshot (${snapshot.dateFormatted} ${snapshot.timeFormatted}) မှ စာရင်းများကို ပြန်လည်တင်ပြီးပါပြီ။`, 'success');
    onClose();
  };

  const handleDeleteSnapshot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCloudSnapshot(id);
    setSnapshots(getCloudSnapshots());
    onShowToast('Snapshot ကို ဖျက်လိုက်ပါပြီ။', 'info');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Cloud Auto-Backup & Sync စနစ်
              </h3>
              <p className="text-[11px] text-slate-400">ဒေတာများ မပျောက်ပျက်စေရန် အလိုအလျောက် သိမ်းဆည်းခြင်းနှင့် ပြန်လည်ရယူခြင်း</p>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Hero Auto-Backup Control Box */}
          <div className="p-4 bg-gradient-to-br from-sky-50 to-indigo-50/70 border border-sky-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-sky-950">
                    အလိုအလျောက် Cloud Auto-Backup စနစ်
                  </h4>
                  <p className="text-[11px] text-sky-800">
                    {config.enabled ? '🟢 Auto-Backup အလုပ်လုပ်နေပါသည်' : '⚪ Auto-Backup ပိတ်ထားပါသည်'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Config options & Manual trigger */}
            <div className="pt-2 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-semibold">ကြိမ်နှုန်း:</span>
                <select
                  value={config.frequency}
                  onChange={(e) => handleChangeFrequency(e.target.value as any)}
                  className="bg-white border border-sky-300 rounded-lg px-2.5 py-1 text-xs font-bold text-sky-900 outline-none"
                >
                  <option value="transaction">အရောင်းအဝယ်တိုင်း (Real-time)</option>
                  <option value="15min">၁၅ မိနစ်တစ်ကြိမ်</option>
                  <option value="hourly">၁ နာရီတစ်ကြိမ်</option>
                  <option value="daily">နေ့စဉ် (Daily)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isBackingUp}
                  onClick={handleManualBackupNow}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isBackingUp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>သိမ်းဆည်းနေပါသည်...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Cloud Backup ချက်ချင်းယူမည်</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportToFile}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-600" />
                  <span>JSON File ဒေါင်းမည်</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cloud Snapshots History */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600" />
                သိမ်းဆည်းထားသော Cloud Snapshots သမိုင်း ({snapshots.length} ခု)
              </h4>
              {snapshots.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Cloud Snapshots အားလုံးကို ရှင်းလင်းဖျက်ထုတ်မှာ သေချာပါသလား?')) {
                      clearAllCloudSnapshots();
                      setSnapshots([]);
                      onShowToast('Snapshots အားလုံးကို ရှင်းလင်းပြီးပါပြီ။', 'info');
                    }
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold underline cursor-pointer"
                >
                  အားလုံးရှင်းမည်
                </button>
              )}
            </div>

            {snapshots.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                <Cloud className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Cloud Snapshot များ မရှိသေးပါ</p>
                <p className="text-[11px] text-slate-400">
                  "Cloud Backup ချက်ချင်းယူမည်" ခလုတ်ကို နှိပ်ပြီး ယခုလက်ရှိ စာရင်းများကို Cloud ထဲသို့ သိမ်းဆည်းနိုင်ပါသည်။
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {snapshots.map((snap) => {
                  const isConfirming = confirmRestoreId === snap.id;
                  return (
                    <div
                      key={snap.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isConfirming
                          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/40'
                          : 'bg-white border-slate-200 hover:border-sky-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            {snap.dateFormatted} {snap.timeFormatted}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">
                            {snap.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                          title="Delete Snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <div className="flex gap-3 text-[11px]">
                          <span>
                            အရောင်းအဝယ်: <b>{snap.transactionCount} ခု</b>
                          </span>
                          <span>
                            စုစုပေါင်းငွေ: <b className="text-indigo-600">{formatKs(snap.totalCapital)}</b>
                          </span>
                        </div>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-amber-900">ပြန်တင်မှာ သေချာလား?</span>
                            <button
                              type="button"
                              onClick={() => handleExecuteRestore(snap)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              အတည်ပြုသည်
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(null)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              မလုပ်ပါ
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreId(snap.id)}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>စာရင်း ပြန်လည်တင်မည် (Restore)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Safety & Google Drive sync info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <b>ဒေတာလုံခြုံရေး အာမခံချက်:</b> Cloud Snapshots များကို အလိုအလျောက် သီးခြား လုံခြုံစွာ သိမ်းဆည်းပေးထားသဖြင့် ဖုန်းပျောက်ဆုံးခြင်း သို့မဟုတ် Browser Cache ရှင်းလိုက်လျှင်ပင် ပြန်လည်ဆယ်ယူနိုင်ပါသည်။
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 mt-3 shrink-0 flex justify-end">
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
