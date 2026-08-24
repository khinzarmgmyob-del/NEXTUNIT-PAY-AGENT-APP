import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Phone,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { getAppLicenseStatus, activateLicense, generateActivationKey, LicenseStatus } from '../utils/license';

interface LicenseDashboardModalProps {
  onClose: () => void;
  onActivated: () => void;
}

export const LicenseDashboardModal: React.FC<LicenseDashboardModalProps> = ({
  onClose,
  onActivated,
}) => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() => getAppLicenseStatus());
  const [inputKey, setInputKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showKeyHint, setShowKeyHint] = useState(false);

  useEffect(() => {
    const update = () => {
      setLicenseStatus(getAppLicenseStatus());
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(licenseStatus.deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!inputKey.trim()) {
      setErrorMsg('ကျေးဇူးပြု၍ Activation Key ကို ထည့်သွင်းပေးပါ။');
      return;
    }

    const success = activateLicense(inputKey);
    if (success) {
      setSuccessMsg('🎉 အမြဲတမ်း လိုင်စင် (Lifetime License) အောင်မြင်စွာ ရရှိပြီးပါပြီ!');
      setLicenseStatus(getAppLicenseStatus());
      onActivated();
    } else {
      setErrorMsg('Activation Key မမှန်ကန်ပါ။ ကျေးဇူးပြု၍ စစ်ဆေးပြီး ပြန်လည်ရိုက်ထည့်ပါ။');
    }
  };

  const validMasterKey = generateActivationKey(licenseStatus.deviceId);

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
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                licenseStatus.isPermanent
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                လိုင်စင်နှင့် အစမ်းသုံးစွဲမှု အခြေအနေ (License Dashboard)
              </h3>
              <p className="text-[11px] text-slate-400">စနစ်လိုင်စင် အချက်အလက်နှင့် Activation</p>
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Status Hero Card */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${
              licenseStatus.isPermanent
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                {licenseStatus.isPermanent ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    အမြဲတမ်း လိုင်စင် (Lifetime Activated)
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                    အစမ်း ၃ ရက် သုံးစွဲခွင့် (3-Day Free Trial)
                  </>
                )}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black ${
                  licenseStatus.isPermanent
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {licenseStatus.isPermanent ? 'ACTIVE' : 'TRIAL ACTIVE'}
              </span>
            </div>

            {licenseStatus.isPermanent ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-900">
                  သင့် App သည် Full License အပြည့်အဝ ရရှိထားပါသည်။
                </p>
                <p className="text-xs text-emerald-700">
                  Feature အားလုံးကို အကန့်အသတ်မရှိ အမြဲတမ်း စိတ်ချလက်ချ အသုံးပြုနိုင်ပါသည်။
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-600">ကျန်ရှိသည့် အစမ်းကာလ:</span>
                  <span className="text-base sm:text-lg font-black text-amber-700 font-mono">
                    {licenseStatus.formattedRemaining}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-amber-200/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(5, Math.min(100, (licenseStatus.remainingMs / (3 * 24 * 60 * 60 * 1000)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  အစမ်းသုံးစွဲသည့် ၃ ရက်အတွင်း ငွေသွင်း/ငွေထုတ်၊ ကော်မရှင်တွက်ချက်မှု၊ Bluetooth Print နှင့် Cloud Backup အားလုံးကို အခမဲ့ အပြည့်အစုံ စမ်းသပ်နိုင်ပါသည်။
                </p>
              </div>
            )}
          </div>

          {/* Device ID Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              သင့်ဖုန်း၏ Device ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={licenseStatus.deviceId}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 font-mono font-bold text-slate-800 text-sm outline-none"
              />
              <button
                type="button"
                onClick={handleCopyDeviceId}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'ကူးပြီး!' : 'Copy ID'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              အမြဲတမ်း Activation Key ရယူရန် အထက်ပါ Device ID ကို Developer ထံ ပို့ပေးပါ။
            </p>
          </div>

          {/* Activation Key Input Form */}
          {!licenseStatus.isPermanent && (
            <form onSubmit={handleActivateSubmit} className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-indigo-950 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Lifetime Activation Key ထည့်သွင်းရန်:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={inputKey}
                    onChange={(e) => {
                      setInputKey(e.target.value);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="flex-1 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 uppercase tracking-widest outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
                  >
                    လိုင်စင်ဖွင့်မည်
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-semibold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Developer Test Mode Hint */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowKeyHint(!showKeyHint)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium underline flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  စမ်းသပ်ရန် Activation Key အလိုအလျောက် ထည့်မည်
                </button>
                {showKeyHint && (
                  <div className="mt-2 p-2.5 bg-white border border-indigo-200 rounded-xl flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600">Valid Key: <b className="text-indigo-700">{validMasterKey}</b></span>
                    <button
                      type="button"
                      onClick={() => setInputKey(validMasterKey)}
                      className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-md text-[11px] font-bold cursor-pointer"
                    >
                      Fill Key
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Contact Support Footer */}
          <div className="p-3.5 bg-slate-800 text-slate-200 rounded-2xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400">NextUnit Tech Developer Support</span>
              <span className="text-[10px] text-slate-400">Version 1.1.0</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-slate-300">
              <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Contact / Viber: <b>09254351071</b></span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              လိုင်စင်ဝယ်ယူလိုပါက သို့မဟုတ် အကူအညီလိုအပ်ပါက ဖုန်း/Viber မှတစ်ဆင့် အချိန်မရွေး ဆက်သွယ်နိုင်ပါသည်။
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div className="pt-3 border-t border-slate-100 mt-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
