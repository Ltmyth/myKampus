'use client';

import React, { useState, useEffect } from 'react';

export default function BulkPasswordResetModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount = 0,
  loading = false,
}) {
  const [password, setPassword] = useState('CIU2026Password!');
  const [showVisibility, setShowVisibility] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('CIU2026Password!');
      setShowVisibility(false);
      setCopied(false);
    }
  }, [isOpen]);

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

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let rand = 'CIU';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    rand += '!';
    setPassword(rand);
    setShowVisibility(true);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    onConfirm(password.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl p-2 bg-amber-50 rounded-2xl border border-amber-200">🔑</span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Bulk Reset Passwords</h3>
              <p className="text-slate-500 text-xs">
                Applying to <span className="font-bold text-brand-dark">{selectedCount}</span> selected account(s).
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold uppercase mb-1">New Batch Password</label>
            <div className="relative flex items-center">
              <input
                type={showVisibility ? 'text' : 'password'}
                placeholder="Enter new password for selected users..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-light/20"
                required
                autoFocus
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowVisibility(!showVisibility)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                  title="Toggle Visibility"
                >
                  {showVisibility ? '🙈 Hide' : '👁️ View'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-2 py-1 bg-brand-light text-white font-bold rounded-lg text-[10px] hover:bg-brand-medium cursor-pointer"
                  title="Generate Random Password"
                >
                  🎲 Gen
                </button>
              </div>
            </div>

            {password && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-mono font-bold flex items-center justify-between">
                <span className="truncate pr-2">Preview: <strong>{password}</strong></span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-lg font-bold hover:bg-emerald-800 transition-all shrink-0 cursor-pointer"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
            <span className="text-sm shrink-0">ℹ️</span>
            <span>All selected accounts will receive this password and be required to change it upon their next sign-in.</span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{loading ? 'Resetting...' : `Reset ${selectedCount} Password${selectedCount > 1 ? 's' : ''}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
