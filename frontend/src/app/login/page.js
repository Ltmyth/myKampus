'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  
  // Login states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register states
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

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setErrorMsg('Please enter both username and password.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    
    const res = await login(loginUsername, loginPassword);
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials. Try again.');
      setSubmitting(false);
    }
  };

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
        setRegEmail(data.email); // Auto-fill their invited email
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
      role: inviteRole // Backend will confirm this role matches token
    });

    if (res.success) {
      setSuccessMsg('Account created successfully! You can now sign in.');
      setErrorMsg('');
      setIsRegister(false); // Switch to sign in tab
      setLoginUsername(regUsername); // Pre-fill login
      setLoginPassword('');
      // Reset registration form
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegPhone('');
      setRegInviteCode('');
      setInviteVerified(false);
      setInviteRole('');
    } else {
      setErrorMsg(res.error || 'Registration failed. Try a different username.');
    }
    setSubmitting(false);
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">My Kampus</h1>
            <p className="text-white/70 text-xs mt-1 font-medium uppercase tracking-wider">Clarke International University</p>
          </div>

          {/* Form container */}
          <div className="px-8 py-7">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 mb-6">
              <button 
                onClick={() => { setIsRegister(false); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all ${!isRegister ? 'border-brand-light text-brand-light' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsRegister(true); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all ${isRegister ? 'border-brand-light text-brand-light' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Redeem Invitation
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-medium animate-fade-in">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-brand-emerald rounded text-brand-medium text-xs font-medium animate-fade-in">
                {successMsg}
              </div>
            )}

            {!isRegister ? (
              /* Sign In Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Username</label>
                  <input 
                    type="text" 
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-3 bg-brand-light hover:bg-brand-medium text-white rounded-lg font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : 'Sign In'}
                </button>
              </form>
            ) : (
              /* Registration with invitation code */
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Invitation Code</label>
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
                      className={`flex-1 px-4 py-2 bg-slate-50 border rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 transition-all ${inviteVerified ? 'border-brand-emerald focus:border-brand-emerald' : 'border-slate-200 focus:border-brand-light'}`}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyInvite}
                      disabled={verifyingInvite || !regInviteCode}
                      className="px-3 bg-brand-light text-white text-xs font-semibold rounded-lg hover:bg-brand-medium active:scale-[0.98] transition-all disabled:opacity-50"
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
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Username</label>
                  <input 
                    type="text" 
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Choose a username" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Email (Autofilled)</label>
                  <input 
                    type="email" 
                    value={regEmail}
                    disabled
                    placeholder="Verify code to populate email" 
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Password</label>
                    <input 
                      type="password" 
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Confirm</label>
                    <input 
                      type="password" 
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Phone (Optional)</label>
                  <input 
                    type="text" 
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+256..." 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={submitting || !inviteVerified}
                  className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white rounded-lg font-semibold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center space-x-2"
                >
                  {submitting ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-5">
          © 2026 Clarke International University · Uganda
        </p>
      </div>
    </div>
  );
}
