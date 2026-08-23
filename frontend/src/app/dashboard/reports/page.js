'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function ReportsDashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchReportSummary();
  }, []);

  async function fetchReportSummary() {
    try {
      setLoading(true);
      const res = await api.get('/reports/summary/');
      setReport(res);
    } catch (err) {
      setErrorMsg('Failed to load academic report statistics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold">Generating Academic Performance & Timetable Analytics...</p>
      </div>
    );
  }

  if (errorMsg || !report) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-2xl text-red-700 text-xs font-semibold">
          {errorMsg || 'Unable to load report data.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">CIU Academic & Institutional Analytics</h2>
          <p className="text-slate-500 text-xs font-medium">Performance evaluations, exam/test pass trends, attendance rates, and timetable metrics.</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-800 font-bold uppercase tracking-wider self-start sm:self-auto">
          Role Report: {user.role.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* STUDENT REPORT VIEW */}
      {user.role === 'student' && (
        <div className="space-y-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Exam Performance Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Examinations</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.exams_done}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {report.exams_passed} Passed
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Failed: <span className="font-bold text-red-600">{report.exams_failed}</span></p>
            </div>

            {/* Test Performance Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Continuous Tests & Quizzes</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.tests_done}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {report.tests_passed} Passed
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Avg. Score: <span className="font-bold text-indigo-600">{report.average_test_score}%</span></p>
            </div>

            {/* Class Attendance Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Attendance</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-brand-dark">{report.attendance_count}</span>
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
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assessment Completion Rate</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Examinations Pass Rate</span>
                    <span className="text-emerald-600">
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
                    <span className="text-indigo-600">
                      {report.tests_done > 0 ? Math.round((report.tests_passed / report.tests_done) * 100) : 100}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${report.tests_done > 0 ? (report.tests_passed / report.tests_done) * 100 : 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualisation 2: Grade Score Breakdown Gauge */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
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
        </div>
      )}

      {/* LECTURER REPORT VIEW */}
      {user.role === 'lecturer' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessments Created</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.exams_created + report.tests_created}</span>
                <span className="text-xs font-bold text-brand-medium bg-brand-light/10 px-2 py-0.5 rounded border border-brand-light/20">
                  {report.exams_created} Exams / {report.tests_created} Tests
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Submissions Received</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-850">{report.total_exam_submissions + report.total_test_submissions}</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Autograded
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Pass Rates</span>
              <div className="space-y-1">
                <p className="text-xs text-slate-600">Exams Pass Rate: <span className="font-bold text-emerald-600">{report.exam_pass_rate}%</span></p>
                <p className="text-xs text-slate-600">Tests Pass Rate: <span className="font-bold text-emerald-600">{report.test_pass_rate}%</span></p>
              </div>
            </div>

          </div>

          {/* Lecturer Visual Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Class Assessment Pass Rate Comparison</h3>
              <div className="flex items-end justify-around h-48 pt-4 pb-2 border-b border-slate-100">
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-xs font-bold text-emerald-600">{report.exam_pass_rate}%</span>
                  <div className="w-16 bg-emerald-500 rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(report.exam_pass_rate, 10)}%` }}></div>
                  <span className="text-xs font-medium text-slate-500">Exams Pass</span>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-xs font-bold text-indigo-600">{report.test_pass_rate}%</span>
                  <div className="w-16 bg-indigo-500 rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(report.test_pass_rate, 10)}%` }}></div>
                  <span className="text-xs font-medium text-slate-500">Tests Pass</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Student Submission Volume</h3>
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Exam Submissions</span>
                    <span className="font-bold text-slate-800">{report.total_exam_submissions}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(report.total_exam_submissions * 10, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Test Submissions</span>
                    <span className="font-bold text-slate-800">{report.total_test_submissions}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(report.total_test_submissions * 10, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE / DEAN / SECRETARY / REGISTRAR / DVC / ADMIN VIEW */}
      {['dean', 'faculty_admin', 'registrar', 'dvc', 'admin'].includes(user.role) && (
        <div className="space-y-8">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Students</span>
              <span className="text-2xl font-black text-brand-dark">{report.total_students}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Lecturers</span>
              <span className="text-2xl font-black text-brand-medium">{report.total_lecturers}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Faculties</span>
              <span className="text-2xl font-black text-indigo-600">{report.total_faculties}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Courses / Units</span>
              <span className="text-2xl font-black text-emerald-600">{report.total_courses} / {report.total_course_units}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Examinations Overview</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Exams Set:</span>
                  <span className="font-bold text-slate-850">{report.total_exams}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Dean Approved Exams:</span>
                  <span className="font-bold text-blue-700">{report.approved_exams}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Total Exam Attempts:</span>
                  <span className="font-bold text-slate-850">{report.total_exam_attempts}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Institutional Exam Score Average:</span>
                  <span className="font-bold text-emerald-600">{report.avg_exam_score}%</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Continuous Tests & Timetabling Overview</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Class Timetable Slots Posted:</span>
                  <span className="font-bold text-indigo-700">{report.total_class_timetables || 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Exam Timetable Schedules Posted:</span>
                  <span className="font-bold text-purple-700">{report.total_exam_timetables || 0}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Published Active Tests:</span>
                  <span className="font-bold text-emerald-700">{report.published_tests}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 font-medium">Institutional Test Score Average:</span>
                  <span className="font-bold text-indigo-600">{report.avg_test_score}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* Executive Institutional Distribution Visualisation */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Institutional Academic Performance Breakdown</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Institutional Exam Average ({report.avg_exam_score}%)</span>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(report.avg_exam_score, 100)}%` }}></div>
                  <div className="h-full bg-slate-200" style={{ width: `${100 - Math.min(report.avg_exam_score, 100)}%` }}></div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Institutional Test Average ({report.avg_test_score}%)</span>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.min(report.avg_test_score, 100)}%` }}></div>
                  <div className="h-full bg-slate-200" style={{ width: `${100 - Math.min(report.avg_test_score, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
