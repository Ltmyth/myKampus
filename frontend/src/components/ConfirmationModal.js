'use client';

import React, { useEffect } from 'react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  icon = null,
  loading = false,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-50 text-red-600 border-red-200',
      btn: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400',
      defaultIcon: '🗑️',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-400',
      defaultIcon: '⚠️',
    },
    primary: {
      iconBg: 'bg-emerald-50 text-brand-dark border-emerald-200',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400',
      defaultIcon: '✨',
    },
  };

  const style = variantStyles[variant] || variantStyles.danger;
  const displayIcon = icon || style.defaultIcon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start space-x-3.5">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl shrink-0 shadow-2xs ${style.iconBg}`}>
            {displayIcon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
            <div className="text-slate-600 text-xs mt-1.5 leading-relaxed break-words">{description}</div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 text-xs">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-5 py-2.5 font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${style.btn}`}
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
