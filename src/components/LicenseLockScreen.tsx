import React, { useState, useRef } from 'react';
import { KeyRound, Copy, Check, ShieldCheck, HelpCircle, Terminal, Store, Phone, MapPin, Upload, Image, Trash2 } from 'lucide-react';
import { generateActivationKey, verifyActivationKey } from '../utils/license';
import { ShopProfile } from '../types';

interface LicenseLockScreenProps {
  deviceId: string;
  onActivated: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({ deviceId, onActivated }) => {
  const [inputKey, setInputKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdminKeyHint, setShowAdminKeyHint] = useState(false);

  // Shop profile state for initial registration
  const [shopName, setShopName] = useState(() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved).shopName || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  const [phone, setPhone] = useState(() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved).phone || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  const [address, setAddress] = useState(() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved).address || '';
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  const [logoUrl, setLogoUrl] = useState<string | undefined>(() => {
    const saved = localStorage.getItem('app_shop_profile');
    if (saved) {
      try {
        return JSON.parse(saved).logoUrl || undefined;
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const calculatedKey = generateActivationKey(deviceId);

  const handleCopy = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo ပုံအရွယ်အစား 2MB ထက် မကျော်ရပါ။');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleActivate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyActivationKey(deviceId, inputKey)) {
      localStorage.setItem('app_activation_key', inputKey.trim().toUpperCase());

      // Save Shop Profile
      const profile: ShopProfile = {
        shopName: shopName.trim() || 'Money Agent POS',
        phone: phone.trim(),
        address: address.trim(),
        logoUrl: logoUrl,
      };
      localStorage.setItem('app_shop_profile', JSON.stringify(profile));

      setErrorMsg('');
      onActivated();
    } else {
      setErrorMsg('Activation Key မမှန်ကန်ပါ။ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပါ။');
    }
  };

  const handleAutoFillValidKey = () => {
    setInputKey(calculatedKey);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto relative">
      {/* Top Corner Developer & System Info */}
      <div className="w-full max-w-lg sm:max-w-none sm:w-auto flex justify-end mb-3 sm:mb-0 sm:absolute sm:top-6 sm:right-6 z-10">
        <div className="bg-slate-800/90 border border-slate-700/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-xl text-right space-y-0.5">
          <div className="text-indigo-400 font-bold text-xs sm:text-sm tracking-wide">NextUnit Tech</div>
          <div className="text-slate-200 font-semibold font-mono text-[11px] sm:text-xs">Contact : 09254351071</div>
          <div className="text-slate-400 text-[10px] sm:text-[11px] font-medium">Money Agent POS System (v.1.1.0)</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 my-auto">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          <KeyRound className="w-7 h-7" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-1">
          License Activation & Profile Setup
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 text-center mb-6 leading-relaxed">
          Money Agent POS ကို စတင်အသုံးပြုရန် Activation Key ထည့်သွင်းပြီး သင့်လုပ်ငန်း Profile ကို ဖြည့်စွက်ပါ
        </p>

        <form onSubmit={handleActivate} className="space-y-4">
          {/* Section 1: License Activation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ၁။ အသုံးပြုသူ၏ Device ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deviceId}
                  readOnly
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
                  title="Device ID ကို ကူးယူမည်"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy ID
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ၂။ Activation Key ရိုက်ထည့်ပါ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="XXXX-XXXX"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 font-mono text-center text-base sm:text-lg font-bold text-slate-800 uppercase tracking-widest placeholder:text-slate-300 transition-all outline-none"
              />
            </div>
          </div>

          {/* Section 2: Shop Profile Configuration */}
          <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
              <Store className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                ၃။ ဆိုင် / လုပ်ငန်း Profile အချက်အလက် (ဘောက်ချာ Header တွင် ဖော်ပြရန်)
              </span>
            </div>

            {/* Logo upload */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                လုပ်ငန်း Logo (Logo Image)
              </label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl(undefined)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <Image className="w-4 h-4" />
                    <span className="text-[8px]">No Logo</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoUrl ? 'Logo ပြောင်းမည်' : 'Logo ပုံတင်မည်'}
                  </button>
                </div>
              </div>
            </div>

            {/* Shop Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                လုပ်ငန်း / ဆိုင်အမည်
              </label>
              <div className="relative">
                <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ဥပမာ - ရွှေမင်းသား ငွေလွှဲ ငွေထုတ်"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Phone & Address in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ဖုန်းနံပါတ်
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="09-123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ဆိုင်လိပ်စာ
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ရန်ကုန်မြို့"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            App ကို စတင်အသုံးပြုမည် (Activate & Start)
          </button>
        </form>

        {/* Developer / Admin Helper Tooltip for Testing */}
        <div className="mt-5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdminKeyHint(!showAdminKeyHint)}
            className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 py-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Admin / Testing Helper Key Generator
          </button>

          {showAdminKeyHint && (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>စနစ်မှ ထုတ်ပေးသော Key:</span>
                <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200">{calculatedKey}</span>
              </div>
              <button
                type="button"
                onClick={handleAutoFillValidKey}
                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                ဤ Key ဖြင့် ချက်ချင်းဖြည့်စွက်ပြီး အသုံးပြုမည်
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
