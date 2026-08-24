import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hash,
} from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');

  if (totalCount === 0) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers with dynamic ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 1; // number of pages around current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > delta + 2) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - (delta + 1)) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xs text-xs">
      {/* Left: Record Range & Total Count info */}
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <span className="font-bold text-slate-800 dark:text-slate-100">
          စာရင်း <span className="text-indigo-600 dark:text-indigo-400 font-black">{startRecord} - {endRecord}</span> / စုစုပေါင်း ({totalCount.toLocaleString()}) ခု
        </span>
        <span className="text-slate-400 hidden sm:inline">•</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
          စာမျက်နှာ <b>{currentPage}</b> / {totalPages}
        </span>
      </div>

      {/* Right: Page Navigation & Jump Controls */}
      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
        {/* Page Size Selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-600 mr-1">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">တစ်ခါပြ:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="bg-transparent font-bold text-indigo-700 dark:text-indigo-300 outline-none cursor-pointer text-xs"
            >
              <option value={30} className="dark:bg-slate-800">၃၀ စီ (Default)</option>
              <option value={50} className="dark:bg-slate-800">၅၀ စီ</option>
              <option value={100} className="dark:bg-slate-800">၁၀၀ စီ</option>
            </select>
          </div>
        )}

        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1 || isLoading}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          title="ပထမဆုံး စာမျက်နှာသို့ (First Page)"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-0.5"
          title="ရှေ့စာမျက်နှာ (Previous Page)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">ရှေ့သို့</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((num, idx) => {
            if (num === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                  ...
                </span>
              );
            }
            const pageNum = num as number;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={`page-${pageNum}`}
                onClick={() => onPageChange(pageNum)}
                disabled={isLoading}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-0.5"
          title="နောက်စာမျက်နှာ (Next Page)"
        >
          <span className="hidden sm:inline text-xs">နောက်သို့</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages || isLoading}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          title="နောက်ဆုံး စာမျက်နှာသို့ (Last Page)"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        {/* Quick Jump Input */}
        {totalPages > 3 && (
          <form onSubmit={handleJumpSubmit} className="hidden md:flex items-center gap-1 ml-2">
            <div className="flex items-center bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-0.5">
              <Hash className="w-3 h-3 text-slate-400" />
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder="Page"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="w-12 bg-transparent text-xs text-center font-bold text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!jumpInput || isLoading}
              className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40"
            >
              သွားပါ
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
