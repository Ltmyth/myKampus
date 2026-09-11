'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function StaffLoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please enter your staff Username or Email and password.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    
    const res = await login(username, password, 'staff');
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid staff credentials. Please verify your username and password.');
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0H9" />
                </svg>
              </div>
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">Staff & Executive Portal</h1>
            <p className="text-white/70 text-xs mt-1 font-medium uppercase tracking-wider">Clarke International University</p>
          </div>

          {/* Form container */}
          <div className="px-8 py-7">
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl mb-4 text-xs">
              <span className="font-bold text-slate-800 block mb-0.5">🏛️ Staff Authentication</span>
              <span className="text-slate-600">For Lecturers, Deans, Academic Registrars, Secretaries, Vice-Chancellors, and System Administrators.</span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-medium animate-fade-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">
                  Staff Username or Email
                </label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Staff username or email" 
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
                className="w-full py-3 bg-brand-dark hover:bg-brand-medium text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authenticating Staff...</span>
                  </>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Router switcher footer links */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <Link href="/login/student" className="text-emerald-700 hover:text-emerald-900 transition-all">
                🎓 Student Portal Sign In →
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
