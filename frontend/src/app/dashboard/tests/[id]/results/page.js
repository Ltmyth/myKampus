'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TestResultsPage({ params }) {
  const unwrappedParams = use(params);
  const testId = unwrappedParams.id;
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');

  const { user } = useAuth();
  const router = useRouter();

  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchResults();
  }, [testId, attemptId]);

  async function fetchResults() {
    try {
      setLoading(true);
      if (!attemptId) {
        // Fetch student's latest attempt for this test
        const attempts = await api.get('/test-attempts/').catch(() => []);
        const match = attempts.find(a => a.test === parseInt(testId) && a.completed_at);
        if (match) {
          const res = await api.get(`/test-attempts/${match.id}/results/`);
          setResultData(res);
        } else {
          setErrorMsg('No completed attempt found for this test.');
        }
      } else {
        const res = await api.get(`/test-attempts/${attemptId}/results/`);
        setResultData(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to retrieve test scorecard.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold">Generating Academic Scorecard...</p>
      </div>
    );
  }

  if (errorMsg || !resultData) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-2xl text-red-700 text-xs font-semibold">
          {errorMsg || 'Unable to load test result scorecard.'}
        </div>
        <button
          onClick={() => router.push('/dashboard/tests')}
          className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          Return to Test Portal
        </button>
      </div>
    );
  }

  if (user?.role === 'student' && resultData && resultData.is_results_released === false) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-5 animate-fade-in">
        <div className="p-8 bg-purple-50 border-2 border-purple-200 rounded-3xl shadow-sm space-y-3">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto text-purple-700 font-black text-2xl">
            🔒
          </div>
          <h3 className="font-extrabold text-purple-950 text-lg">Test Results Currently Withheld</h3>
          <p className="text-xs text-purple-800 font-medium leading-relaxed">
            {resultData.detail || 'Your attempt was submitted successfully. Scores and answer breakdowns are currently withheld by the lecturer and will be published once released.'}
          </p>
          <div className="pt-2 text-[11px] text-purple-700 font-mono font-semibold">
            Attempt Submitted At: {formatUgandanTime(resultData.attempt?.completed_at || resultData.attempt?.submission_time)}
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/tests')}
          className="px-5 py-2.5 bg-brand-dark hover:bg-brand-medium text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          ← Return to Test Portal
        </button>
      </div>
    );
  }

  const { attempt, questions } = resultData;
  const isPassed = attempt.passed;
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
                Clarke International University · Official Assessment Scorecard
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {attempt.test_title}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Course: <strong className="text-slate-700">[{attempt.test_course_code}] {attempt.test_course_name}</strong> · Category: {attempt.test_category ? attempt.test_category.replace('_', ' ').toUpperCase() : 'TEST'}
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Name</span>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attempt Number</span>
            <span className="font-extrabold text-slate-800 block">Attempt #{attempt.attempt_number || 1}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pass Threshold</span>
            <span className="font-extrabold text-slate-800 block">{attempt.pass_percentage || 50}% Mark</span>
          </div>
        </div>
      </div>

      {/* 2. Assessment Score & Performance Banner */}
      <div className={`rounded-3xl p-8 border shadow-sm text-center relative overflow-hidden ${isPassed ? 'bg-gradient-to-br from-emerald-900 to-brand-dark text-white border-brand-light/30' : 'bg-gradient-to-br from-red-950 to-slate-900 text-white border-red-900/30'}`}>
        
        <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase border mb-3 ${isPassed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
          {isPassed ? '🎉 TEST PASSED' : '⚠️ TEST FAILED'}
        </span>

        {/* Big Score Display */}
        <div className="my-4">
          <span className="text-6xl sm:text-7xl font-black tracking-tight">{attempt.score}%</span>
          <p className="text-xs text-white/70 font-semibold mt-1.5">
            Pass Mark Target: {attempt.pass_percentage}% · Result: {isPassed ? 'Satisfied Requirements' : 'Did Not Meet Minimum Threshold'}
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
              {elapsedMinutes !== null ? `${elapsedMinutes}m elapsed` : 'N/A'} ({attempt.duration_minutes || 30}m cap)
            </span>
          </div>
          <div>
            <span className="text-white/60 text-[10px] uppercase font-bold block">🛡️ Submission Mode</span>
            <span className="font-extrabold text-amber-200 block mt-0.5 truncate">
              {attempt.submission_type_display || (attempt.submission_type ? attempt.submission_type.toUpperCase() : 'MANUAL')}
            </span>
          </div>
        </div>

        {/* Security & Proctoring Logs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto mt-3 text-left text-xs">
          <div className="bg-black/20 p-3 rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-white/70 text-[11px] font-medium">Focus &amp; Tab Switches Tracked:</span>
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

      {/* 3. Detailed Question Review */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Detailed Answer Breakdown &amp; Explanations</h3>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const studentAns = strVal(attempt.answers?.[strVal(q.id)]);
            const correctAns = strVal(q.correct_answer);
            const isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();

            return (
              <div key={q.id} className={`p-4 rounded-2xl border transition-all ${isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Q{idx + 1} ({q.question_type.toUpperCase()} · {q.points} Point{q.points > 1 ? 's' : ''})
                    </span>
                    <h4 className="font-bold text-slate-850 text-sm">{q.question_text}</h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${isCorrect ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                    {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-xs">
                  <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Student Selected Answer</span>
                    <span className={`font-bold text-sm block mt-0.5 ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
                      {formatAnswerText(q, studentAns)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-100/60 border border-emerald-300">
                    <span className="text-[10px] text-emerald-900 font-bold uppercase block">✓ Official Correct Answer Key</span>
                    <span className="font-bold text-sm text-emerald-950 block mt-0.5">
                      {formatAnswerText(q, correctAns)}
                    </span>
                  </div>
                </div>

                {q.explanation && (
                  <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-650 space-y-0.5">
                    <span className="font-bold text-brand-medium text-[10px] uppercase block">💡 Lecturer Explanation:</span>
                    <p className="italic">{q.explanation}</p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/dashboard/tests')}
          className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          ← Return to Test Portal
        </button>

        <button
          onClick={() => router.push(`/dashboard/tests/${testId}`)}
          className="px-5 py-2.5 bg-brand-light hover:bg-brand-medium text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
        >
          Retake Test →
        </button>
      </div>

    </div>
  );
}

function strVal(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function formatAnswerText(q, key) {
  if (!key) return '(No Answer Provided)';
  const k = String(key).trim();
  if (q.question_type === 'mcq') {
    const upper = k.toUpperCase();
    if (upper === 'A' && q.option_a) return `Option A: ${q.option_a}`;
    if (upper === 'B' && q.option_b) return `Option B: ${q.option_b}`;
    if (upper === 'C' && q.option_c) return `Option C: ${q.option_c}`;
    if (upper === 'D' && q.option_d) return `Option D: ${q.option_d}`;
  }
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
