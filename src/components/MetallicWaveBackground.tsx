import React from 'react';

/**
 * Metallic Wave Background Component
 * Renders a soft light-green metallic wave / kanote-inspired curved gradient backdrop
 * across the top half of the screen, dynamically adapted for both Light and Dark themes.
 */
export const MetallicWaveBackground: React.FC = () => {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-[48vh] min-h-[340px] max-h-[560px] pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Subtle Metallic Ambient Radial & Linear Green Sheen */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-teal-400/5 to-transparent dark:from-emerald-600/15 dark:via-teal-500/8 dark:to-transparent" />
      
      {/* Radial soft metallic highlights */}
      <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-emerald-400/15 dark:bg-emerald-500/10 blur-3xl" />
      <div className="absolute -top-32 right-1/6 w-80 h-80 rounded-full bg-teal-300/15 dark:bg-teal-400/10 blur-3xl" />

      {/* 2. Fluid Kanote & Metallic Wave Curves Vector */}
      <svg
        className="absolute top-0 left-0 w-full h-full object-cover opacity-70 dark:opacity-45"
        viewBox="0 0 1440 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Main Metallic Mint Gradient */}
          <linearGradient id="metallic-mint-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="30%" stopColor="#6ee7b7" stopOpacity="0.38" />
            <stop offset="60%" stopColor="#14b8a6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.08" />
          </linearGradient>

          {/* Deep Metallic Emerald Shade Gradient */}
          <linearGradient id="metallic-emerald-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#059669" stopOpacity="0.22" />
            <stop offset="85%" stopColor="#0f766e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.04" />
          </linearGradient>

          {/* Third Flow Ribbon Gradient */}
          <linearGradient id="metallic-ribbon-3" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.05" />
          </linearGradient>

          {/* Metallic Sheen Line Highlight */}
          <linearGradient id="metallic-sheen-line" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.4" />
            <stop offset="30%" stopColor="#34d399" stopOpacity="0.8" />
            <stop offset="65%" stopColor="#6ee7b7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.3" />
          </linearGradient>

          {/* Soft Filter for Metallic Luster */}
          <filter id="wave-soft-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Primary Soft Deep Wave (Back Layer) */}
        <path
          d="M0,0 L1440,0 L1440,210 C1220,130 1020,290 760,200 C500,110 260,280 0,170 Z"
          fill="url(#metallic-mint-1)"
        />

        {/* Overlapping Kanote Crest Wave (Mid Layer) */}
        <path
          d="M0,0 L1440,0 L1440,280 C1180,360 940,180 680,260 C420,340 180,190 0,310 Z"
          fill="url(#metallic-emerald-2)"
        />

        {/* Delicate Swirling Metallic Accent Wave (Front Layer) */}
        <path
          d="M0,80 C240,230 480,120 720,220 C960,320 1200,170 1440,260 L1440,0 L0,0 Z"
          fill="url(#metallic-ribbon-3)"
        />

        {/* Sharp Metallic Edge Stroke 1 */}
        <path
          d="M0,170 C260,280 500,110 760,200 C1020,290 1220,130 1440,210"
          stroke="url(#metallic-sheen-line)"
          strokeWidth="2"
          fill="none"
          filter="url(#wave-soft-glow)"
        />

        {/* Sharp Metallic Edge Stroke 2 */}
        <path
          d="M0,310 C180,190 420,340 680,260 C940,180 1180,360 1440,280"
          stroke="url(#metallic-sheen-line)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Subtle Decorative Flow Dashed Ribbon */}
        <path
          d="M0,230 C300,140 580,310 860,210 C1140,110 1320,250 1440,180"
          stroke="url(#metallic-sheen-line)"
          strokeWidth="1.2"
          strokeDasharray="8 6"
          fill="none"
          opacity="0.75"
        />
      </svg>

      {/* 3. Smooth Bottom Gradient Mask - Blends naturally into main content */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-100 dark:to-slate-950" />
    </div>
  );
};
