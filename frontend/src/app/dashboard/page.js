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
    exams: 0,
    tests: 0,
    classTimetables: 0,
    examTimetables: 0,
    users: 0,
    invites: 0,
    sessions: 0
  });
  const [recentExams, setRecentExams] = useState([]);
  const [recentClassTimetables, setRecentClassTimetables] = useState([]);
  const [recentExamTimetables, setRecentExamTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const fetchPromises = [
          api.get('/courses/').then(res => res.length).catch(() => 0),
          api.get('/exams/').then(res => res.length).catch(() => 0),
          api.get('/tests/').then(res => res.length).catch(() => 0),
          api.get('/class-timetables/').then(res => res.length).catch(() => 0),
          api.get('/exam-timetables/').then(res => res.length).catch(() => 0),
        ];

        if (user.role === 'admin') {
          fetchPromises.push(api.get('/admin/users/').then(res => res.length).catch(() => 0));
          fetchPromises.push(api.get('/invitations/').then(res => res.length).catch(() => 0));
        } else {
          fetchPromises.push(Promise.resolve(0));
          fetchPromises.push(Promise.resolve(0));
        }

        fetchPromises.push(api.get('/attendance/sessions/').then(res => res.length).catch(() => 0));

        const [
          coursesCount,
          examsCount,
          testsCount,
          classTimetablesCount,
          examTimetablesCount,
          usersCount,
          invitesCount,
          sessionsCount
        ] = await Promise.all(fetchPromises);

        setStats({
          courses: coursesCount,
          exams: examsCount,
          tests: testsCount,
          classTimetables: classTimetablesCount,
          examTimetables: examTimetablesCount,
          users: usersCount,
          invites: invitesCount,
          sessions: sessionsCount
        });

        // Load recent listings for context
        const examsData = await api.get('/exams/').catch(() => []);
        setRecentExams(examsData.slice(0, 3));

        const classTtData = await api.get('/class-timetables/').catch(() => []);
        setRecentClassTimetables(classTtData.slice(0, 3));

        const examTtData = await api.get('/exam-timetables/').catch(() => []);
        setRecentExamTimetables(examTtData.slice(0, 3));

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

  const isExecutive = ['dvc', 'vc', 'dean'].includes(user.role);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-dark via-brand-medium to-brand-light rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="space-y-2 z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Welcome, {user.first_name || user.username}!</h2>
          <p className="text-white/80 text-sm max-w-md font-light">
            Logged in as <span className="font-semibold text-brand-emerald capitalize">{user.role.replace('_', ' ')}</span>. Manage academic timetables, course exams, tests, and attendance tracking.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2.5 z-10">
          {user.role === 'student' && (
            <>
              <button onClick={() => router.push('/dashboard/exams')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
                Take Exam
              </button>
              <button onClick={() => router.push('/dashboard/faculty')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm border border-white/15 transition-all">
                View Class Timetable
              </button>
            </>
          )}
          {user.role === 'lecturer' && (
            <>
              <button onClick={() => router.push('/dashboard/exams')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
                Create Exam / Test
              </button>
              <button onClick={() => router.push('/dashboard/classes')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm border border-white/15 transition-all">
                Open Class Attendance
              </button>
            </>
          )}
          {user.role === 'faculty_admin' && (
            <button onClick={() => router.push('/dashboard/faculty')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              Manage Class Timetables
            </button>
          )}
          {user.role === 'registrar' && (
            <button onClick={() => router.push('/dashboard/exams')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              Manage Exam Timetables
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => router.push('/dashboard/admin')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              Manage Users & Audit Logs
            </button>
          )}
          {isExecutive && (
            <button onClick={() => router.push('/dashboard/reports')} className="px-5 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]">
              View Academic Analytics
            </button>
          )}
        </div>
      </div>

      {/* Grid Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Courses */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center space-x-4">
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

        {/* Card 2: Class Timetables */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-brand-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Class Timetables</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.classTimetables}</h3>
          </div>
        </div>

        {/* Card 3: Exams & Tests */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Exams & Tests</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.exams + stats.tests}</h3>
          </div>
        </div>

        {/* Card 4: Exam Schedules / Attendance */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {user.role === 'admin' ? 'Active Invites' : 'Exam Schedules'}
            </p>
            <h3 className="text-2xl font-bold text-slate-800">
              {user.role === 'admin' ? stats.invites : stats.examTimetables}
            </h3>
          </div>
        </div>

      </div>

      {/* Main Panels Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Double Panel: Recent Exams and Timetables */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Exams Panel */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Active Mid-Terms & Finals</h3>
              <button onClick={() => router.push('/dashboard/exams')} className="text-xs font-semibold text-brand-light hover:underline">
                View All
              </button>
            </div>

            {recentExams.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                No active exams scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentExams.map((ex) => (
                  <div key={ex.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-850">{ex.title}</h4>
                      <p className="text-xs text-slate-500">{ex.course_code} · {ex.duration_minutes} mins · By {ex.lecturer_name}</p>
                    </div>
                    {user.role === 'student' ? (
                      <button onClick={() => router.push(`/dashboard/exams`)} className="px-3 py-1.5 bg-brand-light text-white text-xs font-semibold rounded-lg hover:bg-brand-medium transition-all">
                        Launch Exam
                      </button>
                    ) : (
                      <span className={`px-2.5 py-1 rounded text-xs font-medium border ${ex.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {ex.is_active ? 'Active' : 'Draft'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Class Timetables Quick Preview */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Faculty Class Schedules</h3>
              <button onClick={() => router.push('/dashboard/faculty')} className="text-xs font-semibold text-brand-light hover:underline">
                Full Timetable
              </button>
            </div>

            {recentClassTimetables.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                No class timetables posted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentClassTimetables.map((tt) => (
                  <div key={tt.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-850">{tt.course_code}: {tt.course_name}</h4>
                      <p className="text-xs text-slate-500">{tt.day_of_week} · {tt.start_time} - {tt.end_time} · Room: {tt.room}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 capitalize">
                      {tt.class_type}
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
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Role Quick Actions</h3>
            
            <div className="flex flex-col space-y-2">
              {isExecutive && (
                <button onClick={() => router.push('/dashboard/reports')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                  📊 Executive Academic Analytics & Reports
                </button>
              )}
              {user.role === 'admin' && (
                <>
                  <button onClick={() => router.push('/dashboard/admin')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    + Generate User Invite Link
                  </button>
                  <button onClick={() => router.push('/dashboard/admin')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    🛡️ View System Audit Logs
                  </button>
                </>
              )}
              {user.role === 'student' && (
                <>
                  <button onClick={() => router.push('/dashboard/faculty')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    📅 Check Weekly Class Timetable
                  </button>
                  <button onClick={() => router.push('/dashboard/exams')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    🎓 Check Exam Schedules
                  </button>
                </>
              )}
              {user.role === 'lecturer' && (
                <>
                  <button onClick={() => router.push('/dashboard/classes')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    🕒 Open Class Attendance Window
                  </button>
                  <button onClick={() => router.push('/dashboard/exams')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                    ✏️ Set Exam / Test Questions
                  </button>
                </>
              )}
              {user.role === 'faculty_admin' && (
                <button onClick={() => router.push('/dashboard/faculty')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                  📅 Create / Edit Faculty Timetables
                </button>
              )}
              {user.role === 'registrar' && (
                <button onClick={() => router.push('/dashboard/exams')} className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all">
                  📝 Create / Manage Exam Timetables
                </button>
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
