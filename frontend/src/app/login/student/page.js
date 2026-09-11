'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function StudentLoginPage() {
  const { login } = useAuth();
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regNumber || !password) {
      setErrorMsg('Please enter your official Registration Number (e.g. 2026SOBAT-A001) and password.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    
    const res = await login(regNumber, password, 'student');
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid student credentials. Please verify your registration number and password.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d3d24] via-[#1a5c38] to-[#0f4a2e] flex items-center justify-center p-4">
      {/* Radial overlay pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
      
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a5c38] to-[#154d2f] px-8 py-7 text-center">
            <div className="flex justify-center mb-3">
              <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">Student Academic Portal</h1>
            <p className="text-white/70 text-xs mt-1 font-medium uppercase tracking-wider">Clarke International University</p>
          </div>

          {/* Form container */}
          <div className="px-8 py-7">
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl mb-4 text-xs">
              <span className="font-bold text-emerald-800 block mb-0.5">🎓 Student Sign In</span>
              <span className="text-slate-600">Enter your student Registration Number and Password to access your courses, tests, and academic records.</span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-medium animate-fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">
                  Registration Number
                </label>
                <input 
                  type="text" 
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. 2026SOBAT-A001" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">
                  Password
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-3 bg-brand-light hover:bg-brand-medium text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authenticating Student...</span>
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Router switcher footer links */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link href="/login/staff" className="text-slate-500 hover:text-brand-dark transition-all">
                🏛️ Staff & Executive Sign In →
              </Link>
              <Link href="/login?tab=register" className="text-brand-medium hover:underline transition-all">
                ✉️ Redeem Invite
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-5 font-medium">
          © 2026 Clarke International University · Uganda
        </p>
      </div>
    </div>
  );
}
