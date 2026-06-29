'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    courses: 0,
    applications: 0,
    exams: 0,
    attempts: 0,
    users: 0,
    invites: 0,
    contents: 0,
    sessions: 0
  });
  const [recentExams, setRecentExams] = useState([]);
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const fetchPromises = [
          api.get('/courses/').then(res => res.length).catch(() => 0),
          api.get('/applications/').then(res => res.length).catch(() => 0),
          api.get('/exams/').then(res => res.length).catch(() => 0),
          api.get('/contents/').then(res => res.length).catch(() => 0),
        ];

        if (user.role === 'admin') {
          fetchPromises.push(api.get('/admin/users/').then(res => res.length).catch(() => 0));
          fetchPromises.push(api.get('/invitations/').then(res => res.length).catch(() => 0));
        } else {
          fetchPromises.push(Promise.resolve(0));
          fetchPromises.push(Promise.resolve(0));
        }

        if (user.role === 'student') {
          fetchPromises.push(api.get('/attempts/').then(res => res.length).catch(() => 0));
        } else {
          fetchPromises.push(api.get('/attempts/').then(res => res.length).catch(() => 0));
        }

        fetchPromises.push(api.get('/attendance/sessions/').then(res => res.length).catch(() => 0));

        const [
          coursesCount,
          appsCount,
          examsCount,
          contentsCount,
          usersCount,
          invitesCount,
          attemptsCount,
          sessionsCount
        ] = await Promise.all(fetchPromises);

        setStats({
          courses: coursesCount,
          applications: appsCount,
          exams: examsCount,
          contents: contentsCount,
          users: usersCount,
          invites: invitesCount,
          attempts: attemptsCount,
          sessions: sessionsCount
        });

        // Load some listings for context
        const examsData = await api.get('/exams/').catch(() => []);
        setRecentExams(examsData.slice(0, 3));

        const appsData = await api.get('/applications/').catch(() => []);
        setRecentApps(appsData.slice(0, 3));

      } catch (err) {
        console.error("Error loading dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-dark via-brand-medium to-brand-light rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between border border-white/10 relative overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="space-y-2 z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome, {user.first_name}!</h2>
          <p className="text-white/80 text-sm max-w-md font-light">
            You are logged in as a <span className="font-semibold text-brand-emerald capitalize">{user.role}</span>. Access all My Kampus tools, coursework resources, and attendance forms below.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex space-x-3 z-10">
          {user.role === 'student' && (
            <>
              <button onClick={() => router.push('/dashboard/exams')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
                Take Exam
              </button>
              <button onClick={() => router.push('/dashboard/applications')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm border border-white/15 transition-all">
                Apply for Course
              </button>
            </>
          )}
          {user.role === 'lecturer' && (
            <>
              <button onClick={() => router.push('/dashboard/exams')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
                Create Exam
              </button>
              <button onClick={() => router.push('/dashboard/classes')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm border border-white/15 transition-all">
                Start Class Attendance
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button onClick={() => router.push('/dashboard/admin')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              Manage Users & Invites
            </button>
          )}
          {['dean', 'dvc'].includes(user.role) && (
            <button onClick={() => router.push('/dashboard/applications')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              Review Applications
            </button>
          )}
        </div>
      </div>

      {/* Grid Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-brand-light">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Courses</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.courses}</h3>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Applications</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.applications}</h3>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Exams</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.exams}</h3>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {user.role === 'admin' ? 'Active Invites' : 'Attendance Sessions'}
            </p>
            <h3 className="text-2xl font-bold text-slate-800">
              {user.role === 'admin' ? stats.invites : stats.sessions}
            </h3>
          </div>
        </div>

      </div>

      {/* Main Panels Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Double Panel: Recent Exams and Applications */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Exams Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Active Mid-Terms & Finals</h3>
              <button onClick={() => router.push('/dashboard/exams')} className="text-xs font-semibold text-brand-light hover:underline">
                View All
              </button>
            </div>

            {recentExams.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                No exams available.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentExams.map((ex) => (
                  <div key={ex.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-850">{ex.title}</h4>
                      <p className="text-xs text-slate-450">{ex.course_code} · {ex.duration_minutes} mins · By {ex.lecturer_name}</p>
                    </div>
                    {user.role === 'student' ? (
                      <button onClick={() => router.push(`/dashboard/exams`)} className="px-3 py-1.5 bg-brand-light text-white text-xs font-semibold rounded-lg hover:bg-brand-medium transition-all">
                        Launch
                      </button>
                    ) : (
                      <span className={`px-2.5 py-1 rounded text-xs font-medium border ${ex.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        {ex.is_active ? 'Active' : 'Draft'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applications Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Course Application Filings</h3>
              <button onClick={() => router.push('/dashboard/applications')} className="text-xs font-semibold text-brand-light hover:underline">
                Manage
              </button>
            </div>

            {recentApps.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                No application filings found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentApps.map((ap) => (
                  <div key={ap.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-850">{ap.course_name} ({ap.course_code})</h4>
                      <p className="text-xs text-slate-450">Filer: {ap.student_name} · Applied: {new Date(ap.applied_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize border ${ap.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ap.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {ap.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar: Shortcuts, Profile Details, Quick links */}
        <div className="space-y-8">
          
          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Shortcut Actions</h3>
            
            <div className="flex flex-col space-y-2">
              {user.role === 'admin' && (
                <>
                  <button onClick={() => router.push('/dashboard/admin')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    + Generate Invite Link
                  </button>
                  <button onClick={() => router.push('/dashboard/admin')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    👥 View User Database
                  </button>
                </>
              )}
              {user.role === 'student' && (
                <>
                  <button onClick={() => router.push('/dashboard/classes')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    📝 Verify Daily Attendance
                  </button>
                  <button onClick={() => router.push('/dashboard/classes')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    📚 Fetch Class Materials
                  </button>
                </>
              )}
              {user.role === 'lecturer' && (
                <>
                  <button onClick={() => router.push('/dashboard/classes')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    🕒 Open Class Attendance Window
                  </button>
                  <button onClick={() => router.push('/dashboard/classes')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    📤 Share Reading Materials
                  </button>
                  <button onClick={() => router.push('/dashboard/exams')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    ✏️ Add Exam Questions
                  </button>
                </>
              )}
              {['dean', 'dvc'].includes(user.role) && (
                <>
                  <button onClick={() => router.push('/dashboard/applications')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    ✓ Action Pending Registrations
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Card */}
          <div className="bg-gradient-to-br from-[#0d3d24]/5 to-[#1a5c38]/5 rounded-2xl p-6 shadow-sm border border-[#1a5c38]/10 space-y-4">
            <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wider">Clarke Info Center</h3>
            <div className="space-y-2 text-xs font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Institution:</span>
                <span className="font-bold text-slate-800">My Kampus Portal</span>
              </div>
              <div className="flex justify-between">
                <span>Academic Year:</span>
                <span className="font-bold text-slate-800">2026/2027</span>
              </div>
              <div className="flex justify-between">
                <span>Registered Email:</span>
                <span className="font-bold text-slate-800">{user.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Status:</span>
                <span className="font-bold text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded">Active</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
