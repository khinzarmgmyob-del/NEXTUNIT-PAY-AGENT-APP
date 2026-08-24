export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
  bgDark: string;
  borderDark: string;
  textDark: string;
  badgeBg: string;
  badgeText: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'emerald',
    name: 'စိမ်းလဲ့ရောင် (Emerald)',
    hex: '#059669',
    bgLight: 'bg-emerald-50/60 hover:bg-emerald-50',
    borderLight: 'border-emerald-200/80 hover:border-emerald-300',
    textLight: 'text-emerald-700',
    bgDark: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60',
    borderDark: 'dark:border-emerald-800/60 dark:hover:border-emerald-700',
    textDark: 'dark:text-emerald-300',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'indigo',
    name: 'အပြာရင့် (Indigo)',
    hex: '#4f46e5',
    bgLight: 'bg-indigo-50/60 hover:bg-indigo-50',
    borderLight: 'border-indigo-200/80 hover:border-indigo-300',
    textLight: 'text-indigo-700',
    bgDark: 'dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60',
    borderDark: 'dark:border-indigo-800/60 dark:hover:border-indigo-700',
    textDark: 'dark:text-indigo-300',
    badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'sky',
    name: 'မိုးပြာရောင် (Sky Blue)',
    hex: '#0284c7',
    bgLight: 'bg-sky-50/60 hover:bg-sky-50',
    borderLight: 'border-sky-200/80 hover:border-sky-300',
    textLight: 'text-sky-700',
    bgDark: 'dark:bg-sky-950/40 dark:hover:bg-sky-950/60',
    borderDark: 'dark:border-sky-800/60 dark:hover:border-sky-700',
    textDark: 'dark:text-sky-300',
    badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  {
    id: 'amber',
    name: 'ရွှေဝါရောင် (Amber/Yellow)',
    hex: '#d97706',
    bgLight: 'bg-amber-50/60 hover:bg-amber-50',
    borderLight: 'border-amber-200/80 hover:border-amber-300',
    textLight: 'text-amber-700',
    bgDark: 'dark:bg-amber-950/40 dark:hover:bg-amber-950/60',
    borderDark: 'dark:border-amber-800/60 dark:hover:border-amber-700',
    textDark: 'dark:text-amber-300',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'rose',
    name: 'နှင်းဆီနီ (Rose/Red)',
    hex: '#e11d48',
    bgLight: 'bg-rose-50/60 hover:bg-rose-50',
    borderLight: 'border-rose-200/80 hover:border-rose-300',
    textLight: 'text-rose-700',
    bgDark: 'dark:bg-rose-950/40 dark:hover:bg-rose-950/60',
    borderDark: 'dark:border-rose-800/60 dark:hover:border-rose-700',
    textDark: 'dark:text-rose-300',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
  {
    id: 'purple',
    name: 'ခရမ်းရောင် (Purple)',
    hex: '#7c3aed',
    bgLight: 'bg-purple-50/60 hover:bg-purple-50',
    borderLight: 'border-purple-200/80 hover:border-purple-300',
    textLight: 'text-purple-700',
    bgDark: 'dark:bg-purple-950/40 dark:hover:bg-purple-950/60',
    borderDark: 'dark:border-purple-800/60 dark:hover:border-purple-700',
    textDark: 'dark:text-purple-300',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'teal',
    name: 'စိမ်းပြာရောင် (Teal)',
    hex: '#0d9488',
    bgLight: 'bg-teal-50/60 hover:bg-teal-50',
    borderLight: 'border-teal-200/80 hover:border-teal-300',
    textLight: 'text-teal-700',
    bgDark: 'dark:bg-teal-950/40 dark:hover:bg-teal-950/60',
    borderDark: 'dark:border-teal-800/60 dark:hover:border-teal-700',
    textDark: 'dark:text-teal-300',
    badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
    badgeText: 'text-teal-700 dark:text-teal-300',
  },
  {
    id: 'orange',
    name: 'လိမ္မော်ရောင် (Orange)',
    hex: '#ea580c',
    bgLight: 'bg-orange-50/60 hover:bg-orange-50',
    borderLight: 'border-orange-200/80 hover:border-orange-300',
    textLight: 'text-orange-700',
    bgDark: 'dark:bg-orange-950/40 dark:hover:bg-orange-950/60',
    borderDark: 'dark:border-orange-800/60 dark:hover:border-orange-700',
    textDark: 'dark:text-orange-300',
    badgeBg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
    badgeText: 'text-orange-700 dark:text-orange-300',
  },
  {
    id: 'cyan',
    name: 'ပင်လယ်ပြာ (Cyan)',
    hex: '#0891b2',
    bgLight: 'bg-cyan-50/60 hover:bg-cyan-50',
    borderLight: 'border-cyan-200/80 hover:border-cyan-300',
    textLight: 'text-cyan-700',
    bgDark: 'dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60',
    borderDark: 'dark:border-cyan-800/60 dark:hover:border-cyan-700',
    textDark: 'dark:text-cyan-300',
    badgeBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'pink',
    name: 'ပန်းရောင် (Pink)',
    hex: '#db2777',
    bgLight: 'bg-pink-50/60 hover:bg-pink-50',
    borderLight: 'border-pink-200/80 hover:border-pink-300',
    textLight: 'text-pink-700',
    bgDark: 'dark:bg-pink-950/40 dark:hover:bg-pink-950/60',
    borderDark: 'dark:border-pink-800/60 dark:hover:border-pink-700',
    textDark: 'dark:text-pink-300',
    badgeBg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-200',
    badgeText: 'text-pink-700 dark:text-pink-300',
  },
  {
    id: 'slate',
    name: 'မီးခိုးနက် (Slate)',
    hex: '#475569',
    bgLight: 'bg-slate-100/70 hover:bg-slate-100',
    borderLight: 'border-slate-300/80 hover:border-slate-400',
    textLight: 'text-slate-800',
    bgDark: 'dark:bg-slate-800/60 dark:hover:bg-slate-800/80',
    borderDark: 'dark:border-slate-700 dark:hover:border-slate-600',
    textDark: 'dark:text-slate-200',
    badgeBg: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    badgeText: 'text-slate-700 dark:text-slate-300',
  },
];

export const getPresetByColor = (color?: string, defaultId: string = 'emerald'): ColorPreset => {
  if (!color) {
    return COLOR_PRESETS.find((p) => p.id === defaultId) || COLOR_PRESETS[0];
  }
  const match = COLOR_PRESETS.find((p) => p.id === color || p.hex.toLowerCase() === color.toLowerCase());
  if (match) return match;
  return COLOR_PRESETS.find((p) => p.id === defaultId) || COLOR_PRESETS[0];
};

export const getAccountColorStyle = (color?: string, defaultId: string = 'emerald') => {
  const preset = getPresetByColor(color, defaultId);
  return {
    className: `${preset.bgLight} ${preset.bgDark} ${preset.borderLight} ${preset.borderDark}`,
    textClass: `${preset.textLight} ${preset.textDark}`,
    badgeClass: preset.badgeBg,
    preset,
  };
};
