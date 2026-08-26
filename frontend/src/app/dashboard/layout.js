'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium text-sm">Loading workspace...</p>
      </div>
    );
  }

  if (!user) return null;

  // Determine navigation menu items based on role
  const menuItems = [
    {
      name: 'Overview',
      path: '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      name: 'Test Portal',
      path: '/dashboard/tests',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'Exams Portal',
      path: '/dashboard/exams',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      name: 'Faculty & Timetabling',
      path: '/dashboard/faculty',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      name: 'Classroom & Attendance',
      path: '/dashboard/classes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      name: 'Academic Reports',
      path: '/dashboard/reports',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  // System Admin gets user invite panel
  if (user.role === 'admin') {
    menuItems.push({
      name: 'Manage Users & Invites',
      path: '/dashboard/admin',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    });
  }

  const navigateTo = (path) => {
    router.push(path);
    setMobileMenuOpen(false);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'vc': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dvc': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'registrar': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'dean': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'faculty_admin': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'lecturer': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'System Admin';
      case 'vc': return 'Vice-Chancellor (VC)';
      case 'dvc': return 'DVC / Chancellor';
      case 'registrar': return 'Academic Registrar';
      case 'dean': return 'Faculty Dean';
      case 'faculty_admin': return 'Faculty Secretary';
      case 'lecturer': return 'Lecturer';
      default: return 'Student';
    }
  };

  return (
    <div className="flex-1 flex flex-row min-h-screen bg-slate-50">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-brand-dark text-white border-r border-brand-light/10 shadow-lg shrink-0">
        {/* Sidebar Header */}
        <div className="px-6 py-6 border-b border-white/5 flex items-center space-x-3">
          <div className="p-1.5 bg-brand-light rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight text-white">My Kampus</h2>
            <p className="text-[10px] text-white/50 font-medium tracking-wider uppercase">Kampus Portal</p>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => navigateTo(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-brand-light text-white shadow-md' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/5 bg-black/10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center font-bold text-sm text-brand-emerald border border-white/10 uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user.first_name || user.username} {user.last_name}</p>
              <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold border capitalize ${getRoleBadgeColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-red-950/20 hover:text-red-300 rounded-lg border border-white/5 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-sm md:shadow-none">
          <div className="flex items-center">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg mr-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-850">Clarke International University</h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Welcome, {user.first_name || user.username} ({getRoleLabel(user.role).toUpperCase()}) · Local Time: {new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <div className="w-2 h-2 bg-brand-emerald rounded-full animate-pulse"></div>
              <span>{user.first_name || user.username} ({getRoleLabel(user.role)})</span>
            </div>
            
            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-all shadow-sm active:scale-95"
              title="Sign out of system"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Student Academic Info Banner */}
        {user.role === 'student' && (
          <div className="bg-white text-slate-800 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-brand-light/10 border border-brand-light/20 flex items-center justify-center font-extrabold text-brand-dark text-sm shadow-sm">
                🎓
              </div>
              <div>
                <p className="text-xs font-black tracking-wide uppercase text-slate-800">
                  {user.first_name || user.username} {user.last_name}
                </p>
                <p className="text-[11px] text-brand-dark font-bold">
                  Reg No: <span className="font-mono text-brand-dark bg-slate-100 px-2 py-0.5 rounded border border-slate-200 ml-1">{user.registration_number || `2026/CIU/FST/${user.id}`}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Faculty:</span>
                <span className="text-emerald-700 font-bold">{user.faculty_name ? `${user.faculty_code} (${user.faculty_name})` : 'Faculty of Science & Technology (FST)'}</span>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Registered Program:</span>
                <span className="text-indigo-700 font-bold">
                  {user.assigned_course_codes && user.assigned_course_codes.length > 0 
                    ? user.assigned_course_codes.join(', ') 
                    : 'Bachelor of Information Technology (BIT)'}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 shadow-sm">
                <span className="text-emerald-800 font-bold uppercase text-[10px]">Status:</span>
                <span className="text-emerald-700 font-bold">Active Registered Student</span>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Modal/Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="relative flex flex-col w-64 max-w-xs bg-brand-dark text-white border-r border-brand-light/10 shadow-2xl h-full p-0">
            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Logo */}
            <div className="px-6 py-6 border-b border-white/5 flex items-center space-x-3">
              <div className="p-1.5 bg-brand-light rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-bold text-sm text-white">My Kampus</h2>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigateTo(item.path)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-brand-light text-white' : 'text-white/70 hover:bg-white/5'}`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Profile */}
            <div className="p-4 border-t border-white/5 bg-black/10">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center font-bold text-sm text-brand-emerald">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{user.first_name || user.username} {user.last_name}</p>
                  <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold border capitalize ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold text-white bg-white/5 rounded-lg border border-white/5"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
