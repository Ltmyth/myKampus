'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function ExamResultsPage() {
  const { id: examId } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (examId) {
      loadResults();
    }
  }, [examId]);

  async function loadResults() {
    try {
      setLoading(true);
      let targetAttemptId = null;

      // Extract attemptId from query parameters
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        targetAttemptId = searchParams.get('attemptId');
      }

      if (!targetAttemptId) {
        // Fetch user's attempts to find the one for this exam
        const attemptsData = await api.get('/attempts/').catch(() => []);
        const userAttempt = attemptsData.find(att => att.exam === parseInt(examId));

        if (!userAttempt) {
          setErrorMsg('No graded attempt found for this exam.');
          return;
        }

        if (!userAttempt.completed_at) {
          // Not completed, redirect to take exam
          router.push(`/dashboard/exams/${examId}`);
          return;
        }
        targetAttemptId = userAttempt.id;
      }

      // Fetch results details (includes questions and correct options)
      const data = await api.get(`/attempts/${targetAttemptId}/results/`);
      if (user?.role === 'student' && data.is_results_released === false) {
        setErrorMsg(data.detail || 'Examination results are currently withheld by the Academic Registrar / Dean and will be visible once released.');
        setAttempt(data.attempt);
        setQuestions([]);
        return;
      }
      setAttempt(data.attempt);
      setQuestions(data.questions || []);

    } catch (err) {
      setErrorMsg(err.message || 'Failed to load results.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-slate-500 font-semibold text-sm">Grading answers and loading examination scorecard...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="p-6 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm font-semibold rounded-2xl">
          {errorMsg}
        </div>
        <button
          onClick={() => router.push('/dashboard/exams')}
          className="px-5 py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          Return to Exams Portal
        </button>
      </div>
    );
  }

  const passed = (attempt?.score || 0) >= 50.0;
  const studentDisplayName = attempt.student_name || (user?.id === attempt.student ? (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username) : attempt.student_username || 'Student');
  const studentRegNo = attempt.student_reg_number || attempt.registration_number || (user?.id === attempt.student ? user.reg_number : '') || 'N/A';
  const studentEmail = attempt.student_email || (user?.id === attempt.student ? user.email : '') || 'N/A';
  const facultyName = attempt.student_faculty || 'Clarke International University';
  const academicYear = attempt.academic_year || '2026/2027';
  const yearOfStudy = attempt.year_of_study || (user?.id === attempt.student ? user.year_of_study : 1) || 1;
  const semesterVal = attempt.semester || (user?.id === attempt.student ? user.semester : 1) || 1;

  // Calculate duration elapsed
  const startTimeObj = attempt.started_at ? new Date(attempt.started_at) : null;
  const compTimeObj = attempt.completed_at ? new Date(attempt.completed_at) : null;
  let elapsedMinutes = null;
  if (startTimeObj && compTimeObj && compTimeObj >= startTimeObj) {
    elapsedMinutes = Math.round((compTimeObj - startTimeObj) / 60000);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      
      {/* 1. Official Candidate Profile & Scorecard Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-dark to-brand-light text-white flex items-center justify-center text-xl font-black shadow-sm">
              🎓
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-dark bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Clarke International University · Official Examination Scorecard
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {attempt.exam_title}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Course: <strong className="text-slate-700">[{attempt.exam_course_code}] {attempt.exam_course_name}</strong> · Lecturer: {attempt.lecturer_name || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center">
            {renderSubmissionTypeBadge(attempt.submission_type, attempt.auto_submitted_reason)}
          </div>
        </div>

        {/* Student Personal & Academic Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Full Name</span>
            <span className="font-extrabold text-slate-900 block truncate">{studentDisplayName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registration Number</span>
            <span className="font-mono font-bold text-brand-dark block">{studentRegNo}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Academic Scope</span>
            <span className="font-bold text-slate-800 block">Year {yearOfStudy} · Sem {semesterVal}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Academic Year</span>
            <span className="font-bold text-emerald-800 block">{academicYear}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faculty / School</span>
            <span className="font-semibold text-slate-700 block truncate">{facultyName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Email</span>
            <span className="font-mono text-[11px] text-slate-600 block truncate">{studentEmail}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Examination Status</span>
            <span className={`font-extrabold block ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {passed ? 'PASSED (≥ 50%)' : 'FAILED (< 50%)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grade Outcome</span>
            <span className="font-extrabold text-slate-900 block">{attempt.score}% Final</span>
          </div>
        </div>
      </div>

      {/* 2. Assessment Score & Timing Banner */}
      <div className={`rounded-3xl p-8 border shadow-sm text-center relative overflow-hidden ${passed ? 'bg-gradient-to-br from-emerald-900 to-brand-dark text-white border-brand-light/30' : 'bg-gradient-to-br from-red-950 to-slate-900 text-white border-red-900/30'}`}>
        
        <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase border mb-3 ${passed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
          {passed ? '🎉 EXAMINATION PASSED' : '⚠️ EXAMINATION FAILED'}
        </span>

        {/* Big Score Display */}
        <div className="my-4">
          <span className="text-6xl sm:text-7xl font-black tracking-tight">{attempt.score}%</span>
          <p className="text-xs text-white/70 font-semibold mt-1.5">
            Pass Mark Target: 50.0% · Official Evaluation: {passed ? 'Academic Clearance Satisfied' : 'Supplementary Recommended'}
          </p>
        </div>

        {/* Timing & Security Audit Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/25 p-4 rounded-2xl border border-white/10 max-w-3xl mx-auto text-xs text-left">
          <div>
            <span className="text-white/60 text-[10px] uppercase font-bold block">🟢 Student Started (EAT)</span>
            <span className="font-mono font-bold text-white text-[11px] block mt-0.5">
              {formatUgandanTime(attempt.started_at || attempt.start_time)}
            </span>
          </div>
          <div>
            <span className="text-white/60 text-[10px] uppercase font-bold block">🔴 Submitted At (EAT)</span>
            <span className="font-mono font-bold text-white text-[11px] block mt-0.5">
              {formatUgandanTime(attempt.completed_at || attempt.submission_time)}
            </span>
          </div>
          <div>
            <span className="text-white/60 text-[10px] uppercase font-bold block">⏱️ Duration / Time Taken</span>
            <span className="font-bold text-white block mt-0.5">
              {elapsedMinutes !== null ? `${elapsedMinutes}m elapsed` : 'N/A'} ({attempt.duration_minutes || 60}m cap)
            </span>
          </div>
          <div>
            <span className="text-white/60 text-[10px] uppercase font-bold block">🛡️ Submission Mode</span>
            <span className="font-extrabold text-amber-200 block mt-0.5 truncate">
              {attempt.submission_type_display || (attempt.submission_type ? attempt.submission_type.toUpperCase() : 'MANUAL')}
            </span>
          </div>
        </div>

        {/* Proctoring & AI Surveillance Audit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto mt-3 text-left text-xs">
          <div className="bg-black/20 p-3 rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-white/70 text-[11px] font-medium">Proctoring Tab Switch Count:</span>
            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${attempt.tab_switches_count > 0 ? 'bg-amber-400 text-amber-950' : 'bg-emerald-400/20 text-emerald-300'}`}>
              {attempt.tab_switches_count > 0 ? `⚠️ ${attempt.tab_switches_count} switch(es)` : '✓ Clean (0 switches)'}
            </span>
          </div>
          <div className="bg-black/20 p-3 rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-white/70 text-[11px] font-medium">Security Trigger:</span>
            <span className="font-bold text-white/90 text-[11px] truncate max-w-[180px]" title={attempt.auto_submitted_reason || 'Clean submission'}>
              {attempt.auto_submitted_reason || 'Normal Completion'}
            </span>
          </div>
        </div>

        {/* Late Submission Flag & Student Comments */}
        {attempt.is_late && (
          <div className="mt-4 p-3.5 bg-amber-500/20 border border-amber-400/40 rounded-2xl max-w-3xl mx-auto text-left text-xs text-amber-200">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-extrabold text-[10px] uppercase">
              ⚠️ Late Submission
            </span>
            {attempt.late_submission_reason && (
              <p className="mt-1.5 text-white/90 italic">
                <strong className="text-amber-300">Student Justification:</strong> &quot;{attempt.late_submission_reason}&quot;
              </p>
            )}
          </div>
        )}

      </div>

      {/* 3. Questionnaire Breakdown & Performance */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
          Questionnaire Breakdown &amp; Performance
        </h3>

        <div className="space-y-6 divide-y divide-slate-150">
          {questions.map((q, idx) => {
            const studentAns = attempt.answers?.[q.id.toString()];
            const correctAns = q.correct_option;
            const isCorrect = studentAns && studentAns.toUpperCase() === correctAns.toUpperCase();

            return (
              <div key={q.id} className="pt-6 first:pt-0 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h4 className="text-sm font-bold text-slate-800 leading-relaxed">
                    Q{idx + 1}: {q.question_text}
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 uppercase tracking-wider ${isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                {/* Options mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                  {[
                    { label: 'A', text: q.option_a },
                    { label: 'B', text: q.option_b },
                    { label: 'C', text: q.option_c },
                    { label: 'D', text: q.option_d },
                  ].map((opt) => {
                    const isStudentChoice = studentAns === opt.label;
                    const isCorrectChoice = correctAns === opt.label;

                    let bgStyle = 'bg-slate-50 border-slate-200';
                    let labelStyle = 'bg-white border-slate-300 text-slate-500';

                    if (isCorrectChoice) {
                      bgStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900';
                      labelStyle = 'bg-emerald-600 border-emerald-600 text-white';
                    } else if (isStudentChoice && !isCorrect) {
                      bgStyle = 'bg-red-50 border-red-300 text-red-950';
                      labelStyle = 'bg-red-650 border-red-650 text-white';
                    }

                    return (
                      <div
                        key={opt.label}
                        className={`px-4 py-2.5 rounded-xl border flex items-center space-x-2.5 ${bgStyle}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${labelStyle}`}>
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Student Selected Answer</span>
                    <span className={`font-bold text-sm block mt-0.5 ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatExamAnswerText(q, studentAns)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-100/60 border border-emerald-300">
                    <span className="text-[10px] text-emerald-900 font-bold uppercase block">✓ Official Correct Answer Key</span>
                    <span className="font-bold text-sm text-emerald-950 block mt-0.5">
                      {formatExamAnswerText(q, correctAns)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={() => router.push('/dashboard/exams')}
          className="px-6 py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Return to Exams Portal
        </button>
      </div>

    </div>
  );
}

function formatExamAnswerText(q, key) {
  if (!key) return '(No Answer Provided)';
  const k = String(key).trim().toUpperCase();
  if (k === 'A' && q.option_a) return `Option A: ${q.option_a}`;
  if (k === 'B' && q.option_b) return `Option B: ${q.option_b}`;
  if (k === 'C' && q.option_c) return `Option C: ${q.option_c}`;
  if (k === 'D' && q.option_d) return `Option D: ${q.option_d}`;
  return k;
}

function formatUgandanTime(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-UG', {
      timeZone: 'Africa/Kampala',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' EAT';
  } catch {
    return dateStr;
  }
}

function renderSubmissionTypeBadge(type, reason) {
  const t = (type || '').toLowerCase();
  if (t === 'security logs' || (reason && (reason.toLowerCase().includes('security') || reason.toLowerCase().includes('tab switch') || reason.toLowerCase().includes('lockdown')))) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300">
        <span>🛡️</span>
        <span>Security Logs Triggered</span>
      </span>
    );
  }
  if (t === 'system' || (reason && (reason.toLowerCase().includes('duration') || reason.toLowerCase().includes('timeout') || reason.toLowerCase().includes('window closed')))) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
        <span>⏱️</span>
        <span>System Auto-Submit</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
      <span>✅</span>
      <span>Manual Submission</span>
    </span>
  );
}
