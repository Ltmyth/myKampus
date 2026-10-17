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
  const [assignedFaculties, setAssignedFaculties] = useState([]);
  const [facultyStats, setFacultyStats] = useState([]);
  const [recentExams, setRecentExams] = useState([]);
  const [recentClassTimetables, setRecentClassTimetables] = useState([]);
  const [recentExamTimetables, setRecentExamTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // High-performance pre-aggregated overview endpoint (sub-50ms loading)
        const overview = await api.get('/dashboard/overview/');
        if (overview && overview.stats) {
          setStats(overview.stats);
          setAssignedFaculties(overview.assigned_faculties || []);
          setFacultyStats(overview.faculty_stats || []);
          setRecentExams(overview.recent_exams || []);
          setRecentClassTimetables(overview.recent_class_timetables || []);
          setRecentExamTimetables(overview.recent_exam_timetables || []);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Optimized overview endpoint failed, executing fallback:", err);
      }

      // Graceful fallback for offline / development resilience
      try {
        const [
          coursesData,
          examsData,
          testsData,
          facultiesData,
          classTtData,
          examTtData,
          sessionsData,
          usersCount,
          invitesCount
        ] = await Promise.all([
          api.get('/courses/').catch(() => []),
          api.get('/exams/').catch(() => []),
          api.get('/tests/').catch(() => []),
          api.get('/faculties/').catch(() => []),
          api.get('/class-timetables/').catch(() => []),
          api.get('/exam-timetables/').catch(() => []),
          api.get('/attendance/sessions/').catch(() => []),
          (user.role === 'admin' || user.role === 'platform_coordinator') ? api.get('/admin/users/').then(res => res.length).catch(() => 0) : Promise.resolve(0),
          (user.role === 'admin' || user.role === 'platform_coordinator') ? api.get('/invitations/').then(res => res.length).catch(() => 0) : Promise.resolve(0)
        ]);

        // Resolve user's actual assigned faculty / faculties
        let userFacs = [];
        if (user.assigned_faculty_details && user.assigned_faculty_details.length > 0) {
          userFacs = user.assigned_faculty_details;
        } else if (user.faculty || user.faculty_code) {
          const matched = facultiesData.find(f => f.id === user.faculty || f.code === user.faculty_code);
          if (matched) userFacs = [matched];
          else if (user.faculty_name) userFacs = [{ id: user.faculty, code: user.faculty_code || 'FAC', name: user.faculty_name }];
        } else if (['admin', 'platform_coordinator', 'registrar', 'dvc', 'vc'].includes(user.role)) {
          userFacs = facultiesData;
        }
        setAssignedFaculties(userFacs);

        // Compute per-assigned-faculty affiliated courses & assessments
        const perFacStats = userFacs.map(fac => {
          const facCourses = coursesData.filter(c => c.faculty === fac.id || c.faculty_code === fac.code || (c.faculty && c.faculty.code === fac.code));
          const facCourseIds = facCourses.map(c => c.id);
          const facExams = examsData.filter(e => facCourseIds.includes(e.course) || e.faculty === fac.id || e.faculty_code === fac.code);
          const facTests = testsData.filter(t => facCourseIds.includes(t.course) || t.faculty === fac.id || t.faculty_code === fac.code);
          return {
            id: fac.id,
            code: fac.code,
            name: fac.name,
            coursesCount: facCourses.length,
            examsCount: facExams.length,
            testsCount: facTests.length,
            totalAssessments: facExams.length + facTests.length
          };
        });
        setFacultyStats(perFacStats);

        setStats({
          courses: coursesData.length,
          exams: examsData.length,
          tests: testsData.length,
          classTimetables: classTtData.length,
          examTimetables: examTtData.length,
          users: usersCount,
          invites: invitesCount,
          sessions: sessionsData.length
        });

        // Load recent listings for context
        setRecentExams(examsData.slice(0, 3));
        setRecentClassTimetables(classTtData.slice(0, 3));
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
            Logged in as <span className="font-semibold text-brand-emerald capitalize">{user.role === 'faculty_admin' ? 'Faculty Secretary' : user.role.replace('_', ' ')}</span>. Manage academic timetables, course exams, and tests.
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
          {(user.role === 'admin' || user.role === 'platform_coordinator') && (
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

      {/* ASSIGNED FACULTY / MULTIPLE FACULTIES SECTION */}
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg shadow-inner">
              🏛️
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {assignedFaculties.length > 1 ? `Actual Assigned Faculties (${assignedFaculties.length})` : 'Assigned Academic Faculty'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Scoped access strictly enforced for {user.role === 'student' ? 'course enrollment and assessments' : 'course units and exam/test setting'}.
              </p>
            </div>
          </div>
          {assignedFaculties.length > 1 && (
            <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 text-xs font-black rounded-xl">
              ⚡ Multi-Faculty Access Active
            </span>
          )}
        </div>

        {facultyStats.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-slate-100">
            No specific faculty assigned yet. Please contact your Faculty Secretary or System Administrator.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {facultyStats.map((fac) => (
              <div
                key={fac.id || fac.code}
                className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 rounded-2xl p-5 border border-slate-200 hover:border-emerald-300 shadow-sm transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-200 font-mono">
                      {fac.code}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Authorised Faculty
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-850 leading-snug pt-1">
                    {fac.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Courses</p>
                    <p className="text-base font-extrabold text-brand-dark">{fac.coursesCount}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Tests & Exams</p>
                    <p className="text-base font-extrabold text-emerald-700">{fac.totalAssessments}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${user.role === 'student' ? 'exams' : 'faculty'}?faculty=${fac.code}`)}
                  className="w-full py-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  View {fac.code} Workspaces →
                </button>
              </div>
            ))}
          </div>
        )}
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
              {user.role === 'admin' || user.role === 'platform_coordinator' ? 'Active Invites' : 'Exam Schedules'}
            </p>
            <h3 className="text-2xl font-bold text-slate-800">
              {user.role === 'admin' || user.role === 'platform_coordinator' ? stats.invites : stats.examTimetables}
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
              {(user.role === 'admin' || user.role === 'platform_coordinator') && (
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
              {user.gender && (
                <div className="flex justify-between">
                  <span>Gender:</span>
                  <span className="font-bold text-slate-800 capitalize">{user.gender_display || user.gender}</span>
                </div>
              )}
              {user.role === 'student' && (
                <>
                  <div className="flex justify-between">
                    <span>Study Level:</span>
                    <span className="font-bold text-slate-800">Year {user.year_of_study || 1} · Sem {user.semester || 1}</span>
                  </div>
                  {user.intake && (
                    <div className="flex justify-between">
                      <span>Intake:</span>
                      <span className="font-bold text-slate-800">{user.intake}</span>
                    </div>
                  )}
                </>
              )}
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
