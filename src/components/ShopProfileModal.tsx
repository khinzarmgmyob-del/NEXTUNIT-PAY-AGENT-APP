import React, { useState, useRef, useEffect } from 'react';
import { X, Store, Image, Trash2, Phone, MapPin, Check, Upload } from 'lucide-react';
import { ShopProfile } from '../types';

interface ShopProfileModalProps {
  initialProfile: ShopProfile;
  onSave: (profile: ShopProfile) => void;
  onClose: () => void;
}

export const ShopProfileModal: React.FC<ShopProfileModalProps> = ({
  initialProfile,
  onSave,
  onClose,
}) => {
  const [shopName, setShopName] = useState(initialProfile.shopName || '');
  const [phone, setPhone] = useState(initialProfile.phone || '');
  const [address, setAddress] = useState(initialProfile.address || '');
  const [logoUrl, setLogoUrl] = useState<string | undefined>(initialProfile.logoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      shopName: shopName.trim() || 'Money Agent POS',
      phone: phone.trim(),
      address: address.trim(),
      logoUrl,
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 md:p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 z-10 my-auto max-h-[94vh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">ဆိုင် / လုပ်ငန်း Profile အချက်အလက်</h3>
              <p className="text-xs text-slate-400">ဘောက်ချာ Header တွင် ဖော်ပြမည့် အချက်အလက်များ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 -mr-1">
          {/* Logo Upload Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              လုပ်ငန်း Logo (Logo Image Upload)
            </label>
            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {logoUrl ? (
                <div className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center shadow-xs">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(undefined)}
                    className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    title="Logo ဖျက်မည်"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 shrink-0">
                  <Image className="w-6 h-6" />
                  <span className="text-[9px] mt-0.5 font-semibold">No Logo</span>
                </div>
              )}

              <div className="flex-1 space-y-1.5">
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
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {logoUrl ? 'Logo ပြောင်းမည်' : 'Logo တင်မည် (Upload)'}
                </button>
                <p className="text-[10px] text-slate-400">PNG, JPG, SVG (Max: 2MB)</p>
              </div>
            </div>
          </div>

          {/* Shop Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              လုပ်ငန်း / ဆိုင်အမည် <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="ဥပမာ - ရွှေမင်းသား ငွေလွှဲဝန်ဆောင်မှု"
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ဆက်သွယ်ရန် ဖုန်းနံပါတ်
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ဥပမာ - 09-123456789, 09-987654321"
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ဆိုင် / လုပ်ငန်း လိပ်စာ
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ဥပမာ - အမှတ် (၁၂)၊ ဗိုလ်ချုပ်လမ်း၊ ရန်ကုန်မြို့"
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none resize-none"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              သိမ်းဆည်းမည်
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
