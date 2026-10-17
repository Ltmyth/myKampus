'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getApiBaseUrl } from '@/lib/api';
import Link from 'next/link';

export default function ReportsDashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [facultiesList, setFacultiesList] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState('ALL');

  // Sync locked faculty based on user role and assigned details
  useEffect(() => {
    if (user && ['lecturer', 'student', 'faculty_admin', 'dean'].includes(user.role)) {
      const lockedId = user?.faculty?.id || user?.faculty || user?.assigned_faculty_details?.[0]?.id;
      if (lockedId && selectedFaculty === 'ALL') {
        setSelectedFaculty(String(lockedId));
      }
    }
  }, [user]);

  useEffect(() => {
    loadFilters();
  }, []);

  async function loadFilters() {
    try {
      const [facs, crs] = await Promise.all([
        api.get('/faculties/').catch(() => []),
        api.get('/courses/').catch(() => [])
      ]);
      setFacultiesList(facs || []);
      setCoursesList(crs || []);
    } catch (e) {
      console.warn('Error loading filter lists', e);
    }
  }

  useEffect(() => {
    fetchReportSummary();
  }, [selectedFaculty, selectedCourse]);

  async function fetchReportSummary() {
    try {
      if (report) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg('');

      const queryParams = [];
      if (selectedFaculty && selectedFaculty !== 'ALL') {
        queryParams.push(`faculty=${encodeURIComponent(selectedFaculty)}`);
      }
      if (selectedCourse && selectedCourse !== 'ALL') {
        queryParams.push(`course=${encodeURIComponent(selectedCourse)}`);
      }
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      const res = await api.get(`/reports/summary/${queryString}`);
      setReport(res);
      setErrorMsg('');
    } catch (err) {
      console.error('Failed to load academic reports:', err);
      const detail = err?.message || 'Failed to load academic report statistics. Please check your connection or retry.';
      setErrorMsg(detail);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  // Modern Shimmer Skeleton Loader for Reports Dashboard
  if (loading && !report) {
    return (
      <div className="space-y-8 animate-pulse max-w-6xl mx-auto py-4">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-2">
            <div className="h-6 w-72 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-100 rounded-lg"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-40 bg-slate-200 rounded-xl"></div>
            <div className="h-9 w-32 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Top Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-3 w-24 bg-slate-200 rounded"></div>
              <div className="h-8 w-16 bg-slate-300 rounded"></div>
              <div className="h-3 w-32 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>

        {/* Big Banner Skeleton */}
        <div className="h-44 bg-slate-200 rounded-3xl"></div>

        {/* Visual Charts Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="h-4 w-48 bg-slate-200 rounded"></div>
            <div className="h-36 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="h-4 w-48 bg-slate-200 rounded"></div>
            <div className="h-36 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Resilient Error Screen with Full Recovery UI
  if (errorMsg && !report) {
    const apiEndpoint = getApiBaseUrl();
    return (
      <div className="max-w-xl mx-auto py-16 px-4 animate-fade-in text-center space-y-6">
        <div className="p-8 bg-white border border-red-200 shadow-xl rounded-3xl space-y-5">
          <div className="w-16 h-16 mx-auto bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
            ⚠️
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-850">Unable to Load Academic Analytics</h2>
            <p className="text-xs text-red-600 font-semibold bg-red-50 py-2 px-3 rounded-xl border border-red-200">
              {errorMsg}
            </p>
            <p className="text-xs text-slate-500 font-medium pt-1">
              The reporting server could not be reached or timed out. Your session is active and secure.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={fetchReportSummary}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
            >
              <span>🔄</span>
              <span>Retry Loading Reports</span>
            </button>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Back to Dashboard
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Target Endpoint: </span>
            <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">{apiEndpoint}/reports/summary/</code>
          </div>
        </div>
      </div>
    );
  }

  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isLockedFacultyRole = ['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role);
  const userLockedFacultyId = user?.faculty?.id || user?.faculty || user?.assigned_faculty_details?.[0]?.id;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Toast Alert when Refreshing with Cached Report Available */}
      {errorMsg && report && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-amber-800 text-xs font-semibold shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚠️</span>
            <span>{errorMsg} (Displaying previously loaded metrics).</span>
          </div>
          <button
            onClick={fetchReportSummary}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition"
          >
            Retry Refresh
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-850">CIU Academic & Institutional Analytics</h2>
            {isRefreshing && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                Refreshing...
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-medium">Performance evaluations, exam/test pass trends, attendance rates, and live timetable metrics.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Refresh Button */}
          <button
            onClick={fetchReportSummary}
            disabled={loading || isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 transition shadow-sm disabled:opacity-50"
            title="Refresh Academic Analytics"
          >
            <span className={isRefreshing ? 'animate-spin inline-block' : ''}>🔄</span>
            <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>

          {['admin', 'dvc', 'vc', 'dean', 'lecturer', 'registrar', 'faculty_admin'].includes(user?.role) && (
            <>
              <div className="flex items-center space-x-1">
                <select
                  value={isLockedFacultyRole && userLockedFacultyId ? String(userLockedFacultyId) : selectedFaculty}
                  disabled={isLockedFacultyRole && Boolean(userLockedFacultyId)}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-85"
                >
                  <option value="ALL">Filter: All Faculties</option>
                  {facultiesList.map(f => (
                    <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                  ))}
                </select>
                {isLockedFacultyRole && Boolean(userLockedFacultyId) && (
                  <span className="text-[10px] text-amber-700 font-bold">🔒 Locked to Faculty</span>
                )}
              </div>

              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">Filter: All Courses</option>
                {coursesList.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </>
          )}

          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-800 font-bold uppercase tracking-wider">
            {user?.role === 'faculty_admin' ? 'FACULTY SECRETARY' : (user?.role || '').replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* STUDENT REPORT VIEW */}
      {user?.role === 'student' && report && (
        <div className="space-y-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Exam Performance Card */}
            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Examinations</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.exams_done ?? 0}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {report.exams_passed ?? 0} Passed
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Failed: <span className="font-bold text-red-600">{report.exams_failed ?? 0}</span></p>
            </div>

            {/* Test Performance Card */}
            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Continuous Tests & Quizzes</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.tests_done ?? 0}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {report.tests_passed ?? 0} Passed
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Avg. Score: <span className="font-bold text-brand-dark">{report.average_test_score ?? 0}%</span></p>
            </div>

            {/* Class Attendance Card */}
            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Attendance</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-brand-dark">{report.attendance_count ?? 0}</span>
                <span className="text-xs font-bold text-brand-medium bg-brand-light/10 px-2 py-0.5 rounded border border-brand-light/20">
                  Verified Check-ins
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Status: <span className="font-bold text-emerald-600">Active Enrolled Student</span></p>
            </div>

          </div>

          {/* Student Visualisations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Visualisation 1: Assessment Pass Rate Meter */}
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assessment Completion Rate</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Examinations Pass Rate</span>
                    <span className="text-emerald-700 font-bold">
                      {report.exams_done > 0 ? Math.round((report.exams_passed / report.exams_done) * 100) : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${report.exams_done > 0 ? (report.exams_passed / report.exams_done) * 100 : 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Tests & Quizzes Pass Rate</span>
                    <span className="text-brand-dark font-bold">
                      {report.tests_done > 0 ? Math.round((report.tests_passed / report.tests_done) * 100) : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-light rounded-full transition-all duration-500"
                      style={{ width: `${report.tests_done > 0 ? (report.tests_passed / report.tests_done) * 100 : 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualisation 2: Grade Score Breakdown Gauge */}
            <div className="green-card rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Overall Academic Grade Performance</h3>
              <div className="flex items-center space-x-6">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 stroke-current"
                      strokeWidth="3.5"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-brand-emerald stroke-current"
                      strokeWidth="3.5"
                      strokeDasharray={`${Math.min(report.average_test_score || 80, 100)}, 100`}
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xl font-extrabold text-slate-850">
                    {report.average_test_score || 80}%
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-brand-emerald"></div>
                    <span className="text-slate-600 font-medium">Average Test Grade</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-600 font-medium">Passed Assessments</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-2">Keep up consistent attendance and test submissions for top honors.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Course Unit Grades & Submissions Table */}
          {report.course_reports && report.course_reports.length > 0 && (
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Registered Course Units Grade Report</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Course Unit Code</th>
                      <th className="px-4 py-3">Course Unit Name</th>
                      <th className="px-4 py-3">Program Code</th>
                      <th className="px-4 py-3 text-center">Exam Score (%)</th>
                      <th className="px-4 py-3 text-center">Test Score (%)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {report.course_reports.map((cr) => (
                      <tr key={cr.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-extrabold text-brand-dark">{cr.code}</td>
                        <td className="px-4 py-3 font-bold text-slate-850">{cr.name}</td>
                        <td className="px-4 py-3 font-medium text-slate-600">{cr.course_code}</td>
                        <td className="px-4 py-3 text-center font-bold">
                          {cr.has_exam_submission ? (
                            <span className="text-emerald-700 font-extrabold">{cr.exam_score}%</span>
                          ) : (
                            <span className="text-slate-400 font-normal">0% (No Submission)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {cr.has_test_submission ? (
                            <span className="text-brand-dark font-extrabold">{cr.test_score}%</span>
                          ) : (
                            <span className="text-slate-400 font-normal">0% (No Submission)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cr.status === 'PASSED' ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              PASSED
                            </span>
                          ) : cr.status === 'FAILED' ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              FAILED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              0% (NO SUBMISSIONS)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LECTURER REPORT VIEW */}
      {user?.role === 'lecturer' && report && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessments Created</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{(report.exams_created ?? 0) + (report.tests_created ?? 0)}</span>
                <span className="text-xs font-bold text-brand-medium bg-brand-light/10 px-2 py-0.5 rounded border border-brand-light/20">
                  {report.exams_created ?? 0} Exams / {report.tests_created ?? 0} Tests
                </span>
              </div>
            </div>

            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Submissions Received</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{(report.total_exam_submissions ?? 0) + (report.total_test_submissions ?? 0)}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Autograded
                </span>
              </div>
            </div>

            <div className="green-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Pass Rates</span>
              <div className="space-y-1">
                <p className="text-xs text-slate-600">Exams Pass Rate: <span className="font-bold text-emerald-600">{report.exam_pass_rate ?? 0}%</span></p>
                <p className="text-xs text-slate-600">Tests Pass Rate: <span className="font-bold text-emerald-600">{report.test_pass_rate ?? 0}%</span></p>
              </div>
            </div>

          </div>

          {/* Lecturer Visual Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Class Assessment Pass Rate Comparison</h3>
              <div className="flex items-end justify-around h-48 pt-4 pb-2 border-b border-slate-100">
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-xs font-bold text-emerald-600">{report.exam_pass_rate ?? 0}%</span>
                  <div className="w-16 bg-emerald-500 rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(report.exam_pass_rate ?? 0, 10)}%` }}></div>
                  <span className="text-xs font-medium text-slate-500">Exams Pass</span>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-xs font-bold text-brand-dark">{report.test_pass_rate ?? 0}%</span>
                  <div className="w-16 bg-brand-light rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(report.test_pass_rate ?? 0, 10)}%` }}></div>
                  <span className="text-xs font-medium text-slate-500">Tests Pass</span>
                </div>
              </div>
            </div>

            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Student Submission Volume</h3>
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Exam Submissions</span>
                    <span className="font-bold text-slate-800">{report.total_exam_submissions ?? 0}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((report.total_exam_submissions ?? 0) * 10, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Test Submissions</span>
                    <span className="font-bold text-slate-800">{report.total_test_submissions ?? 0}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-emerald rounded-full" style={{ width: `${Math.min((report.total_test_submissions ?? 0) * 10, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE / DEAN / SECRETARY / REGISTRAR / DVC / VC / ADMIN VIEW */}
      {['dean', 'faculty_admin', 'registrar', 'dvc', 'vc', 'admin'].includes(user?.role) && report && (
        <div className="space-y-8">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Students</span>
              <span className="text-2xl font-black text-brand-dark">{report.total_students ?? 0}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Lecturers</span>
              <span className="text-2xl font-black text-brand-medium">{report.total_lecturers ?? 0}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Faculties</span>
              <span className="text-2xl font-black text-brand-dark">{report.total_faculties ?? 0}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Courses / Units</span>
              <span className="text-2xl font-black text-emerald-600">{report.total_courses ?? 0} / {report.total_course_units ?? 0}</span>
            </div>
          </div>

          {/* DVC / VC / Dean / Executive Institutional Financial & Fee Clearance Summary Card */}
          {['dvc', 'vc', 'dean', 'admin'].includes(user?.role) && (
            <div className="bg-gradient-to-br from-[#0d3d24] via-[#0f4a2e] to-[#1a5c38] text-white rounded-3xl p-6 md:p-7 shadow-xl border border-emerald-500/30 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-500/30 pb-4 gap-3">
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-wider text-white flex items-center space-x-2">
                    <span>🏛️</span>
                    <span>Executive Summary & Financial Clearance Analytics</span>
                  </h3>
                  <p className="text-xs text-emerald-200/90 font-medium mt-0.5">Real-time institutional oversight consuming live CIU Cleared Students API feed.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-xl border border-emerald-400/40 uppercase tracking-widest">
                    ⚡ CIU API Live Feed Active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center pt-1">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-black text-emerald-300 block">100% / API Cleared</span>
                  <span className="text-3xl font-black text-white">{report.students_100_tuition ?? 0}</span>
                  <span className="text-[11px] text-emerald-200 block font-semibold">Full Exam & Test Access</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-black text-amber-300 block">50% - 99% Partial</span>
                  <span className="text-3xl font-black text-white">{report.students_50_tuition ?? 0}</span>
                  <span className="text-[11px] text-amber-200 block font-semibold">Test Access Granted</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-black text-red-300 block">Below 50% Tuition</span>
                  <span className="text-3xl font-black text-white">{report.students_below_50_tuition ?? 0}</span>
                  <span className="text-[11px] text-red-200 block font-semibold">Barred from Assessments</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-black text-cyan-300 block">CIU Cleared API Records</span>
                  <span className="text-3xl font-black text-white">{report.external_api_total_records ?? 0}</span>
                  <span className="text-[11px] text-cyan-200 block font-semibold">Live External Feed Payload</span>
                </div>
              </div>
            </div>
          )}

          {/* Submissions Organised by Faculties for DVC, VC, Dean, Admin */}
          {report.faculty_submissions && report.faculty_submissions.length > 0 && (
            <div className="green-card rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">
                  🏛️ Assessment Submissions & Pass Rates Organised by Faculty
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  Total Faculties: {report.faculty_submissions.length}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Faculty Code & Name</th>
                      <th className="px-4 py-3 text-center">Enrolled Students</th>
                      <th className="px-4 py-3 text-center">Exam Submissions</th>
                      <th className="px-4 py-3 text-center">Test Submissions</th>
                      <th className="px-4 py-3 text-center">Total Submissions</th>
                      <th className="px-4 py-3 text-center">Exam Pass Rate (%)</th>
                      <th className="px-4 py-3 text-center">Test Pass Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {report.faculty_submissions.map((fs) => (
                      <tr key={fs.faculty_id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-bold text-slate-850">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-light/10 text-brand-dark border border-brand-light/20 mr-2">
                            {fs.faculty_code}
                          </span>
                          <span>{fs.faculty_name}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{fs.total_students}</td>
                        <td className="px-4 py-3 text-center font-bold text-brand-medium">{fs.total_exam_submissions}</td>
                        <td className="px-4 py-3 text-center font-bold text-brand-dark">{fs.total_test_submissions}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-900">{fs.total_submissions}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-emerald-700">{fs.exam_pass_rate}%</td>
                        <td className="px-4 py-3 text-center font-extrabold text-emerald-700">{fs.test_pass_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Examinations Overview</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Exams Set:</span>
                  <span className="font-bold text-slate-850">{report.total_exams ?? 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Approved Exams:</span>
                  <span className="font-bold text-emerald-700">{report.approved_exams ?? 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Total Exam Attempts:</span>
                  <span className="font-bold text-slate-850">{report.total_exam_attempts ?? 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Institutional Exam Score Average:</span>
                  <span className="font-bold text-emerald-600">{report.avg_exam_score ?? 0}%</span>
                </div>
              </div>
            </div>

            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Continuous Tests & Timetabling Overview</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Class Timetable Slots Posted:</span>
                  <span className="font-bold text-brand-dark">{report.total_class_timetables || 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Exam Timetable Schedules Posted:</span>
                  <span className="font-bold text-brand-medium">{report.total_exam_timetables || 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Published Active Tests:</span>
                  <span className="font-bold text-emerald-700">{report.published_tests ?? 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Institutional Test Score Average:</span>
                  <span className="font-bold text-emerald-700">{report.avg_test_score ?? 0}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* Executive Institutional Distribution Visualisation */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Institutional Academic Performance Breakdown</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Institutional Exam Average ({report.avg_exam_score ?? 0}%)</span>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(report.avg_exam_score ?? 0, 100)}%` }}></div>
                  <div className="h-full bg-slate-200" style={{ width: `${100 - Math.min(report.avg_exam_score ?? 0, 100)}%` }}></div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Institutional Test Average ({report.avg_test_score ?? 0}%)</span>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-brand-emerald" style={{ width: `${Math.min(report.avg_test_score ?? 0, 100)}%` }}></div>
                  <div className="h-full bg-slate-200" style={{ width: `${100 - Math.min(report.avg_test_score ?? 0, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
