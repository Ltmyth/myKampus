'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
  const { register } = useAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  
  // Register / Invite state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  
  // Verify invite token state
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteVerified, setInviteVerified] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteRole, setInviteRole] = useState('');

  // UI notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get('invite');
      const tabParam = params.get('tab');
      if (inviteParam || tabParam === 'register') {
        if (inviteParam) setRegInviteCode(inviteParam);
        setShowInviteForm(true);
      }
    }
  }, []);

  const handleVerifyInvite = async () => {
    if (!regInviteCode) {
      setInviteError('Please enter an invitation code first.');
      return;
    }
    setInviteError('');
    setVerifyingInvite(true);
    setInviteVerified(false);

    try {
      const data = await api.get(`/invitations/verify/${regInviteCode}/`);
      if (data.valid) {
        setInviteVerified(true);
        setInviteRole(data.role);
        setRegEmail(data.email);
        setSuccessMsg(`Valid invitation code! Registered role: ${data.role.toUpperCase()}`);
        setErrorMsg('');
      } else {
        setInviteError('Invalid or expired invitation token.');
      }
    } catch (err) {
      setInviteError(err.message || 'Verification failed. Double check your code.');
    } finally {
      setVerifyingInvite(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUsername || !regPassword || !regConfirmPassword || !regInviteCode) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!inviteVerified) {
      setErrorMsg('Please verify your invitation code first.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const res = await register({
      username: regUsername,
      email: regEmail,
      password: regPassword,
      phone: regPhone,
      invitation_code: regInviteCode,
      role: inviteRole
    });

    if (res.success) {
      setSuccessMsg('Account created successfully! Please proceed to your portal sign in.');
      setErrorMsg('');
      setShowInviteForm(false);
    } else {
      setErrorMsg(res.error || 'Registration failed. Try a different username.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d3d24] via-[#1a5c38] to-[#0f4a2e] flex items-center justify-center p-4">
      {/* Radial overlay pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
      
      <div className="relative w-full max-w-xl animate-slide-up space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10 p-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <h1 className="text-slate-900 text-2xl font-bold tracking-tight">Clarke International University</h1>
          <p className="text-brand-medium text-xs mt-1 font-bold uppercase tracking-widest">MyKampus Academic Portal Selection</p>
          <p className="text-slate-500 text-xs mt-2">Select your designated portal below to sign in with your account credentials.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl text-red-700 text-xs font-semibold animate-fade-in shadow-md">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border-l-4 border-brand-emerald rounded-2xl text-brand-medium text-xs font-semibold animate-fade-in shadow-md">
            {successMsg}
          </div>
        )}

        {!showInviteForm ? (
          /* Portal Choice Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* Student Portal Card */}
            <Link 
              href="/login/student"
              className="bg-white hover:bg-emerald-50/50 p-6 rounded-2xl shadow-xl border border-white/20 hover:border-emerald-500/50 transition-all transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold mb-3 group-hover:scale-110 transition-transform">
                  🎓
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-800">Student Portal</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  For registered students. Access course materials, timetables, proctored tests, and exam submissions.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-emerald-700 pt-2">
                <span>Sign In</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>

            {/* Staff & Executive Portal Card */}
            <Link 
              href="/login/staff"
              className="bg-white hover:bg-slate-50 p-6 rounded-2xl shadow-xl border border-white/20 hover:border-brand-dark/50 transition-all transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="w-12 h-12 bg-slate-100 text-brand-dark rounded-xl flex items-center justify-center text-xl font-bold mb-3 group-hover:scale-110 transition-transform">
                  🏛️
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-dark">Staff & Executive Portal</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  For Lecturers, Deans, Academic Registrars, Secretaries, Vice-Chancellors, and System Administrators.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-brand-dark pt-2">
                <span>Sign In</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>

          </div>
        ) : (
          /* Invitation Redemption Form */
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-white/10 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">✉️ Redeem User Invitation</h3>
                <p className="text-xs text-slate-500">Enter your invitation code dispatched by CIU Administration to create your account.</p>
              </div>
              <button 
                onClick={() => setShowInviteForm(false)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕ Cancel
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Invitation Code</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={regInviteCode}
                    onChange={(e) => {
                      setRegInviteCode(e.target.value);
                      setInviteVerified(false);
                      setInviteError('');
                    }}
                    placeholder="Paste UUID invitation token" 
                    className={`flex-1 px-4 py-2 bg-slate-50 border rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 transition-all ${inviteVerified ? 'border-brand-emerald focus:border-brand-emerald' : 'border-slate-200 focus:border-brand-light'}`}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyInvite}
                    disabled={verifyingInvite || !regInviteCode}
                    className="px-4 bg-brand-light text-white text-xs font-bold rounded-xl hover:bg-brand-medium active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {verifyingInvite ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {inviteError && (
                  <span className="text-[10px] text-red-500 font-medium mt-1 block">{inviteError}</span>
                )}
                {inviteVerified && (
                  <span className="text-[10px] text-brand-emerald font-semibold mt-1 block">✓ Verified for role: {inviteRole.toUpperCase()}</span>
                )}
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Username</label>
                <input 
                  type="text" 
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Choose a username" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Email (Autofilled)</label>
                <input 
                  type="email" 
                  value={regEmail}
                  disabled
                  placeholder="Verify code to populate email" 
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs focus:outline-none cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Confirm Password</label>
                  <input 
                    type="password" 
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold uppercase tracking-wider mb-1">Phone (Optional)</label>
                <input 
                  type="text" 
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+256..." 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting || !inviteVerified}
                className="w-full py-3 bg-brand-light hover:bg-brand-medium text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center space-x-2"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {/* Footer Links */}
        <div className="text-center space-y-2">
          {!showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="text-xs text-emerald-200 hover:text-white font-semibold underline transition-colors"
            >
              ✉️ Have an invitation code? Click here to redeem
            </button>
          )}
          <p className="text-white/40 text-xs font-medium">
            © 2026 Clarke International University · Uganda
          </p>
        </div>
      </div>
    </div>
  );
}
